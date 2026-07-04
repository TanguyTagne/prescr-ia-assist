import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Check admin role
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
      // Sign out every user attached to the given pharmacy
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("pharmacy_id", pharmacy_id);
      if (profErr) {
        return new Response(JSON.stringify({ error: profErr.message }), { status: 500, headers: corsHeaders });
      }
      let count = 0;
      for (const p of (profiles || [])) {
        try {
          await supabaseAdmin.auth.admin.signOut((p as any).id, "global");
          count++;
        } catch (e) {
          console.error("signOut failed for", (p as any).id, e);
        }
      }
      return new Response(JSON.stringify({ success: true, message: `${count} user(s) signed out for pharmacy ${pharmacy_id}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (scope === "all") {
      // Sign out ALL users by listing them and signing each out
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      let count = 0;
      for (const u of (users || [])) {
        await supabaseAdmin.auth.admin.signOut(u.id, "global");
        count++;
      }
      return new Response(JSON.stringify({ success: true, message: `${count} users signed out globally` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: corsHeaders });
    }

    // Find specific user
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = users?.find((u: any) => u.email === email);
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }

    await supabaseAdmin.auth.admin.signOut(targetUser.id, "global");

    return new Response(JSON.stringify({ success: true, message: `All sessions terminated for ${email}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
