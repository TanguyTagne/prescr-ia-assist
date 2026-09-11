# Tunnel de souscription Asclion

Objectif : une page publique `/souscrire` qui vend les 4 offres, encaisse via Stripe, et crée automatiquement la fiche officine côté administration — uniquement quand le paiement est réellement confirmé.

## 1. Paiement

Activation des paiements intégrés Lovable (Stripe) : aucun compte Stripe à créer de votre côté. Une fenêtre d'inscription courte s'ouvrira (e-mail, nom, société) à valider.

Offres créées dans Stripe :

| Offre | Type | Prix HT |
|---|---|---|
| Classique mensuel | abonnement | 99 €/mois + 99 € de mise en place (une fois) |
| Premium mensuel | abonnement | 149 €/mois + 99 € de mise en place (une fois) |
| Classique annuel | paiement unique | 990 € (mise en place offerte) |
| Premium annuel | paiement unique | 1 490 € (mise en place offerte) |

Moyens de paiement : carte pour tout, prélèvement SEPA sur les offres mensuelles. Le virement reste manuel (bouton « marquer virement payé » côté admin). Aucun renouvellement automatique sur l'annuel.

## 2. Page /souscrire

Étape 1 — les 4 offres en cartes, l'annuel mis en avant avec badge « Recommandé » et l'économie affichée (297 € / 397 € la première année), prix HT avec mention TVA.

Étape 2 — formulaire officine : nom, raison sociale, SIRET, adresse de facturation, titulaire (nom, prénom, e-mail pro), téléphone, nombre de caisses, robot de délivrance (oui/non + marque et modèle), acceptation CGV et confidentialité, consentement au paiement récurrent pour le mensuel.

Étape 3 — redirection vers la page de paiement Stripe, préremplie.

La source d'acquisition (`?source=vsl&utm_campaign=...`) est lue et enregistrée. Le bouton final de la VSL pointe vers `/souscrire?source=vsl`.

Page `/merci` : message « Paiement reçu… activation sous 24 à 48 h », et message distinct « prélèvement en cours de confirmation » pour un SEPA non encore validé.

## 3. Création de compte (côté serveur uniquement)

Un webhook Stripe signé traite : paiement confirmé, paiement unique réussi, facture payée, facture échouée, abonnement modifié, abonnement supprimé. Traitement idempotent (un même événement reçu deux fois ne crée jamais deux comptes ni deux e-mails).

À la confirmation du paiement : création (ou récupération par SIRET) de l'officine, du contact titulaire, de la souscription, statut `paid_pending_validation`, apparition dans l'administration, puis e-mail contenant lien de définition de mot de passe, vidéo d'installation et bloc de validation. Aucun mot de passe en clair.

Statuts gérés : `checkout_started`, `payment_pending`, `paid_pending_validation`, `activation_requested`, `active`, `payment_issue`, `cancel_at_period_end`, `expired`, `cancelled`.

## 4. Administration « Souscriptions »

Nouvel onglet avec la liste (officine, contact, offre, mensuel/annuel, statut, date de paiement, activation, source, robot déclaré, prochaine échéance, suivis J+14 / J+30) et actions rapides : ouvrir, relancer, activer, suspendre, marquer virement payé.

Fiche officine : facturation et SIRET, références Stripe et lien vers le tableau de bord Stripe, historique des paiements, bloc de validation, vérification robot, checklist d'installation, rendez-vous formation, notes internes, source marketing.

## 5. Résiliation

Mensuel : résiliable à tout moment depuis un espace client, effet à la fin de la période payée. Annuel : pas de renouvellement automatique, rappel à J-30 avec demande de confirmation, nouveau lien de paiement si accord, sinon `expired` à l'échéance. **Aucun remboursement en cas de résiliation annuelle anticipée** — règle reprise à l'identique sur la page de paiement, dans les CGV et les e-mails.

## 6. E-mails (via Resend, déjà en place)

Paiement confirmé · SEPA en attente · informations de compte et installation · compte activé · échéance échouée · résiliation prise en compte · rappel annuel J-30 · renouvellement confirmé · compte expiré.

## Détails techniques

- Tables : `subscription_offices` (facturation, SIRET, robot, source), `subscriptions` (plan, cycle, statut, `stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_invoice_id`, `stripe_price_id`, périodes, suivis J+14/J+30), `subscription_events` (idempotence par `event_id`), `subscription_notes`. RLS : lecture/écriture admin uniquement, écriture serveur via service role ; insertion publique interdite.
- Edge functions : `create-subscription-checkout` (validation Zod, crée l'officine en `checkout_started`), `stripe-subscription-webhook` (`verify_jwt = false`, vérification de signature, insertion idempotente dans `subscription_events` avant traitement), `subscription-admin-actions` (activer, suspendre, marquer virement payé, relancer), `subscription-cancel` (portail client), `send-subscription-email` (modèles Resend), `subscription-annual-reminder` (cron J-30).
- Comptes utilisateurs : réutilisation du flux existant `create-pharmacy-account` côté serveur, avec lien de définition de mot de passe généré (`generateLink` type recovery) — jamais de mot de passe transmis.
- Front : `src/pages/Souscrire.tsx`, `src/pages/Merci.tsx`, `src/pages/Compte.tsx` (résiliation), `src/components/admin/SubscriptionsTab.tsx` + `SubscriptionDetailDialog.tsx`, routes FR/EN ajoutées dans `App.tsx` en `lazyWithRetry`, textes dans `translations.ts`.
- Séquence de livraison : paiements Stripe → schéma + RLS → checkout + `/souscrire` + `/merci` → webhook + création de compte → onglet admin → e-mails → portail de résiliation + rappel annuel → note d'exploitation courte (changer un prix, relancer une activation, traiter un virement).
