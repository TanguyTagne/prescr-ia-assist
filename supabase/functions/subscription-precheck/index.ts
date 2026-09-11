import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  siret: z.string().min(9).max(20).optional(),
  email: z.string().email().max(200).optional(),
});

const LIVE_STATUSES = [
  "payment_pending",
  "paid_pending_validation",
  "activation_requested",
  "active",
  "payment_issue",
  "cancel_at_period_end",
];

// Signale (sans bloquer) qu'une souscription est déjà en cours pour cette
// officine. Ne renvoie qu'un booléen : aucune donnée client n'est exposée.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ existing: false }, 200);
    const { siret, email } = parsed.data;
    if (!siret && !email) return json({ existing: false }, 200);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const filters: string[] = [];
    if (siret) filters.push(`siret.eq.${siret.replace(/[^0-9]/g, "")}`);
    if (email) filters.push(`contact_email.eq.${email.trim().toLowerCase()}`);

    const { data: offices } = await supabase
      .from("subscription_offices")
      .select("id")
      .or(filters.join(","))
      .limit(20);

    const officeIds = (offices ?? []).map((o: { id: string }) => o.id);
    if (officeIds.length === 0) return json({ existing: false }, 200);

    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("office_id", officeIds)
      .in("status", LIVE_STATUSES);

    return json({ existing: (count ?? 0) > 0 }, 200);
  } catch (e) {
    console.error("subscription-precheck error:", e);
    // Ne jamais bloquer une souscription à cause de cette vérification.
    return json({ existing: false }, 200);
  }
});
