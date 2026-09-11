import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSubscriptionEmail } from "../_shared/subscriptionEmail.ts";
import { planLabel } from "../_shared/provisionAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.asclion.com";

// Relance des souscriptions commencées mais non payées (panier abandonné).
// Déclenchée par pg_cron (quotidien), protégée par le service role ou le secret interne.
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

    // Fenêtre : commencé il y a plus de 24 h, moins de 7 jours.
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const until = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id, plan, billing_cycle, office_id, subscription_offices(contact_email, contact_first_name, office_name)")
      .in("status", ["checkout_started"])
      .is("paid_at", null)
      .gte("created_at", since)
      .lte("created_at", until);
    if (error) throw error;

    let sent = 0;
    for (const sub of subs ?? []) {
      const office = sub.subscription_offices as unknown as {
        contact_email: string; contact_first_name: string; office_name: string;
      } | null;
      if (!office?.contact_email) continue;

      // Déduplication : une seule relance par souscription.
      const { error: dedupeErr } = await supabase.from("subscription_events").insert({
        stripe_event_id: `abandoned_cart:${sub.id}`,
        event_type: "abandoned_cart_reminder",
        subscription_id: sub.id,
        payload: { to: office.contact_email },
      });
      if (dedupeErr) continue; // déjà relancé

      const planId = `${sub.plan}_${sub.billing_cycle === "annual" ? "yearly" : "monthly"}`;
      try {
        await sendSubscriptionEmail(office.contact_email, "abandoned_cart", {
          officeName: office.office_name,
          contactFirstName: office.contact_first_name,
          planLabel: planLabel(sub.plan),
          cycleLabel: sub.billing_cycle === "annual" ? "offre annuelle" : "abonnement mensuel",
          actionUrl: `${SITE_URL}/souscrire?plan=${planId}&source=relance`,
          actionLabel: "Reprendre ma souscription",
        });
        sent += 1;
      } catch (e) {
        console.error("abandoned cart email failed:", e);
        await supabase.from("subscription_events").delete().eq("stripe_event_id", `abandoned_cart:${sub.id}`);
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent: sent, candidates: subs?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("subscription-abandoned-cart error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
