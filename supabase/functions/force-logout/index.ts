import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Correct way to revoke all sessions by user_id: GoTrue admin logout endpoint
// (supabase-js `admin.signOut(userId)` is unreliable across versions).
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

    // Verify caller is admin via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: "Forbidden - admin only" }), { status: 403, headers: corsHeaders });
    }

    const { email, scope, pharmacy_id } = await req.json();

    if (pharmacy_id) {
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("pharmacy_id", pharmacy_id);
      if (profErr) {
        return new Response(JSON.stringify({ error: profErr.message }), { status: 500, headers: corsHeaders });
      }
      let count = 0;
      for (const p of (profiles || [])) {
        const ok = await revokeAllSessions((p as any).id);
        if (ok) count++;
      }
      // Also wipe heartbeats so the admin dashboard reflects "hors ligne" now
      await supabaseAdmin
        .from("pharmacy_instance_heartbeats")
        .delete()
        .eq("pharmacy_id", pharmacy_id);
      return new Response(JSON.stringify({ success: true, message: `${count} user(s) signed out for pharmacy ${pharmacy_id}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (scope === "all") {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      let count = 0;
      for (const u of (users || [])) {
        const ok = await revokeAllSessions(u.id);
        if (ok) count++;
      }
      return new Response(JSON.stringify({ success: true, message: `${count} users signed out globally` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: corsHeaders });
    }

    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = users?.find((u: any) => u.email === email);
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }

    const ok = await revokeAllSessions(targetUser.id);
    return new Response(
      JSON.stringify({
        success: ok,
        message: ok ? `All sessions terminated for ${email}` : `Failed to revoke sessions for ${email}`,
      }),
      { status: ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: corsHeaders });
  }
});
