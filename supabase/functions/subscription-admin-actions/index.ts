import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { sendSubscriptionEmail } from "../_shared/subscriptionEmail.ts";
import { cycleLabel, planLabel, provisionAccount, suspendAccess } from "../_shared/provisionAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(["activate", "suspend", "mark_transfer_paid", "send_reminder", "add_note", "save_office"]),
  note: z.string().max(2000).optional(),
  office: z.object({
    validation_completed_at: z.string().nullable().optional(),
    training_at: z.string().nullable().optional(),
    followup_d14_at: z.string().nullable().optional(),
    followup_d30_at: z.string().nullable().optional(),
  }).optional(),
});

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

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: claims.claims.sub, _role: "admin" });
    if (!isAdmin) return json({ error: "Accès admin requis" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { subscriptionId, action, note, office } = parsed.data;

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*, subscription_offices(*)")
      .eq("id", subscriptionId)
      .single();
    if (subErr || !sub) return json({ error: "Souscription introuvable" }, 404);

    const officeRow = sub.subscription_offices as unknown as Record<string, unknown>;
    const sendTo = async (
      kind: Parameters<typeof sendSubscriptionEmail>[1],
      extra?: { actionUrl?: string; actionLabel?: string },
    ) => {
      try {
        await sendSubscriptionEmail(officeRow.contact_email as string, kind, {
          officeName: officeRow.office_name as string,
          contactFirstName: officeRow.contact_first_name as string,
          planLabel: planLabel(sub.plan),
          cycleLabel: cycleLabel(sub.billing_cycle),
          ...extra,
        });
      } catch (e) {
        console.error("email failed:", e);
      }
    };

    switch (action) {
      case "activate": {
        if (sub.status !== "paid_pending_validation" && sub.status !== "activation_requested") {
          return json({ error: "Statut incompatible avec une activation" }, 400);
        }
        await supabase
          .from("subscriptions")
          .update({ status: "active", activated_at: new Date().toISOString() })
          .eq("id", subscriptionId);
        if (officeRow.pharmacy_id) {
          await supabase.from("pharmacies").update({ status: "active" }).eq("id", officeRow.pharmacy_id as string);
        }
        await sendTo("account_activated");
        break;
      }

      case "suspend": {
        await supabase.from("subscriptions").update({ status: "payment_issue" }).eq("id", subscriptionId);
        await suspendAccess(supabase, subscriptionId);
        break;
      }

      case "mark_transfer_paid": {
        if (!["checkout_started", "payment_pending", "payment_issue"].includes(sub.status)) {
          return json({ error: "Statut incompatible" }, 400);
        }
        // Virement rapproché manuellement → même chemin serveur qu'un paiement Stripe confirmé.
        await provisionAccount(supabase, subscriptionId);
        break;
      }

      case "send_reminder": {
        await sendTo("annual_reminder");
        await supabase
          .from("subscription_offices")
          .update({ followup_d30_at: new Date().toISOString() })
          .eq("id", sub.office_id);
        break;
      }

      case "add_note": {
        if (!note) return json({ error: "Note requise" }, 400);
        await supabase
          .from("subscription_notes")
          .insert({ subscription_id: subscriptionId, author_id: claims.claims.sub, note });
        break;
      }

      case "save_office": {
        if (office) await supabase.from("subscription_offices").update(office).eq("id", sub.office_id);
        if (sub.status === "paid_pending_validation" && office?.validation_completed_at) {
          await supabase.from("subscriptions").update({ status: "activation_requested" }).eq("id", subscriptionId);
        }
        break;
      }
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error("subscription-admin-actions error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
