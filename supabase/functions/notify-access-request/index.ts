import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "tanguytagne12@gmail.com";

async function sendEmail(formData: Record<string, any>) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const { pharmacy_name, contact_name, email, phone, city, lgo_type } = formData;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#16a34a">Nouvelle demande d'accès PrescrIA</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Pharmacie</td><td style="padding:8px;border-bottom:1px solid #eee">${pharmacy_name || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Contact</td><td style="padding:8px;border-bottom:1px solid #eee">${contact_name || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:8px;border-bottom:1px solid #eee">${email || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Téléphone</td><td style="padding:8px;border-bottom:1px solid #eee">${phone || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Ville</td><td style="padding:8px;border-bottom:1px solid #eee">${city || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">LGO</td><td style="padding:8px">${lgo_type || "N/A"}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:0.9em;color:#666">
        <a href="https://prescr-ia-assist.lovable.app/admin">Ouvrir le dashboard admin</a>
      </p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "PrescrIA <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: `Nouvelle demande d'accès — ${pharmacy_name}`,
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
    EdgeRuntime.waitUntil(sendEmail(formData));
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
