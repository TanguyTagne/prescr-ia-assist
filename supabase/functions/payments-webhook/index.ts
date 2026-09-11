import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import { provisionAccount, sendSafely, suspendAccess } from "../_shared/provisionAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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
  const { error } = await getSupabase().from("subscription_events").insert({
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

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);


  if (await alreadyProcessed(event.id)) return; // doublon : ignoré

  try {
    await routeEvent(event, env);
  } catch (e) {
    // Le verrou d'idempotence est libéré pour que Stripe puisse réessayer.
    await getSupabase().from("subscription_events").delete().eq("stripe_event_id", event.id);
    throw e;
  }
}

async function routeEvent(event: { id: string; type: string; data: { object: unknown } }, env: StripeEnv) {
  const supabase = getSupabase();

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

  const findByStripeSub = async (stripeSubId: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, status, billing_cycle, activated_at")
      .eq("stripe_subscription_id", stripeSubId)
      .eq("environment", env)
      .maybeSingle();
    return data ?? null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      linkedSubscriptionId = await findBySession(obj.id as string);
      if (!linkedSubscriptionId) break;

      const paymentStatus = obj.payment_status as string;
      await supabase.from("subscriptions").update({
        stripe_subscription_id: (obj.subscription as string) || null,
        stripe_payment_intent_id: (obj.payment_intent as string) || null,
        stripe_invoice_id: (obj.invoice as string) || null,
        ...(paymentStatus === "unpaid" ? { status: "payment_pending" } : {}),
      }).eq("id", linkedSubscriptionId);

      if (paymentStatus === "unpaid") {
        // SEPA en cours de traitement : aucune création de compte.
        await sendSafely(supabase, linkedSubscriptionId, "sepa_pending");
      } else {
        await provisionAccount(supabase, linkedSubscriptionId);
      }
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      linkedSubscriptionId = await findBySession(obj.id as string);
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({
          stripe_payment_intent_id: (obj.payment_intent as string) || null,
        }).eq("id", linkedSubscriptionId);
        await provisionAccount(supabase, linkedSubscriptionId);
      }
      break;
    }

    case "checkout.session.async_payment_failed": {
      linkedSubscriptionId = await findBySession(obj.id as string);
      if (linkedSubscriptionId) {
        await supabase.from("subscriptions").update({ status: "payment_issue" }).eq("id", linkedSubscriptionId);
        await sendSafely(supabase, linkedSubscriptionId, "payment_failed");
      }
      break;
    }

    case "invoice.paid": {
      const stripeSubId = obj.subscription as string;
      if (!stripeSubId) break;
      const row = await findByStripeSub(stripeSubId);
      linkedSubscriptionId = row?.id ?? null;
      if (!linkedSubscriptionId) break;

      const line = (obj.lines as { data?: Array<{ period?: { start?: number; end?: number } }> })?.data?.[0];
      const periodStart = ts(line?.period?.start);
      const periodEnd = ts(line?.period?.end);

      if (row!.status === "payment_pending") {
        // SEPA initial confirmé → création du compte.
        await supabase.from("subscriptions").update({
          stripe_invoice_id: obj.id as string,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        }).eq("id", linkedSubscriptionId);
        await provisionAccount(supabase, linkedSubscriptionId);
      } else {
        // Renouvellement réussi (mensuel ou annuel).
        const recovered = row!.status === "payment_issue";
        await supabase.from("subscriptions").update({
          stripe_invoice_id: obj.id as string,
          status: recovered ? "active" : row!.status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        }).eq("id", linkedSubscriptionId);

        // Rétablissement de l'accès après régularisation d'un impayé,
        // uniquement si le compte avait déjà été activé par l'admin.
        if (recovered && row!.activated_at) {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("subscription_offices(pharmacy_id)")
            .eq("id", linkedSubscriptionId)
            .maybeSingle();
          const pharmacyId = (sub?.subscription_offices as { pharmacy_id: string | null } | null)?.pharmacy_id;
          if (pharmacyId) await supabase.from("pharmacies").update({ status: "active" }).eq("id", pharmacyId);
        }

        if (row!.billing_cycle === "annual") {
          await sendSafely(supabase, linkedSubscriptionId, "annual_renewal_confirmed");
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const stripeSubId = obj.subscription as string;
      if (!stripeSubId) break;
      const row = await findByStripeSub(stripeSubId);
      linkedSubscriptionId = row?.id ?? null;
      if (linkedSubscriptionId) {
        // Accès maintenu pendant les relances automatiques de Stripe :
        // la coupure n'intervient qu'à l'échec définitif (subscription.deleted / unpaid).
        await supabase.from("subscriptions").update({
          status: "payment_issue",
          stripe_invoice_id: obj.id as string,
        }).eq("id", linkedSubscriptionId);
        await sendSafely(supabase, linkedSubscriptionId, "payment_failed");
      }
      break;
    }

    case "customer.subscription.updated": {
      const row = await findByStripeSub(obj.id as string);
      linkedSubscriptionId = row?.id ?? null;
      if (!linkedSubscriptionId) break;

      const item = (obj.items as { data?: Array<{ current_period_start?: number; current_period_end?: number }> })?.data?.[0];
      const cancelAtPeriodEnd = obj.cancel_at_period_end === true;
      const stripeStatus = obj.status as string;

      let status = row!.status;
      if (cancelAtPeriodEnd) status = "cancel_at_period_end";
      else if (stripeStatus === "active" && status === "cancel_at_period_end") status = "active";
      else if (stripeStatus === "past_due") status = "payment_issue";

      await supabase.from("subscriptions").update({
        status,
        current_period_start: ts(item?.current_period_start ?? obj.current_period_start),
        current_period_end: ts(item?.current_period_end ?? obj.current_period_end),
      }).eq("id", linkedSubscriptionId);

      // Échec définitif après épuisement des relances Stripe → coupure d'accès.
      if (stripeStatus === "unpaid") {
        await suspendAccess(supabase, linkedSubscriptionId);
      }
      if (cancelAtPeriodEnd && row!.status !== "cancel_at_period_end") {
        await sendSafely(supabase, linkedSubscriptionId, "cancellation_confirmed");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const row = await findByStripeSub(obj.id as string);
      linkedSubscriptionId = row?.id ?? null;
      if (!linkedSubscriptionId) break;

      // Fin réelle de l'abonnement : résiliation arrivée à terme, impayé
      // définitif, ou année non renouvelée. L'accès est coupé maintenant.
      const endedByFailure = obj.status === "unpaid" || obj.status === "incomplete_expired";
      await supabase.from("subscriptions").update({
        status: row!.billing_cycle === "annual" && !endedByFailure ? "expired" : "cancelled",
        current_period_end: ts(obj.ended_at ?? obj.canceled_at) ?? undefined,
      }).eq("id", linkedSubscriptionId);
      await suspendAccess(supabase, linkedSubscriptionId);
      await sendSafely(supabase, linkedSubscriptionId, "subscription_expired");
      break;
    }

    default:
      console.log("Unhandled event:", event.type);
  }

  await markProcessed(event.id, event.type, linkedSubscriptionId, obj);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

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
    console.error("payments-webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
