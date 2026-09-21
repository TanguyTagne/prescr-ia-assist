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
- [x] E-mails transactionnels : bienvenue + credentials, récap paiement annuel, relance panier abandonné (`subscription-abandoned-cart`, cron quotidien 9h15, 1 relance max par souscription)
- [x] Textes e-mail alignés : annuel = paiement unique sans reconduction automatique
- [x] Admin : filtres statut/recherche, colonne robot, badge `compatibility_review`

## Étape 4 — Mesure & conformité
- [x] Analytics de conversion sans cookies (événements serveur : vues, lecture VSL, soumissions)
- [x] Recette pages publiques (`/`, `/presentation`, `/tarifs`, `/fonctionnalites`, `/demo`, `/compatibilite-robot`, `/vs-lgo`, `/souscrire`, `/cgv`, `/aide`) : rendu OK, titres/H1 uniques, pas d'erreur console bloquante
- [ ] Recette paiements réels (carte, SEPA, annuel) à faire par l'administrateur sur le site publié

## Corrections SEO multilingues
- [x] Traduire intégralement les pages d’accueil et fonctionnalités en anglais, métadonnées comprises
- [x] Retirer `/en/blog` du sitemap et des liens de langue tant qu’une version anglaise indexable n’existe pas
- [x] Aligner la page Fonctionnalités sur le produit actuel : scan médicament/CIP, produits complémentaires, sans analyse d’ordonnance ni vigilance affichée
- [x] Documenter la validation professionnelle requise pour les affirmations cliniques des articles
