# Roadmap — Refonte conversion asclion.com

## Étape 1 — Fondation publique
- [x] SiteHeader marketing (nav Fonctionnement/Résultats/Tarifs/Blog/Aide) + variante checkout
- [x] Landing `/` refaite : positionnement overlay LGO, CTA « Voir Asclion en 45 s », vidéo muette, preuve pilote + méthode
- [x] `/presentation` : VSL muette, tracking 25/50/75/100, CTA achat + démo, FAQ paiement/robot/activation/résiliation
- [x] `/fonctionnalites` rendue publique (retrait du ProtectedRoute)
- [x] `/vs-lgo` tableau factuel + comportement en cohabitation
- [x] Footer : liens Fonctionnement, Tarifs, CGV ajoutés

## Étape 2 — Tunnel d'achat
- [x] `/tarifs` : toggle mensuel/annuel, prix HT, économies chiffrées, tableau comparatif
- [x] `/souscrire` : pré-sélection via `?plan=`, annuel = paiement unique (mode payment, sans renouvellement), consentements distincts par cycle
- [x] Robot : blocage serveur — pas de session Stripe, souscription en `compatibility_review`, bouton « Envoyer la demande de compatibilité »
- [x] `/compatibilite-robot` + `/demo` : formulaires avec notification admin + tracking
- [x] Prix Stripe annuels convertis en paiement unique (classic 990 €, premium 1 490 €)
- [x] Enum `subscription_status` + valeur `compatibility_review`

## Étape 3 — Post-paiement
- [x] CGV rédigées (`/cgv`, brouillon à faire relire)
- [ ] E-mails transactionnels : bienvenue + credentials (existant), récap paiement annuel (webhook ok), relance panier abandonné
- [ ] Admin : filtres/statuts souscriptions à enrichir (afficher compatibility_review distinctement)

## Étape 4 — Mesure & conformité
- [ ] Analytics de conversion sans cookies (événements serveur déjà en place : vues, lecture VSL, soumissions)
- [ ] Test de recette : parcours clavier, mobile, SEPA, annuel, robot
