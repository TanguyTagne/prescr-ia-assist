import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSubscriptionEmail } from "../_shared/subscriptionEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_LABEL: Record<string, string> = { classic: "Asclion Classique", premium: "Asclion Premium" };

// Rappel annuel : J-30 avant la fin de période des offres annuelles actives.
// Déclenché par pg_cron (quotidien) — protégé par le service role.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Protection : seul pg_cron (ou un appel service role) peut déclencher.
    const authHeader = req.headers.get("authorization") ?? "";
    let allowed = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "@@none@@");
    if (!allowed) {
      const { data: cfg } = await supabase
        .from("internal_config")
        .select("value")
        .eq("key", "cron_secret")
        .maybeSingle();
      allowed = !!cfg?.value && req.headers.get("x-cron-secret") === cfg.value;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: corsHeaders });
    }

    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const in29Days = new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString();

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id, plan, current_period_end, subscription_offices(contact_email, contact_first_name, office_name, followup_d30_at)")
      .eq("billing_cycle", "annual")
      .in("status", ["active", "paid_pending_validation", "activation_requested"])
      .gte("current_period_end", in29Days)
      .lte("current_period_end", in30Days);
    if (error) throw error;

    let sent = 0;
    for (const sub of subs ?? []) {
      const office = sub.subscription_offices as unknown as { contact_email: string; contact_first_name: string; office_name: string; followup_d30_at: string | null };
      if (office.followup_d30_at) continue; // rappel déjà envoyé
      try {
        await sendSubscriptionEmail(office.contact_email, "annual_reminder", {
          officeName: office.office_name,
          contactFirstName: office.contact_first_name,
          planLabel: PLAN_LABEL[sub.plan] ?? sub.plan,
          cycleLabel: "offre annuelle",
        });
        sent += 1;
      } catch (e) {
        console.error("annual reminder failed:", e);
      }
    }

    // Expiration automatique des annuelles arrivées à échéance sans renouvellement.
    const { data: expired } = await supabase
      .from("subscriptions")
      .select("id, plan, subscription_offices(contact_email, contact_first_name, office_name)")
      .eq("billing_cycle", "annual")
      .in("status", ["active", "activation_requested"])
      .lt("current_period_end", new Date().toISOString());

    for (const sub of expired ?? []) {
      await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
      const office = sub.subscription_offices as unknown as { contact_email: string; contact_first_name: string; office_name: string };
      try {
        await sendSubscriptionEmail(office.contact_email, "subscription_expired", {
          officeName: office.office_name,
          contactFirstName: office.contact_first_name,
          planLabel: PLAN_LABEL[sub.plan] ?? sub.plan,
          cycleLabel: "offre annuelle",
        });
      } catch (e) {
        console.error("expired email failed:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent: sent, expired: expired?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("subscription-annual-reminder error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
