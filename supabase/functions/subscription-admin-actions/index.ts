import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { sendSubscriptionEmail } from "../_shared/subscriptionEmail.ts";

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

const PLAN_LABEL: Record<string, string> = { classic: "Asclion Classique", premium: "Asclion Premium" };
const CYCLE_LABEL: Record<string, string> = { monthly: "abonnement mensuel", annual: "offre annuelle" };

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
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: claims.claims.sub, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès admin requis" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { subscriptionId, action, note, office } = parsed.data;

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*, subscription_offices(*)")
      .eq("id", subscriptionId)
      .single();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Souscription introuvable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const officeRow = sub.subscription_offices as unknown as Record<string, unknown>;
    const emailPayload = {
      officeName: officeRow.office_name as string,
      contactFirstName: officeRow.contact_first_name as string,
      planLabel: PLAN_LABEL[sub.plan] ?? sub.plan,
      cycleLabel: CYCLE_LABEL[sub.billing_cycle] ?? sub.billing_cycle,
    };
    const sendTo = async (kind: Parameters<typeof sendSubscriptionEmail>[1], extra?: { actionUrl?: string; actionLabel?: string }) => {
      try {
        await sendSubscriptionEmail(officeRow.contact_email as string, kind, { ...emailPayload, ...extra });
      } catch (e) {
        console.error("email failed:", e);
      }
    };

    switch (action) {
      case "activate": {
        if (sub.status !== "paid_pending_validation" && sub.status !== "activation_requested") {
          return new Response(JSON.stringify({ error: "Statut incompatible avec une activation" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabase.from("subscriptions").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", subscriptionId);
        if (officeRow.pharmacy_id) await supabase.from("pharmacies").update({ status: "active" }).eq("id", officeRow.pharmacy_id as string);
        await sendTo("account_activated");
        break;
      }
      case "suspend": {
        await supabase.from("subscriptions").update({ status: "payment_issue" }).eq("id", subscriptionId);
        if (officeRow.pharmacy_id) {
          await supabase.from("pharmacies").update({ status: "paused" }).eq("id", officeRow.pharmacy_id as string);
        }
        break;
      }
      case "mark_transfer_paid": {
        if (sub.status !== "checkout_started" && sub.status !== "payment_pending" && sub.status !== "payment_issue") {
          return new Response(JSON.stringify({ error: "Statut incompatible" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Virement rapproché manuellement → même flux qu'un paiement confirmé.
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "paid_pending_validation", paid_at: new Date().toISOString() })
          .eq("id", subscriptionId);
        if (error) throw error;
        // Création du compte via le même chemin serveur que le webhook.
        const origin = Deno.env.get("PUBLIC_SITE_URL") || "https://www.asclion.com";
        // Réutilisation minimale : on déclenche la création via un appel interne.
        await sendTo("payment_confirmed");
        // Le compte est créé ici directement (mêmes règles que le webhook).
        const email = officeRow.contact_email as string;
        let userId = officeRow.user_id as string | null;
        let pharmacyId = officeRow.pharmacy_id as string | null;
        if (!pharmacyId) {
          const { data: ph } = await supabase.from("pharmacies").select("id").eq("name", officeRow.office_name as string).maybeSingle();
          if (ph) pharmacyId = ph.id;
          else {
            const { data: created, error: cErr } = await supabase.from("pharmacies").insert({ name: officeRow.office_name as string, status: "paused" }).select("id").single();
            if (cErr) throw cErr;
            pharmacyId = created.id;
          }
        }
        if (!userId) {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
          if (existing) userId = existing.id;
          else {
            const { data: created, error: cErr } = await supabase.auth.admin.createUser({
              email, email_confirm: true,
              user_metadata: { full_name: `${officeRow.contact_first_name} ${officeRow.contact_last_name}` },
            });
            if (cErr) throw cErr;
            userId = created.user.id;
          }
          await supabase.from("profiles").update({ pharmacy_id: pharmacyId, full_name: `${officeRow.contact_first_name} ${officeRow.contact_last_name}` }).eq("id", userId);
          await supabase.from("user_roles").insert({ user_id: userId, role: "preparateur" }).then(({ error }) => {
            if (error && !/duplicate|unique/i.test(error.message)) throw error;
          });
        }
        await supabase.from("subscription_offices").update({ pharmacy_id: pharmacyId, user_id: userId }).eq("id", sub.office_id);
        const { data: link } = await supabase.auth.admin.generateLink({
          type: "recovery", email, options: { redirectTo: `${origin}/reset-password` },
        });
        if (link?.properties?.action_link) {
          await sendTo("account_setup", { actionUrl: link.properties.action_link, actionLabel: "Définir mon mot de passe" });
        }
        break;
      }
      case "send_reminder": {
        await sendTo("annual_reminder");
        await supabase.from("subscription_offices").update({ followup_d30_at: new Date().toISOString() }).eq("id", sub.office_id);
        break;
      }
      case "add_note": {
        if (!note) {
          return new Response(JSON.stringify({ error: "Note requise" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabase.from("subscription_notes").insert({ subscription_id: subscriptionId, author_id: claims.claims.sub, note });
        break;
      }
      case "save_office": {
        if (office) {
          await supabase.from("subscription_offices").update(office).eq("id", sub.office_id);
        }
        if (sub.status === "paid_pending_validation" && office?.validation_completed_at) {
          await supabase.from("subscriptions").update({ status: "activation_requested" }).eq("id", subscriptionId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("subscription-admin-actions error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
