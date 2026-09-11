import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  subscriptionId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { subscriptionId } = parsed.data;

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*, subscription_offices(user_id)")
      .eq("id", subscriptionId)
      .single();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Souscription introuvable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const ownerId = (sub.subscription_offices as unknown as { user_id: string | null }).user_id;
    if (!isAdmin && ownerId !== userId) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (sub.billing_cycle === "annual") {
      return new Response(JSON.stringify({ error: "L'offre annuelle ne se renouvelle pas automatiquement : elle expire à l'échéance, sans résiliation anticipée remboursable." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sub.stripe_subscription_id) {
      await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscriptionId);
      return new Response(JSON.stringify({ success: true, status: "cancelled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = createStripeClient(sub.environment as "sandbox" | "live");
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });

    await supabase.from("subscriptions").update({ status: "cancel_at_period_end" }).eq("id", subscriptionId);

    const item = updated.items?.data?.[0];
    const periodEnd = item?.current_period_end ?? (updated as unknown as { current_period_end?: number }).current_period_end;

    return new Response(JSON.stringify({
      success: true,
      status: "cancel_at_period_end",
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("subscription-cancel error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
