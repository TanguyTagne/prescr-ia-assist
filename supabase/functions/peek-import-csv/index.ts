import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const file = url.searchParams.get("file") ?? "asclion-medicaments-avec-pcs.csv";
  const { data, error } = await supabase.storage.from("imports").download(file);
  if (error || !data) return new Response(JSON.stringify({ error: error?.message ?? "not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  const text = await data.text();
  const lines = text.split("\n").slice(0, 8);
  return new Response(JSON.stringify({ size: text.length, total_lines: text.split("\n").length, preview: lines }), { headers: { ...cors, "Content-Type": "application/json" } });
});
