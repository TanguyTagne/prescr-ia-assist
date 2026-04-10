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

    const { email, scope } = await req.json();

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
