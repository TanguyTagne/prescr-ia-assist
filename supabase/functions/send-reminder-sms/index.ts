import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require shared cron secret to prevent unauthenticated bulk SMS triggering
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!cronSecret || provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      console.warn("Twilio not configured — skipping SMS send");
      return new Response(JSON.stringify({ skipped: true, reason: "Twilio not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Get due reminders
    const { data: reminders, error } = await supabase
      .from("patient_reminders")
      .select("*")
      .eq("status", "scheduled")
      .lte("reminder_date", today)
      .limit(50);

    if (error) throw error;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders) {
      if (!reminder.phone) {
        await supabase
          .from("patient_reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);
        failed++;
        continue;
      }

      // Get pharmacy info for message
      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", reminder.pharmacy_id)
        .single();

      const message = reminder.message ||
        `Bonjour${reminder.patient_name ? " " + reminder.patient_name : ""}, votre traitement arrive à sa fin. Pensez à consulter votre médecin pour un renouvellement. - ${pharmacy?.name || "Votre pharmacie"}`;

      try {
        const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") || "";
        
        const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: reminder.phone,
            From: twilioFrom,
            Body: message,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(`Twilio error [${response.status}]: ${JSON.stringify(data)}`);
        }

        await supabase
          .from("patient_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        sent++;
      } catch (smsErr) {
        console.error(`SMS failed for reminder ${reminder.id}:`, smsErr);
        await supabase
          .from("patient_reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: reminders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reminder error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
