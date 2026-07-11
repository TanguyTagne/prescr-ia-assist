import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Rate limit: 1 email per (email+error) per 10 minutes
const recentAlerts = new Map<string, number>();
const RATE_LIMIT_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "tanguytagne12@gmail.com";

function escapeHtml(s: unknown): string {
  return String(s ?? "N/A").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendEmail(payload: {
  form: Record<string, any>;
  errorMessage: string;
  errorCode?: string;
  errorDetails?: string;
  url?: string;
  userAgent?: string;
}) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const { form, errorMessage, errorCode, errorDetails, url, userAgent } = payload;

  const rows = Object.entries(form)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
      <h2 style="color:#dc2626">⚠️ Erreur formulaire "Demande de renseignements"</h2>
      <p style="color:#666">Un utilisateur a rencontré une erreur en soumettant le formulaire. Voici les infos capturées pour ne pas perdre le lead :</p>

      <h3 style="margin-top:20px">Données du formulaire</h3>
      <table style="width:100%;border-collapse:collapse">${rows}</table>

      <h3 style="margin-top:20px">Erreur</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #eee">Message</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(errorMessage)}</td></tr>
        ${errorCode ? `<tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #eee">Code</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(errorCode)}</td></tr>` : ""}
        ${errorDetails ? `<tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #eee">Détails</td><td style="padding:6px 8px;border-bottom:1px solid #eee"><pre style="white-space:pre-wrap;font-size:12px;margin:0">${escapeHtml(errorDetails)}</pre></td></tr>` : ""}
        ${url ? `<tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #eee">URL</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(url)}</td></tr>` : ""}
        ${userAgent ? `<tr><td style="padding:6px 8px;font-weight:bold">User-Agent</td><td style="padding:6px 8px;font-size:12px">${escapeHtml(userAgent)}</td></tr>` : ""}
      </table>

      <p style="margin-top:20px;font-size:0.9em;color:#666">
        → Contacte manuellement ce lead pour ne pas le perdre.
      </p>
    </div>`;

  const subject = `⚠️ Erreur formulaire — ${String(form.email ?? form.pharmacy_name ?? "lead inconnu").slice(0, 100)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Asclion Alerts <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", res.status, err);
  } else {
    console.log("Form error alert sent");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawForm = (body.form && typeof body.form === "object") ? body.form : {};
    const safeForm: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawForm).slice(0, 20)) {
      safeForm[String(k).slice(0, 50)] = typeof v === "string" ? v.slice(0, 300) : String(v ?? "").slice(0, 300);
    }

    const errorMessage = String(body.errorMessage ?? "Unknown error").slice(0, 500);
    const errorCode = body.errorCode ? String(body.errorCode).slice(0, 100) : undefined;
    const errorDetails = body.errorDetails ? String(body.errorDetails).slice(0, 2000) : undefined;
    const url = body.url ? String(body.url).slice(0, 300) : undefined;
    const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? undefined;

    const key = `${safeForm.email ?? "anon"}|${errorMessage.slice(0, 80)}`;
    const now = Date.now();
    const last = recentAlerts.get(key) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return new Response(JSON.stringify({ success: true, rateLimited: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recentAlerts.set(key, now);

    EdgeRuntime.waitUntil(
      sendEmail({ form: safeForm, errorMessage, errorCode, errorDetails, url, userAgent })
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-form-error error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
