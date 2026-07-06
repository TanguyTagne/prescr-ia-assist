import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_STATUS = new Set(["active", "paused", "disabled"]);
const BAN_DURATION = "87600h"; // ~10 years — effectively permanent until unbanned

/**
 * Revoke ALL refresh + access tokens for a user via GoTrue admin endpoint.
 * `supabase.auth.admin.signOut(userId)` in the JS client is broken for by-user
 * signOut in some versions — the underlying HTTP endpoint is the source of truth.
 */
async function revokeAllSessions(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope: "global" }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`revokeAllSessions(${userId}) HTTP ${res.status}: ${txt}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`revokeAllSessions(${userId}) threw:`, e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- Auth: caller must be admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden - admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Body ----
    const { pharmacy_id, status } = await req.json();
    if (!pharmacy_id || !VALID_STATUS.has(status)) {
      return new Response(
        JSON.stringify({ error: "pharmacy_id and status ∈ (active|paused|disabled) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 1. Update pharmacy status ----
    const { error: updErr } = await supabaseAdmin
      .from("pharmacies")
      .update({ status })
      .eq("id", pharmacy_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 2. Fetch all profiles for that pharmacy ----
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("pharmacy_id", pharmacy_id);
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = (profiles || []).map((p: any) => p.id as string);

    // Identify admins so we NEVER ban them
    let adminSet = new Set<string>();
    if (userIds.length > 0) {
      const { data: adminRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "admin");
      adminSet = new Set((adminRows || []).map((r: any) => r.user_id as string));
    }

    let bannedCount = 0;
    let unbannedCount = 0;
    let sessionsRevoked = 0;

    if (status === "paused" || status === "disabled") {
      // Ban + revoke all sessions for every non-admin user
      for (const uid of userIds) {
        if (adminSet.has(uid)) continue;
        try {
          const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
            ban_duration: BAN_DURATION,
          });
          if (banErr) console.error(`ban(${uid}) failed:`, banErr);
          else bannedCount++;
        } catch (e) {
          console.error(`ban(${uid}) threw:`, e);
        }
        const ok = await revokeAllSessions(uid);
        if (ok) sessionsRevoked++;
      }
    } else if (status === "active") {
      // Unban everyone (safe no-op for those never banned)
      for (const uid of userIds) {
        try {
          const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
            ban_duration: "none",
          });
          if (unbanErr) console.error(`unban(${uid}) failed:`, unbanErr);
          else unbannedCount++;
        } catch (e) {
          console.error(`unban(${uid}) threw:`, e);
        }
      }
    }

    // ---- 3. Wipe heartbeats so admin sees "hors ligne" immediately ----
    let heartbeatsDeleted = 0;
    if (status === "paused" || status === "disabled") {
      const { count } = await supabaseAdmin
        .from("pharmacy_instance_heartbeats")
        .delete({ count: "exact" })
        .eq("pharmacy_id", pharmacy_id);
      heartbeatsDeleted = count || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        pharmacy_id,
        status,
        total_users: userIds.length,
        banned: bannedCount,
        unbanned: unbannedCount,
        sessions_revoked: sessionsRevoked,
        heartbeats_deleted: heartbeatsDeleted,
        admins_skipped: userIds.filter((u) => adminSet.has(u)).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("set-pharmacy-access error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
