import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const userId = "616f80dd-751c-44b3-a3a2-00df8f598769";
  const { data: factors } = await supabase.auth.admin.mfa.listFactors({ userId });
  const removed: string[] = [];
  for (const f of factors?.factors ?? []) {
    const { error } = await supabase.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    if (!error) removed.push(f.id);
  }
  return new Response(JSON.stringify({ ok: true, removed }), {
    headers: { "Content-Type": "application/json" },
  });
});
