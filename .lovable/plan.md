# Refonte conversion Asclion.com — Plan par étapes

## Objectif
Modifier le site public et le tunnel de souscription pour qu'un pharmacien titulaire comprenne, sans rendez-vous obligatoire, ce qu'est Asclion, ce que cela change au comptoir, pourquoi c'est pertinent, combien cela coûte, ce qui se passe après le paiement, et comment acheter / demander une démo / vérifier la compatibilité robot.

## Validation reçue
- Le chiffre pilote « +500 € de CA mensuel observé sur une caisse » peut être publié, avec l'encadré méthodologique.
- Les vidéos (30 s accueil + VSL finale) existent mais leur lien/chemin n'a pas encore été fourni.
- Le texte sur la compatibilité robot (marques connues, délai de réponse) n'a pas encore été fourni.
- Le périmètre est « tout, en étapes ».

## Étape 1 — Fondations et pages publiques
1. Design system : reprendre les couleurs du logo (vert/turquoise médical), fonds blancs très légèrement teintés, texte anthracite. Cartes coins doux, ombres discrètes, typographie sans-serif lisible AA, mobile-first.
2. Navigation desktop : logo Asclion à gauche, liens Fonctionnement / Résultats / Tarifs / Blog / Aide, Se connecter discret, bouton « Choisir mon offre ».
3. Refonte `/` :
   - Hero : H1 « Le conseil associé, au bon moment. Sans changer de LGO. », sous-titre, CTAs « Voir Asclion en 45 secondes » et « Choisir mon offre », réassurance prix/activation, placeholder vidéo 30 s.
   - Bloc problème (3 cartes).
   - Bloc fonctionnement (3 étapes + lien).
   - Bénéfices patient/officine (2 colonnes).
   - Preuve pilote avec encadré méthodologique (pas de page étude de cas pour l'instant).
   - Aperçu offres Classique/Premium.
   - FAQ courte avec liens.
   - CTA final.
4. Page `/presentation` : lecteur VSL 16:9, sous-titres FR activables, transcript HTML, CTA principal/secondaire, FAQ paiement/robots/activation/résiliation.
5. Page `/fonctionnalites` : scan → vigilance → suggestion → phrase conseil → retour équipe → Premium (audit stock). Captures produit validées, simulation interactive, disclaimer clinique, CTA tarifs.
6. Page `/vs-lgo` : réécriture factuelle, tableau comparatif LGO vs Asclion, schéma de cohabitation, limites robots, CTA fonctionnement.
7. Page `/aide` : FAQ scindée Avant de souscrire / Déjà client.
8. Redirections 301 si besoin (actuel `/fonctionnalites` existe déjà, donc aucun renommage ici).

## Étape 2 — Tarifs et tunnel de souscription
1. Page `/tarifs` :
   - Cartes Classique/Premium + bascule Mensuel/Annuel.
   - Montant dû aujourd'hui, mise en place, renouvellement, économies première année.
   - Tableau comparatif de contenu.
   - Boutons « Choisir Classique/Premium » → `/souscrire?plan=...` en conservant source/UTM.
2. Page `/souscrire` :
   - Étape 1 : récap offre, vrais radios/boutons accessibles, retour possible.
   - Étape 2 : données facturation, SIRET, contact admin, robot oui/non avec blocage paiement si robot (compatibilité à vérifier), cases CGV/confidentialité, consentement mensuel, acceptation annuel 12 mois.
   - Étape 3 : Stripe Checkout `subscription` mensuel (récurrent + setup fee), `payment` annuel unique, carte/SEPA/virement.
   - Étape 4 : `/merci` avec messages carte confirmée vs SEPA en attente.
3. Page `/compatibilite-robot` : formulaire qualification avant achat, statut `compatibility_review` côté admin.
4. Page `/demo` : formulaire court démo 15 min, source tracking.
5. Webhooks Stripe : signés, idempotents, création compte uniquement après paiement final, pas de doublon SIRET/e-mail.

## Étape 3 — Comptes, e-mails et admin
1. Statuts : `checkout_started`, `compatibility_review`, `payment_pending`, `paid_pending_validation`, `activation_requested`, `active`, `payment_issue`, `cancel_at_period_end`, `expired`, `cancelled`.
2. Création compte : organisation via SIRET, utilisateur admin sans doublon, souscription locale, `paid_pending_validation`, lien sécurisé définition mot de passe, vidéo installation.
3. E-mails transactionnels : confirmation paiement, SEPA en attente, création compte, activation, échéance échouée, résiliation, rappel annuel J-30, compte expiré.
4. Admin onglet Souscriptions : fiche officine, contact, formule, statut, source, dates, robot, échéance, suivis J+14/J+30, références Stripe, notes, actions relance/activation/suspension.

## Étape 4 — CGV, tracking, SEO, recette
1. Page `/cgv` distincte de CGU avec les clauses du brief.
2. Tracking respectueux : `landing_view`, VSL progress, `pricing_view`, début formulaire, compatibilité robot, checkout, paiement confirmé côté serveur, activation, J+14/J+30, résiliation.
3. SEO : H1 uniques, liens `/fonctionnalites`, JSON-LD, sitemap.
4. Recette : tests clavier, mobile, paiement test, webhook, pas de compte créé sans paiement.

## Livrables
1. Pages publiques responsive.
2. Tunnel tarifs → souscrire → merci.
3. Webhooks + provisioning compte.
4. Admin Souscriptions enrichi.
5. CGV + tracking + recette.

## Questions en attente
- Lien ou chemin de la vidéo 30 s pour l'accueil.
- Lien ou chemin de la VSL finale pour `/presentation`.
- Texte exact à afficher pour la compatibilité robot (marques, délai).
