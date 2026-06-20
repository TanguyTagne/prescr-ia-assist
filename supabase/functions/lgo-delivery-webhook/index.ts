// lgo-delivery-webhook — public endpoint that LGO vendors (LEO, Winpharma…)
// can call when a medication is dispensed. Verified via HMAC-SHA256 signature
// in the `x-asclion-signature` header, computed over the raw request body with
// the shared secret LGO_WEBHOOK_SECRET. On success, drops the CIP into
// scan_queue so the matching pharmacy's desktop instance picks it up exactly
// like a regular barcode scan — no Electron change required to support a new
// LGO, only this single entry point.
//
// Expected body:
//   {
//     "pharmacy_id": "<uuid>",
//     "cip": "<7 or 13 digit CIP>",
//     "source": "leo" | "winpharma" | "lgpi" | ...,   // free-form, logged
//     "timestamp": "<ISO 8601>",                       // optional, advisory
//     "metadata": { ... }                              // optional, logged
//   }
//
// Response: { ok: true, queued: <scan_queue.id> } on success.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-asclion-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string compare to avoid timing-based signature probing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err(405, "Method not allowed");

  const SECRET = Deno.env.get("LGO_WEBHOOK_SECRET");
  if (!SECRET) return err(500, "Webhook not configured");

  const sigHeader = req.headers.get("x-asclion-signature")?.trim().toLowerCase() ?? "";
  if (!sigHeader) return err(401, "Missing signature");

  // Read body as text first so we can verify the signature over the EXACT
  // bytes the caller signed, then parse JSON.
  const rawBody = await req.text();
  const expected = await hmacSha256Hex(SECRET, rawBody);
  if (!safeEqual(sigHeader.replace(/^sha256=/, ""), expected)) {
    return err(401, "Invalid signature");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
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

  // Confirm the pharmacy exists (cheap guard against junk payloads).
  const { data: pharm, error: pharmErr } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", pharmacy_id)
    .maybeSingle();
  if (pharmErr) return err(500, pharmErr.message);
  if (!pharm) return err(404, "Pharmacy not found");

  // Push into the existing scan_queue pipeline — same path as the HID scanner
  // and the WinDivert capture, so downstream analysis logic is unchanged.
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
