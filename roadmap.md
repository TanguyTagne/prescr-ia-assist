# Roadmap — Tunnel de souscription Asclion

- [x] Produits/prix Stripe (classic/premium, mensuel/annuel, setup fee 99 €)
- [x] Schéma DB : subscription_offices, subscriptions, subscription_events, subscription_notes + RLS
- [x] Fonctions serveur : create-subscription-checkout, payments-webhook (signé, idempotent), subscription-admin-actions, subscription-cancel, subscription-annual-reminder
- [x] Pages : /souscrire (3 étapes), /merci, /compte (résiliation mensuelle)
- [x] Onglet admin Souscriptions (liste, fiche, actions, suivis J+14/J+30, notes)
- [x] CTA VSL → /souscrire?source=vsl&utm_campaign=vsl
- [x] Rappel annuel J-30 planifié (cron quotidien, secret interne)
- [x] Documentation d'exploitation (docs/SOUSCRIPTIONS.md)
- [x] TVA : adresse + numéro de TVA intracommunautaire collectés au checkout
- [x] Annuel reconduit automatiquement (prix récurrents) + rappel J-30
- [x] Portail de facturation client (carte, factures) depuis /compte
- [x] Coupure d'accès automatique en fin réelle d'abonnement
- [x] Rapprochement officine par SIRET, recherche de compte sans limite de 200
- [ ] Go-live paiements : finaliser dans l'onglet Payments (compte live), puis test carte 4242
