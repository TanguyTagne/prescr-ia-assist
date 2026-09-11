import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import { sendSubscriptionEmail } from "../_shared/subscriptionEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const PLAN_LABEL: Record<string, string> = { classic: "Asclion Classique", premium: "Asclion Premium" };
const CYCLE_LABEL: Record<string, string> = { monthly: "abonnement mensuel", annual: "offre annuelle" };

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

function ts(seconds: unknown): string | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function alreadyProcessed(stripeEventId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("subscription_events").insert({
    stripe_event_id: stripeEventId,
    event_type: "pending",
  });
  // Violation de contrainte unique = événement déjà traité.
  return !!error;
}

async function markProcessed(stripeEventId: string, eventType: string, subscriptionId: string | null, payload: unknown) {
  await getSupabase()
    .from("subscription_events")
    .update({ event_type: eventType, subscription_id: subscriptionId, payload })
    .eq("stripe_event_id", stripeEventId);
}

async function emailCtx(subscriptionId: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, billing_cycle, subscription_offices(office_name, contact_first_name, contact_email)")
    .eq("id", subscriptionId)
    .single();
  if (!data) return null;
  const office = data.subscription_offices as unknown as { office_name: string; contact_first_name: string; contact_email: string };
  return {
    email: office.contact_email,
    ctx: {
      officeName: office.office_name,
      contactFirstName: office.contact_first_name,
      planLabel: PLAN_LABEL[data.plan] ?? data.plan,
      cycleLabel: CYCLE_LABEL[data.billing_cycle] ?? data.billing_cycle,
    },
  };
}

async function sendSafely(subscriptionId: string, kind: Parameters<typeof sendSubscriptionEmail>[1], extra?: { actionUrl?: string; actionLabel?: string }) {
  try {
    const info = await emailCtx(subscriptionId);
    if (!info) return;
    await sendSubscriptionEmail(info.email, kind, { ...info.ctx, ...extra });
  } catch (e) {
    console.error(`email ${kind} failed:`, e);
  }
}

// Création du compte Asclion — jamais déclenchée depuis le navigateur,
// uniquement ici, après paiement réellement confirmé par Stripe.
async function activateFromPayment(subscriptionId: string) {
  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, status, office_id, subscription_offices(*)")
    .eq("id", subscriptionId)
    .single();
  if (!sub) return;

  // Idempotence : déjà créé → on ne refait ni compte ni e-mail.
  if (sub.status !== "payment_pending" && sub.status !== "checkout_started" && sub.status !== "payment_issue") return;

  const office = sub.subscription_offices as unknown as Record<string, unknown>;

  // 1. Pharmacie (par SIRET, sinon création).
  let pharmacyId = office.pharmacy_id as string | null;
  if (!pharmacyId) {
    const { data: existingPharmacy } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("name", office.office_name as string)
      .maybeSingle();
    if (existingPharmacy) {
      pharmacyId = existingPharmacy.id;
    } else {
      const { data: created, error } = await supabase
        .from("pharmacies")
        .insert({ name: office.office_name as string, status: "active" })
        .select("id")
        .single();
      if (error) throw error;
      pharmacyId = created.id;
    }
  }

  // 2. Utilisateur auth (réutilisé s'il existe déjà).
  const email = office.contact_email as string;
  const fullName = `${office.contact_first_name} ${office.contact_last_name}`;
  let userId = office.user_id as string | null;

  if (!userId) {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw error;
      userId = created.user.id;
    }

    await supabase
      .from("profiles")
      .update({ pharmacy_id: pharmacyId, full_name: fullName })
      .eq("id", userId);

    await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "preparateur" })
      .then(({ error }) => {
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      });
  }

  await supabase
    .from("subscription_offices")
    .update({ pharmacy_id: pharmacyId, user_id: userId })
    .eq("id", sub.office_id);

  await supabase
    .from("subscriptions")
    .update({ status: "paid_pending_validation", paid_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  // 3. E-mail avec lien sécurisé de définition de mot de passe (aucun mot de passe en clair).
  const origin = Deno.env.get("PUBLIC_SITE_URL") || "https://www.asclion.com";
  const { data: link } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/reset-password` },
  });
  const actionUrl = link?.properties?.action_link;

  await sendSafely(subscriptionId, "payment_confirmed");
  if (actionUrl) {
    await sendSafely(subscriptionId, "account_setup", { actionUrl, actionLabel: "Définir mon mot de passe" });
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const supabase = getSupabase();

  if (await alreadyProcessed(event.id)) {
    return; // doublon : ignoré silencieusement
  }

  const obj = event.data.object as Record<string, unknown>;
  let linkedSubscriptionId: string | null = null;

  const findBySession = async (sessionId: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_checkout_session_id", sessionId)
      .eq("environment", env)
      .maybeSingle();
    return data?.id ?? null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const sessionId = obj.id as string;
      linkedSubscriptionId = await findBySession(sessionId);
      if (!linkedSubscriptionId) break;

      const paymentStatus = obj.payment_status as string;
      await supabase.from("subscriptions").update({
        stripe_subscription_id: (obj.subscription as string) || null,
        stripe_payment_intent_id: (obj.payment_intent as string) || null,
        stripe_invoice_id: (obj.invoice as string) || null,
        status: paymentStatus === "unpaid" ? "payment_pending" : undefined,
      }).eq("id", linkedSubscriptionId).then(async ({ error }) => {
        if (error) throw error;
        if (paymentStatus === "unpaid") {
          await supabase.from("subscriptions").update({ status: "payment_pending" }).eq("id", linkedSubscriptionId);
        }
      });

      if (paymentStatus === "unpaid") {
        // SEPA : en cours de traitement, aucune création de compte.
        await sendSafely(linkedSubscriptionId, "sepa_pending");
      } else {
        await activateFromPayment(linkedSubscriptionId);
      }
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      const sessionId = obj.id as string;
      linkedSubscriptionId = await findBySession(sessionId);
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({
          stripe_payment_intent_id: (obj.payment_intent as string) || null,
        }).eq("id", linkedSubscriptionId);
        await activateFromPayment(linkedSubscriptionId);
      }
      break;
    }

    case "checkout.session.async_payment_failed": {
      const sessionId = obj.id as string;
      linkedSubscriptionId = await findBySession(sessionId);
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({ status: "payment_issue" }).eq("id", linkedSubscriptionId);
        await sendSafely(linkedSubscriptionId, "payment_failed");
      }
      break;
    }

    case "invoice.paid": {
      const stripeSubId = obj.subscription as string;
      if (!stripeSubId) break;
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("stripe_subscription_id", stripeSubId)
        .eq("environment", env)
        .maybeSingle();
      linkedSubscriptionId = data?.id ?? null;
      if (!linkedSubscriptionId) break;

      const periodStart = ts((obj.lines as { data?: Array<{ period?: { start?: number; end?: number } }> })?.data?.[0]?.period?.start);
      const periodEnd = ts((obj.lines as { data?: Array<{ period?: { start?: number; end?: number } }> })?.data?.[0]?.period?.end);

      if (data!.status === "payment_pending") {
        // SEPA initial confirmé → création du compte.
        await supabase.from("subscriptions").update({
          stripe_invoice_id: obj.id as string,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        }).eq("id", linkedSubscriptionId);
        await activateFromPayment(linkedSubscriptionId);
      } else {
        // Renouvellement mensuel réussi.
        await supabase.from("subscriptions").update({
          stripe_invoice_id: obj.id as string,
          status: data!.status === "payment_issue" ? "active" : data!.status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        }).eq("id", linkedSubscriptionId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const stripeSubId = obj.subscription as string;
      if (!stripeSubId) break;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeSubId)
        .eq("environment", env)
        .maybeSingle();
      linkedSubscriptionId = data?.id ?? null;
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({
          status: "payment_issue",
          stripe_invoice_id: obj.id as string,
        }).eq("id", linkedSubscriptionId);
        await sendSafely(linkedSubscriptionId, "payment_failed");
      }
      break;
    }

    case "customer.subscription.updated": {
      const stripeSubId = obj.id as string;
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("stripe_subscription_id", stripeSubId)
        .eq("environment", env)
        .maybeSingle();
      linkedSubscriptionId = data?.id ?? null;
      if (!linkedSubscriptionId) break;

      const item = (obj.items as { data?: Array<{ current_period_start?: number; current_period_end?: number }> })?.data?.[0];
      const cancelAtPeriodEnd = obj.cancel_at_period_end === true;
      const stripeStatus = obj.status as string;

      let status = data!.status;
      if (cancelAtPeriodEnd) status = "cancel_at_period_end";
      else if (stripeStatus === "active" && status === "cancel_at_period_end") status = "active";
      else if (stripeStatus === "past_due") status = "payment_issue";

      await supabase.from("subscriptions").update({
        status,
        current_period_start: ts(item?.current_period_start ?? obj.current_period_start),
        current_period_end: ts(item?.current_period_end ?? obj.current_period_end),
      }).eq("id", linkedSubscriptionId);

      if (cancelAtPeriodEnd) await sendSafely(linkedSubscriptionId, "cancellation_confirmed");
      break;
    }

    case "customer.subscription.deleted":
    case "subscription.canceled": {
      const stripeSubId = obj.id as string;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeSubId)
        .eq("environment", env)
        .maybeSingle();
      linkedSubscriptionId = data?.id ?? null;
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", linkedSubscriptionId);
      }
      break;
    }

    // Alias normalisés éventuels de la passerelle de paiement.
    case "subscription.created":
    case "subscription.updated": {
      const stripeSubId = obj.id as string;
      const officeId = (obj.metadata as Record<string, string> | undefined)?.office_id;
      const plan = (obj.metadata as Record<string, string> | undefined)?.plan as "classic" | "premium" | undefined;
      const cycle = (obj.metadata as Record<string, string> | undefined)?.billing_cycle as "monthly" | "annual" | undefined;
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("stripe_subscription_id", stripeSubId)
        .eq("environment", env)
        .maybeSingle();
      linkedSubscriptionId = existing?.id ?? null;
      if (!linkedSubscriptionId && officeId && plan && cycle) {
        const { data: created } = await supabase.from("subscriptions").insert({
          office_id: officeId, plan, billing_cycle: cycle,
          status: "payment_pending", stripe_subscription_id: stripeSubId,
          stripe_price_id: plan === "classic" ? "asclion_classic_monthly" : "asclion_premium_monthly",
          environment: env,
        }).select("id").single();
        linkedSubscriptionId = created?.id ?? null;
      }
      break;
    }

    case "transaction.completed":
    case "transaction.payment_failed": {
      const stripeSubId = (obj.subscription_id as string) || null;
      if (stripeSubId) {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("stripe_subscription_id", stripeSubId)
          .eq("environment", env)
          .maybeSingle();
        linkedSubscriptionId = data?.id ?? null;
        if (linkedSubscriptionId) {
          if (event.type === "transaction.completed") {
            if (data!.status === "payment_pending" || data!.status === "checkout_started") {
              await activateFromPayment(linkedSubscriptionId);
            }
          } else {
            await supabase.from("subscriptions").update({ status: "payment_issue" }).eq("id", linkedSubscriptionId);
            await sendSafely(linkedSubscriptionId, "payment_failed");
          }
        }
      }
      break;
    }

    default:
      console.log("Unhandled event:", event.type);
  }

  await markProcessed(event.id, event.type, linkedSubscriptionId, obj);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-subscription-webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
