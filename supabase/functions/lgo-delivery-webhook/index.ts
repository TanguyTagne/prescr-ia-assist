// lgo-delivery-webhook — endpoint optionnel pour pousser une délivrance LGO
// dans scan_queue. Tout passe normalement en local (IP+port, COM, sniff
// loopback), donc PAS d'auth HMAC : seul `pharmacy_id` (UUID) + `cip` valide
// sont requis. Le pharmacy_id agit comme jeton d'opacité ; un CIP invalide ou
// une pharmacie inconnue est rejeté.
//
// Body attendu:
//   { "pharmacy_id": "<uuid>", "cip": "<7-13 digits>",
//     "source"?: string, "timestamp"?: ISO, "metadata"?: object }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return err(400, "Invalid JSON");
  }

  const pharmacy_id = String(payload.pharmacy_id ?? "").trim();
  const cipRaw = String(payload.cip ?? "").trim();
  const source = String(payload.source ?? "lgo").trim().slice(0, 32);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pharmacy_id)) {
    return err(400, "Invalid pharmacy_id");
  }
  if (!/^\d{7,13}$/.test(cipRaw)) {
    return err(400, "Invalid CIP");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pharm, error: pharmErr } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", pharmacy_id)
    .maybeSingle();
  if (pharmErr) return err(500, pharmErr.message);
  if (!pharm) return err(404, "Pharmacy not found");

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
