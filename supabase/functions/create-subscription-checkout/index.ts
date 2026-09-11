import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_OFFER: Record<string, { plan: "classic" | "premium"; cycle: "monthly" | "annual" }> = {
  asclion_classic_monthly: { plan: "classic", cycle: "monthly" },
  asclion_premium_monthly: { plan: "premium", cycle: "monthly" },
  asclion_classic_yearly: { plan: "classic", cycle: "annual" },
  asclion_premium_yearly: { plan: "premium", cycle: "annual" },
};

const BodySchema = z.object({
  priceId: z.enum(["asclion_classic_monthly", "asclion_premium_monthly", "asclion_classic_yearly", "asclion_premium_yearly"]),
  environment: z.enum(["sandbox", "live"]),
  office: z.object({
    officeName: z.string().min(1).max(200),
    billingName: z.string().max(200).optional().default(""),
    siret: z.string().min(9).max(14),
    billingAddress: z.string().min(1).max(500),
    contactFirstName: z.string().min(1).max(100),
    contactLastName: z.string().min(1).max(100),
    contactEmail: z.string().email(),
    contactPhone: z.string().max(30).optional().default(""),
    registersCount: z.number().int().min(1).max(50).optional().nullable(),
    robotDeclared: z.boolean(),
    robotBrand: z.string().max(100).optional().default(""),
    robotModel: z.string().max(100).optional().default(""),
    source: z.string().max(100).optional().default(""),
    utmCampaign: z.string().max(100).optional().default(""),
    acceptedTerms: z.literal(true),
    acceptedRecurring: z.boolean().optional(),
  }),
  returnUrl: z.string().url().max(500),
});

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { priceId, environment, office, returnUrl } = parsed.data;
    const env: StripeEnv = environment;
    const offer = PRICE_TO_OFFER[priceId];

    // Les deux cycles sont désormais des abonnements reconduits automatiquement :
    // le consentement au paiement récurrent est obligatoire dans les deux cas.
    if (!office.acceptedRecurring) {
      return new Response(JSON.stringify({ error: "Consentement au paiement récurrent requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Réutilise une fiche officine existante (même SIRET ou même e-mail).
    let officeId: string;
    const { data: existing } = await supabase
      .from("subscription_offices")
      .select("id")
      .or(`siret.eq.${office.siret},contact_email.eq.${office.contactEmail.toLowerCase()}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const officePayload = {
      office_name: office.officeName,
      billing_name: office.billingName || office.officeName,
      siret: office.siret,
      billing_address: office.billingAddress,
      contact_first_name: office.contactFirstName,
      contact_last_name: office.contactLastName,
      contact_email: office.contactEmail.toLowerCase(),
      contact_phone: office.contactPhone,
      registers_count: office.registersCount ?? null,
      robot_declared: office.robotDeclared,
      robot_brand: office.robotDeclared ? office.robotBrand : null,
      robot_model: office.robotDeclared ? office.robotModel : null,
      source: office.source || null,
      utm_campaign: office.utmCampaign || null,
    };

    if (existing) {
      officeId = existing.id;
      await supabase.from("subscription_offices").update(officePayload).eq("id", officeId);
    } else {
      const { data: created, error } = await supabase
        .from("subscription_offices")
        .insert(officePayload)
        .select("id")
        .single();
      if (error) throw error;
      officeId = created.id;
    }

    const stripe = createStripeClient(env);

    // Client Stripe réutilisé par e-mail.
    const existingCustomers = await stripe.customers.list({ email: office.contactEmail.toLowerCase(), limit: 1 });
    let customerId: string;
    if (existingCustomers.data.length) {
      customerId = existingCustomers.data[0].id;
    } else {
      const created = await stripe.customers.create({
        email: office.contactEmail.toLowerCase(),
        name: office.billingName || office.officeName,
        metadata: { siret: office.siret, office_id: officeId },
      });
      customerId = created.id;
    }

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    const stripePrice = prices.data[0];
    if (!stripePrice) throw new Error("Price not found");

    const metadata = {
      office_id: officeId,
      plan: offer.plan,
      billing_cycle: offer.cycle,
      source: office.source || "",
      robot_declared: office.robotDeclared ? "true" : "false",
    };

    const lineItems: Array<{ price: string; quantity: number }> = [{ price: stripePrice.id, quantity: 1 }];

    // Frais de mise en place : mensuel uniquement, offerts sur l'annuel.
    if (offer.cycle === "monthly") {
      const setupPrices = await stripe.prices.list({ lookup_keys: ["asclion_setup_fee"] });
      const setupPrice = setupPrices.data[0];
      if (!setupPrice) throw new Error("Setup price not found");
      lineItems.push({ price: setupPrice.id, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      payment_method_types: ["card", "sepa_debit"],
      // TVA : adresse obligatoire, numéro de TVA intracommunautaire facultatif,
      // et enregistrement de l'adresse saisie sur la fiche client Stripe
      // (indispensable au calcul automatique de la taxe).
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      automatic_tax: { enabled: true },
      line_items: lineItems,
      metadata,
      subscription_data: { metadata },
    });

    const { error: subErr } = await supabase.from("subscriptions").insert({
      office_id: officeId,
      plan: offer.plan,
      billing_cycle: offer.cycle,
      status: "checkout_started",
      setup_fee_charged: offer.cycle === "monthly",
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      stripe_price_id: priceId,
      environment: env,
    });
    if (subErr) throw subErr;

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-subscription-checkout error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
