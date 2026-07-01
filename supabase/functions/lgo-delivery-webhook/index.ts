// lgo-delivery-webhook — endpoint pour pousser une délivrance LGO dans
// scan_queue. Authentification par clé API scanner (header `x-scanner-key`)
// identique à scanner-webhook : la clé identifie la pharmacie ; le body ne peut
// PAS surcharger pharmacy_id.
//
// Body attendu:
//   { "cip": "<7-13 digits>",
//     "source"?: string, "timestamp"?: ISO, "metadata"?: object }
// Header requis:
//   x-scanner-key: <api_key provisionnée dans pharmacy_scanner_keys>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err(405, "Method not allowed");

  const apiKey = req.headers.get("x-scanner-key")?.trim();
  if (!apiKey || apiKey.length < 16) {
    return err(401, "Missing or invalid x-scanner-key");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return err(400, "Invalid JSON");
  }

  const cipRaw = String(payload.cip ?? "").trim();
  const source = String(payload.source ?? "lgo").trim().slice(0, 32);

  if (!/^\d{7,13}$/.test(cipRaw)) {
    return err(400, "Invalid CIP");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verified pharmacy_id derived from the scanner key — never trust body input.
  const { data: keyRow, error: keyErr } = await supabase
    .from("pharmacy_scanner_keys")
    .select("pharmacy_id, active")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (keyErr) return err(500, keyErr.message);
  if (!keyRow || !keyRow.active) return err(403, "Invalid or inactive scanner key");

  const pharmacy_id = keyRow.pharmacy_id as string;

  const { data: queued, error: qErr } = await supabase
    .from("scan_queue")
    .insert({
      pharmacy_id,
      scan_type: "barcode",
      status: "pending",
      source: `lgo_webhook:${source}`,
      input_data: {
        barcode: cipRaw,
        timestamp: payload.timestamp ?? new Date().toISOString(),
        extra: payload.metadata ?? null,
      },
    })
    .select("id")
    .single();

  if (qErr) return err(500, qErr.message);

  return new Response(JSON.stringify({ ok: true, queued: queued.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
