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
  returnUrl: z.string().url().max(500).optional(),
});

// Portail de facturation Stripe : changement de carte, factures, historique.
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
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, environment, subscription_offices(user_id)")
      .eq("id", parsed.data.subscriptionId)
      .maybeSingle();
    if (!sub) return json({ error: "Souscription introuvable" }, 404);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const ownerId = (sub.subscription_offices as unknown as { user_id: string | null })?.user_id ?? null;
    if (!isAdmin && ownerId !== userId) return json({ error: "Non autorisé" }, 403);

    if (!sub.stripe_customer_id) return json({ error: "Aucun dossier de facturation associé" }, 400);

    const stripe = createStripeClient(sub.environment as "sandbox" | "live");
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(parsed.data.returnUrl && { return_url: parsed.data.returnUrl }),
    });

    return json({ url: portal.url }, 200);
  } catch (e) {
    console.error("subscription-portal error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
