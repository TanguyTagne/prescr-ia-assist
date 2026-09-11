# Roadmap — tunnel de souscription Asclion

- [ ] Créer les produits/prix Stripe (classique mensuel 99€, premium mensuel 149€, mise en place 99€, classique annuel 990€, premium annuel 1490€)
- [ ] Migration : tables subscription_offices, subscriptions (statuts), subscription_events (idempotence), subscription_notes + RLS
- [ ] _shared/stripe.ts (createStripeClient + verifyWebhook)
- [ ] Edge : create-subscription-checkout (mensuel = abonnement + frais de mise en place ; annuel = paiement unique, mise en place offerte)
- [ ] Edge : stripe-subscription-webhook (source de vérité, SEPA en attente, création compte + email lien mot de passe)
- [ ] Edge : subscription-admin-actions, subscription-cancel, subscription-annual-reminder
- [ ] Pages /souscrire, /merci, /compte + routes + banner test mode
- [ ] Onglet admin Souscriptions + fiche officine
- [ ] CTA VSL → /souscrire?source=vsl
- [ ] E-mails Resend (9 modèles)
- [ ] Doc d'exploitation courte
