import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OFFERS: Record<string, { plan: "classic" | "premium"; cycle: "monthly" | "annual" }> = {
  asclion_classic_monthly: { plan: "classic", cycle: "monthly" },
  asclion_premium_monthly: { plan: "premium", cycle: "monthly" },
  asclion_classic_yearly: { plan: "classic", cycle: "annual" },
  asclion_premium_yearly: { plan: "premium", cycle: "annual" },
};

const BodySchema = z.object({
  subscriptionId: z.string().uuid(),
  priceId: z.enum(Object.keys(OFFERS) as [string, ...string[]]),
});

// Changement de formule en libre-service (Classique <-> Premium, mensuel <-> annuel).
// Stripe calcule l'ajustement au prorata ; le webhook met ensuite les dates à jour.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Non autorisé" }, 401);
    const userId = claims.claims.sub;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Requête invalide" }, 400);
    const target = OFFERS[parsed.data.priceId];

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, status, plan, billing_cycle, environment, stripe_subscription_id, subscription_offices(user_id)")
      .eq("id", parsed.data.subscriptionId)
      .maybeSingle();
    if (!sub) return json({ error: "Souscription introuvable" }, 404);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const ownerId = (sub.subscription_offices as unknown as { user_id: string | null })?.user_id ?? null;
    if (!isAdmin && ownerId !== userId) return json({ error: "Non autorisé" }, 403);

    if (sub.plan === target.plan && sub.billing_cycle === target.cycle) {
      return json({ error: "Vous êtes déjà sur cette formule." }, 400);
    }
    const changeable = ["active", "paid_pending_validation", "activation_requested", "cancel_at_period_end"];
    if (!changeable.includes(sub.status)) {
      return json({ error: "Le changement de formule n'est pas possible dans l'état actuel de l'abonnement." }, 400);
    }
    if (!sub.stripe_subscription_id) {
      return json({ error: "Aucun abonnement Stripe associé." }, 400);
    }

    const stripe = createStripeClient(sub.environment as "sandbox" | "live");
    const prices = await stripe.prices.list({ lookup_keys: [parsed.data.priceId], limit: 1 });
    if (!prices.data.length) return json({ error: "Tarif introuvable" }, 400);

    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = current.items.data[0]?.id;
    if (!itemId) return json({ error: "Abonnement Stripe incomplet" }, 400);

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: prices.data[0].id }],
      proration_behavior: "create_prorations",
      // Un changement de formule annule une résiliation programmée.
      cancel_at_period_end: false,
    });

    await supabase
      .from("subscriptions")
      .update({
        plan: target.plan,
        billing_cycle: target.cycle,
        stripe_price_id: parsed.data.priceId,
        ...(sub.status === "cancel_at_period_end" ? { status: "active" } : {}),
      })
      .eq("id", sub.id);

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("subscription-change-plan error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
