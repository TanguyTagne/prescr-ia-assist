import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "tanguytagne12@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { pharmacy_name, contact_name, email, phone, city, lgo_type } = await req.json();

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a;">🏥 Nouvelle demande d'accès PrescrIA</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Pharmacie</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pharmacy_name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Contact</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact_name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
          ${phone ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Téléphone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${phone}</td></tr>` : ""}
          ${city ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Ville</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${city}</td></tr>` : ""}
          ${lgo_type ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">LGO</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${lgo_type}</td></tr>` : ""}
        </table>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">
          Connecte-toi au <a href="https://prescr-ia-assist.lovable.app/admin">dashboard admin</a> pour traiter cette demande.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PrescrIA <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🏥 Nouvelle demande d'accès — ${pharmacy_name}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Resend error [${res.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-access-request error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
