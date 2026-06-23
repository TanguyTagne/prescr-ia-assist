import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// In-memory rate limit (1 email per address per hour)
const recentEmails = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "tanguytagne12@gmail.com";

function escapeHtml(s: unknown): string {
  return String(s ?? "N/A").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendEmail(formData: Record<string, any>) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const { pharmacy_name, contact_name, email, phone, city, lgo_type } = formData;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#16a34a">Nouvelle demande d'accès Asclion</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Pharmacie</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(pharmacy_name)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Contact</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(contact_name)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Téléphone</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Ville</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">LGO</td><td style="padding:8px">${escapeHtml(lgo_type)}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:0.9em;color:#666">
        <a href="https://prescr-ia-assist.lovable.app/admin">Ouvrir le dashboard admin</a>
      </p>
    </div>`;

  const subject = `Nouvelle demande d'accès — ${String(pharmacy_name ?? "").slice(0, 100)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Asclion <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", res.status, err);
  } else {
    console.log("Email sent successfully");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.json();
    // Basic input validation + size cap to mitigate abuse
    if (!formData || typeof formData !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safe: Record<string, string> = {};
    for (const k of ["pharmacy_name", "contact_name", "email", "phone", "city", "lgo_type"]) {
      const v = (formData as any)[k];
      safe[k] = typeof v === "string" ? v.slice(0, 200) : "";
    }

    const email = safe.email.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit per-email (in-memory, 1 per hour)
    const now = Date.now();
    const last = recentEmails.get(email) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify a matching access_requests row was inserted recently (last 5 min)
    // — proves the caller went through the legitimate public form
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const since = new Date(now - 5 * 60 * 1000).toISOString();
      const { data: matches } = await supabase
        .from("access_requests")
        .select("id")
        .eq("email", safe.email)
        .gte("created_at", since)
        .limit(1);
      if (!matches || matches.length === 0) {
        return new Response(JSON.stringify({ error: "No matching access request" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("access_requests verify failed:", e);
      return new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    recentEmails.set(email, now);
    EdgeRuntime.waitUntil(sendEmail(safe));
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-access-request error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
