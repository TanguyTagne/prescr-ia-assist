// Envoi d'e-mails transactionnels liés aux souscriptions, via Resend.

const RESEND_API_KEY = () => {
  const v = Deno.env.get("RESEND_API_KEY");
  if (!v) throw new Error("RESEND_API_KEY is not configured");
  return v;
};

// Expéditeur : domaine vérifié dans Resend si configuré, sinon bac à sable.
const FROM = Deno.env.get("RESEND_FROM") ?? "Asclion <onboarding@resend.dev>";
// En bac à sable Resend, tous les envois sont redirigés vers cette adresse.
const OVERRIDE_TO = Deno.env.get("RESEND_OVERRIDE_TO") ?? "";

export type SubscriptionEmailKind =
  | "payment_confirmed"
  | "sepa_pending"
  | "account_setup"
  | "account_activated"
  | "payment_failed"
  | "cancellation_confirmed"
  | "annual_reminder"
  | "annual_renewal_confirmed"
  | "subscription_expired"
  | "abandoned_cart"
  | "credentials";

export interface SubscriptionEmailContext {
  officeName: string;
  contactFirstName: string;
  planLabel: string;
  cycleLabel: string;
  extraHtml?: string;
  actionUrl?: string;
  actionLabel?: string;
  loginEmail?: string;
  tempPassword?: string;
}

const TITLES: Record<SubscriptionEmailKind, string> = {
  payment_confirmed: "Paiement confirmé",
  sepa_pending: "Prélèvement en cours de confirmation",
  account_setup: "Votre compte Asclion est prêt à être configuré",
  account_activated: "Votre compte Asclion est activé",
  payment_failed: "Échec d'échéance",
  cancellation_confirmed: "Résiliation prise en compte",
  annual_reminder: "Reconduction de votre abonnement annuel dans 30 jours",
  annual_renewal_confirmed: "Renouvellement confirmé",
  subscription_expired: "Votre offre Asclion est arrivée à expiration",
  abandoned_cart: "Votre souscription Asclion n'est pas finalisée",
  credentials: "Vos identifiants Asclion",
};

const BODIES: Record<SubscriptionEmailKind, (c: SubscriptionEmailContext) => string> = {
  payment_confirmed: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre paiement pour <strong>${c.planLabel}</strong> (${c.cycleLabel}) est confirmé pour <strong>${c.officeName}</strong>.<br><br>Votre compte est en cours de création : vous recevrez sous 24 à 48 h un e-mail avec votre lien de définition de mot de passe, la vidéo d'installation et le bloc de validation.`,
  sepa_pending: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre prélèvement SEPA pour <strong>${c.planLabel}</strong> (${c.cycleLabel}) est en cours de confirmation par votre banque (quelques jours ouvrés).<br><br>Votre compte sera créé automatiquement dès la confirmation finale du paiement.`,
  account_setup: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre compte Asclion pour <strong>${c.officeName}</strong> est prêt. Définissez votre mot de passe grâce au lien sécurisé ci-dessous (valable 24 h), puis suivez la vidéo d'installation et le bloc de validation.`,
  account_activated: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre compte Asclion pour <strong>${c.officeName}</strong> est désormais activé. Votre équipe peut utiliser le copilote de conseil associé sur l'ensemble de l'officine.`,
  payment_failed: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>l'échéance de votre offre <strong>${c.planLabel}</strong> n'a pas pu être prélevée. Le prélèvement sera retenté automatiquement ; pensez à vérifier votre moyen de paiement.`,
  cancellation_confirmed: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre demande de résiliation est prise en compte. Votre accès reste actif jusqu'à la fin de la période déjà payée (${c.cycleLabel}).`,
  annual_reminder: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre offre annuelle <strong>${c.planLabel}</strong> arrive à échéance dans 30 jours. Elle n'est pas reconduite automatiquement : pour continuer, il suffit de reprendre une offre depuis votre espace « Mon abonnement ». Sans action de votre part, l'accès se ferme à la date d'échéance.`,
  annual_renewal_confirmed: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre renouvellement <strong>${c.planLabel}</strong> (${c.cycleLabel}) est confirmé. Merci de votre confiance.`,
  subscription_expired: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre offre <strong>${c.planLabel}</strong> pour <strong>${c.officeName}</strong> a pris fin et l'accès de votre équipe est désormais fermé. Aucun nouveau débit n'aura lieu. Pour reprendre Asclion, contactez-nous.`,
  abandoned_cart: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>votre souscription Asclion pour <strong>${c.officeName}</strong> (${c.planLabel} — ${c.cycleLabel}) a été commencée mais le paiement n'a pas été finalisé.<br><br>Vous pouvez reprendre là où vous en étiez en un clic. Si vous avez une question sur la compatibilité avec votre LGO ou votre robot, répondez simplement à cet e-mail.`,
  credentials: (c) =>
    `Bonjour ${c.contactFirstName},<br><br>voici vos identifiants Asclion pour <strong>${c.officeName}</strong> :<br><br>` +
    `<strong>Identifiant :</strong> ${c.loginEmail ?? ""}<br><strong>Mot de passe provisoire :</strong> ${c.tempPassword ?? ""}<br><br>` +
    `Connectez-vous puis modifiez ce mot de passe dès votre première connexion depuis la page « Mon compte ». Ne transmettez ce message à personne.`,
};

const SUBJECTS: Record<SubscriptionEmailKind, (c: SubscriptionEmailContext) => string> = {
  payment_confirmed: () => "Asclion — paiement confirmé, activation sous 24–48 h",
  sepa_pending: () => "Asclion — prélèvement en cours de confirmation",
  account_setup: () => "Asclion — définissez votre mot de passe",
  account_activated: () => "Asclion — votre compte est activé",
  payment_failed: () => "Asclion — échec d'échéance, action requise",
  cancellation_confirmed: () => "Asclion — résiliation prise en compte",
  annual_reminder: () => "Asclion — reconduction annuelle dans 30 jours",
  annual_renewal_confirmed: () => "Asclion — renouvellement confirmé",
  subscription_expired: () => "Asclion — votre offre a expiré",
  abandoned_cart: () => "Asclion — votre souscription n'est pas finalisée",
  credentials: () => "Asclion — vos identifiants de connexion",
};

export async function sendSubscriptionEmail(
  to: string,
  kind: SubscriptionEmailKind,
  ctx: SubscriptionEmailContext,
): Promise<void> {
  const button = ctx.actionUrl && ctx.actionLabel
    ? `<p style="margin:24px 0"><a href="${ctx.actionUrl}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${ctx.actionLabel}</a></p>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;background:#ffffff;padding:32px;max-width:560px;margin:0 auto;color:#1f2937">
      <div style="font-size:18px;font-weight:700;margin-bottom:16px">Asclion</div>
      <h1 style="font-size:20px;margin:0 0 12px">${TITLES[kind]}</h1>
      <p style="font-size:14px;line-height:1.6">${BODIES[kind](ctx)}</p>
      ${ctx.extraHtml ?? ""}
      ${button}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="font-size:11px;color:#9ca3af">Asclion — copilote de conseil associé pour l'officine. Prix affichés HT, TVA en sus selon la réglementation en vigueur. Abonnement mensuel reconduit automatiquement, résiliable à tout moment avec effet à la fin de la période payée. Offre annuelle : paiement unique pour 12 mois, sans reconduction automatique, sans remboursement au prorata.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: OVERRIDE_TO || to,
      subject: OVERRIDE_TO && OVERRIDE_TO !== to
        ? `${SUBJECTS[kind](ctx)} [destinataire réel : ${to}]`
        : SUBJECTS[kind](ctx),
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}
