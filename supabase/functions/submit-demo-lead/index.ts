import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LeadSchema = z.object({
  session_id: z.string().min(1).max(100),
  nom: z.string().trim().min(1).max(100),
  officine: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(255),
  tracking_link_id: z.string().uuid().optional().nullable(),
});

const NOTIFY_EMAIL = "tanguytubert@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = LeadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id, nom, officine, email, tracking_link_id } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert lead
    const { data: lead, error: leadErr } = await supabase
      .from("demo_leads")
      .insert({ session_id, nom, officine, email, tracking_link_id: tracking_link_id ?? null })
      .select()
      .single();

    if (leadErr) {
      console.error("Lead insert error:", leadErr);
      return new Response(JSON.stringify({ error: leadErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark sessions as converted
    await supabase
      .from("demo_sessions")
      .update({ converted_to_lead: true })
      .eq("session_id", session_id);

    // Fetch session info for the email
    const { data: sessions } = await supabase
      .from("demo_sessions")
      .select("ordonnance_id, ip_country, ip_city, referrer, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    const ordonnances = (sessions || []).map((s: any) => s.ordonnance_id).join(", ") || "—";
    const referrer = sessions?.[0]?.referrer || "direct";
    const country = sessions?.[0]?.ip_country || "—";
    const city = sessions?.[0]?.ip_city || "—";

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const html = `
          <h2>🎯 Nouveau lead démo Asclion</h2>
          <p><strong>Nom :</strong> ${escapeHtml(nom)}</p>
          <p><strong>Officine :</strong> ${escapeHtml(officine)}</p>
          <p><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <hr/>
          <p><strong>Ordonnance(s) testée(s) :</strong> ${escapeHtml(ordonnances)}</p>
          <p><strong>Source :</strong> ${escapeHtml(referrer)}</p>
          <p><strong>Localisation :</strong> ${escapeHtml(city)}, ${escapeHtml(country)}</p>
          <p><strong>Sessions :</strong> ${sessions?.length || 0}</p>
          <hr/>
          <p><a href="https://www.asclion.com/admin">→ Voir dans l'admin</a></p>
        `;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Asclion <onboarding@resend.dev>",
            to: [NOTIFY_EMAIL],
            subject: `🎯 Lead démo : ${nom} (${officine})`,
            html,
          }),
        });
        if (!r.ok) console.error("Resend error:", await r.text());
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-demo-lead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
