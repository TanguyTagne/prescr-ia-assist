// Création / suspension du compte officine.
// Point d'entrée unique : jamais appelé depuis le navigateur, uniquement
// depuis le webhook Stripe signé ou une action admin authentifiée.

import { sendSubscriptionEmail, type SubscriptionEmailKind } from "./subscriptionEmail.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

const PLAN_LABEL: Record<string, string> = { classic: "Asclion Classique", premium: "Asclion Premium" };
const CYCLE_LABEL: Record<string, string> = { monthly: "abonnement mensuel", annual: "abonnement annuel" };

export function planLabel(plan: string) {
  return PLAN_LABEL[plan] ?? plan;
}
export function cycleLabel(cycle: string) {
  return CYCLE_LABEL[cycle] ?? cycle;
}

/** Recherche un utilisateur auth par e-mail, sans limite de 200 comptes. */
export async function findUserIdByEmail(supabase: Db, email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u: { email?: string }) => (u.email || "").toLowerCase() === needle);
    if (found) return found.id;
    if (users.length < 1000) return null;
  }
  return null;
}

export async function emailContext(supabase: Db, subscriptionId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, billing_cycle, subscription_offices(office_name, contact_first_name, contact_email)")
    .eq("id", subscriptionId)
    .single();
  if (!data) return null;
  const office = data.subscription_offices as {
    office_name: string;
    contact_first_name: string;
    contact_email: string;
  };
  return {
    email: office.contact_email,
    ctx: {
      officeName: office.office_name,
      contactFirstName: office.contact_first_name,
      planLabel: planLabel(data.plan),
      cycleLabel: cycleLabel(data.billing_cycle),
    },
  };
}

/** Envoi d'e-mail tolérant à la panne : n'interrompt jamais un webhook. */
export async function sendSafely(
  supabase: Db,
  subscriptionId: string,
  kind: SubscriptionEmailKind,
  extra?: { actionUrl?: string; actionLabel?: string },
) {
  try {
    const info = await emailContext(supabase, subscriptionId);
    if (!info) return;
    await sendSubscriptionEmail(info.email, kind, { ...info.ctx, ...extra });
  } catch (e) {
    console.error(`email ${kind} failed:`, e);
  }
}

/**
 * Crée le compte Asclion après paiement réellement confirmé.
 * Idempotent : ne refait ni compte ni e-mail si la souscription est déjà payée.
 */
export async function provisionAccount(supabase: Db, subscriptionId: string): Promise<void> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, status, office_id, subscription_offices(*)")
    .eq("id", subscriptionId)
    .single();
  if (!sub) return;

  const provisionable = ["checkout_started", "payment_pending", "payment_issue"];
  if (!provisionable.includes(sub.status)) return;

  const office = sub.subscription_offices as Record<string, unknown>;
  const email = String(office.contact_email);
  const fullName = `${office.contact_first_name} ${office.contact_last_name}`;

  // 1. Pharmacie — rapprochement par SIRET (fiable), jamais par nom.
  let pharmacyId = (office.pharmacy_id as string | null) ?? null;
  const siret = (office.siret as string | null) || null;

  if (!pharmacyId && siret) {
    const { data: sameSiret } = await supabase
      .from("subscription_offices")
      .select("pharmacy_id")
      .eq("siret", siret)
      .not("pharmacy_id", "is", null)
      .limit(1)
      .maybeSingle();
    pharmacyId = sameSiret?.pharmacy_id ?? null;
  }

  if (!pharmacyId) {
    const { data: created, error } = await supabase
      .from("pharmacies")
      .insert({ name: office.office_name as string, status: "paused" })
      .select("id")
      .single();
    if (error) throw error;
    pharmacyId = created.id;
  }

  // 2. Utilisateur auth (réutilisé s'il existe déjà).
  let userId = (office.user_id as string | null) ?? null;
  if (!userId) {
    userId = await findUserIdByEmail(supabase, email);
    if (!userId) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw error;
      userId = created.user.id;
    }

    await supabase.from("profiles").update({ pharmacy_id: pharmacyId, full_name: fullName }).eq("id", userId);

    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "preparateur" });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) throw roleErr;
  }

  await supabase
    .from("subscription_offices")
    .update({ pharmacy_id: pharmacyId, user_id: userId })
    .eq("id", sub.office_id);

  await supabase
    .from("subscriptions")
    .update({ status: "paid_pending_validation", paid_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  // 3. Lien sécurisé de définition de mot de passe (aucun mot de passe en clair).
  const origin = Deno.env.get("PUBLIC_SITE_URL") || "https://www.asclion.com";
  const { data: link } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/reset-password` },
  });

  await sendSafely(supabase, subscriptionId, "payment_confirmed");
  const actionUrl = link?.properties?.action_link;
  if (actionUrl) {
    await sendSafely(supabase, subscriptionId, "account_setup", {
      actionUrl,
      actionLabel: "Définir mon mot de passe",
    });
  }
}

/**
 * Coupe l'accès applicatif de l'officine rattachée à une souscription.
 * Utilisé quand l'abonnement s'arrête réellement (résiliation arrivée à terme,
 * impayé définitif après les relances Stripe, expiration annuelle).
 */
export async function suspendAccess(supabase: Db, subscriptionId: string): Promise<void> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("office_id, subscription_offices(pharmacy_id)")
    .eq("id", subscriptionId)
    .maybeSingle();
  const pharmacyId = (sub?.subscription_offices as { pharmacy_id: string | null } | null)?.pharmacy_id;
  if (!pharmacyId) return;
  await supabase.from("pharmacies").update({ status: "paused" }).eq("id", pharmacyId);
}
