# Souscriptions Asclion — documentation d'exploitation

## Parcours

1. **VSL** → CTA final ouvre `/souscrire?source=vsl&utm_campaign=vsl` (la source est enregistrée sur la fiche officine).
2. **`/souscrire`** : 3 étapes — choix de l'offre, informations de l'officine, paiement Stripe intégré (aucune donnée de carte ne transite par nos serveurs).
3. **Paiement confirmé par Stripe (webhook signé, idempotent)** → création du compte, statut `paid_pending_validation`, e-mails « paiement confirmé » + « lien de définition de mot de passe ». La pharmacie est créée en pause : aucun accès avant validation admin.
4. **Admin → onglet Souscriptions → Activer** → statut `active`, pharmacie activée, e-mail « compte activé ». Cible : 24–48 h.
5. **`/merci`** : simple confirmation (ne crée ni n'active rien). Message distinct si SEPA en attente.
6. **`/compte`** : le client voit son abonnement et peut résilier le mensuel (effet en fin de période payée).

## Règle de sécurité fondamentale

Le navigateur ne crée jamais de compte. Seul le webhook `payments-webhook` (signature HMAC vérifiée, événements dédupliqués par `subscription_events.stripe_event_id`) déclenche la création :

- carte : `checkout.session.completed` avec `payment_status != "unpaid"` ;
- SEPA (mensuel uniquement) : attente de `checkout.session.async_payment_succeeded` / `invoice.paid` — aucun accès tant que le prélèvement est « en cours » ;
- virement sur facture : action admin « Marquer virement payé » (même flux serveur ensuite).

## Offres et prix (HT)

| Price ID | Type | Montant |
|---|---|---|
| `asclion_classic_monthly` | récurrent mensuel | 99 € HT/mois |
| `asclion_premium_monthly` | récurrent mensuel | 149 € HT/mois |
| `asclion_setup_fee` | unique | 99 € HT (mensuels uniquement) |
| `asclion_classic_yearly` | récurrent annuel | 990 € HT/an |
| `asclion_premium_yearly` | récurrent annuel | 1 490 € HT/an |

- Mensuel : Checkout en mode abonnement, carte + SEPA, prix récurrent + frais de mise en place. Premier mois facturé : 198 € HT (Classique) / 248 € HT (Premium).
- Annuel : abonnement reconduit automatiquement chaque année, carte ou SEPA, **mise en place offerte**. Rappel d'information envoyé à J-30 avant chaque reconduction.
- Résiliation (les deux cycles) : effet à la fin de la période déjà payée, sans remboursement au prorata (règle à reporter dans les CGV).
- TVA : adresse de facturation obligatoire et numéro de TVA intracommunautaire facultatif collectés dans le checkout ; la taxe est calculée automatiquement.
- Espace client `/compte` : bouton « Gérer ma carte et mes factures » (portail de facturation Stripe) et résiliation en un clic.
- Coupure d'accès automatique : l'officine repasse en pause à la fin réelle de l'abonnement (résiliation arrivée à terme, échec de paiement définitif après les relances Stripe, expiration). Pendant les relances, l'accès est maintenu.
- Prix affichés HT ; la TVA s'affiche selon le régime fiscal réel dans le checkout Stripe.

## Statuts

`checkout_started` → `payment_pending` (SEPA) → `paid_pending_validation` → `activation_requested` → `active` ; incidents : `payment_issue` ; fin : `cancel_at_period_end` → `cancelled` (mensuel), `expired` (annuel non renouvelé).

## Automatisations

- **Webhook** `payments-webhook?env=sandbox|live` : checkout complété, paiements asynchrones SEPA, factures payées/échouées, abonnement mis à jour/supprimé.
- **Cron quotidien 7h30** `subscription-annual-reminder` : rappel J-30 avant échéance annuelle + passage à `expired` des offres annuelles échues.
- **E-mails (Resend)** : paiement confirmé, SEPA en attente, création de compte (lien mot de passe), activation, échec de paiement, résiliation mensuelle, rappel annuel, renouvellement annuel, expiration. Textes modifiables dans `supabase/functions/_shared/subscriptionEmail.ts`.

## Dashboard admin (onglet Souscriptions)

Liste (officine, offre, statut, source marketing, échéance, env test/live) + fiche détaillée : infos officine, robot de délivrance, IDs Stripe, historique des événements de paiement, actions Activer / Suspendre / Marquer virement payé / Envoyer rappel annuel, suivis J+14 et J+30, notes internes.

## Mise en production

1. Finaliser la mise en service des paiements dans l'onglet Payments (compte live).
2. Les produits/prix sont synchronisés automatiquement à la publication — ne jamais recréer un ID existant.
3. Tester en preview avec la carte `4242 4242 4242 4242` ; vérifier la fiche créée dans Admin → Souscriptions.


## Espace client `/compte`

- Accessible même quand l'officine est en pause (paiement reçu mais activation non encore faite, abonnement terminé) : le client peut suivre son statut, gérer sa facturation et resouscrire. L'outil clinique, lui, reste fermé tant que l'officine n'est pas active.
- Bandeau « activation en cours » tant que l'admin n'a pas activé l'officine.
- Changement de formule en libre-service (Classique <-> Premium, mensuel <-> annuel) : effet immédiat, ajustement au prorata calculé par Stripe (`subscription-change-plan`). Un changement de formule annule une résiliation programmée.
- Fin d'abonnement : l'officine repasse en pause, les données sont conservées, un bouton « Souscrire à nouveau » est proposé.

## Doublons

`subscription-precheck` signale, avant le paiement, qu'une souscription vivante existe déjà pour le même SIRET ou le même e-mail. L'avertissement n'est pas bloquant (cas d'une seconde officine). Les paniers abandonnés (`checkout_started`) ne déclenchent pas l'alerte.

## Idempotence des webhooks

Chaque événement Stripe est verrouillé par son identifiant dans `subscription_events`. Si le traitement échoue, le verrou est libéré pour que la relance automatique de Stripe puisse rejouer l'événement.
