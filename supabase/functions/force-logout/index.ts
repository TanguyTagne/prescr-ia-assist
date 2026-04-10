import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { email } = await req.json();
  if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400 });

  // Find user by email
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const targetUser = users?.find((u: any) => u.email === email);
  if (!targetUser) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

  // Sign out all sessions globally
  const { error } = await supabaseAdmin.auth.admin.signOut(targetUser.id, "global");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true, message: `All sessions terminated for ${email}` }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
