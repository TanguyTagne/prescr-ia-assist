
# Refonte de la landing "Grand Slam Offer" façon Hormozi

## Diagnostic actuel (pourquoi ça ne convertit pas)

- **Promesse floue** : "Augmentez votre panier moyen, sans sacrifier le conseil" → aucun chiffre, aucun délai, aucune preuve. Le cerveau du titulaire ne visualise rien.
- **Aucun risque retiré** : rien ne rassure le visiteur. Pas de garantie, pas d'essai, pas de "sans CB".
- **Aucune preuve sociale visible above the fold** : ton meilleur asset (+880€ le 1er mois avec 1 client sur 5) n'apparaît nulle part.
- **CTA générique** : "Demander une démo" — verbe faible, aucun bénéfice.
- **Formulaire lourd** : 6 champs (pharmacie, contact, email, tel, ville, LGO) + case consentement. Sur mobile c'est un mur. Hormozi : chaque champ = -10% de conversion.
- **Section "referral"** avant le formulaire = distraction.
- **Zéro urgence / scarcity** : rien ne pousse à agir maintenant.

## L'équation de valeur (Hormozi)

Valeur perçue = (Rêve × Probabilité de réussite) ÷ (Temps × Effort)

On va **maximiser les 2 du haut** (résultat chiffré + preuve) et **minimiser les 2 du bas** (installation en X min, zéro effort équipe).

## Ce qui change concrètement sur `src/pages/Landing.tsx`

### 1. Hero réécrit — promesse chiffrée + preuve immédiate

- **Nouveau badge** : `⚡ 1 pharmacie testée · +880 € de CA en 30 jours`
- **Nouveau H1** :
  > "Ajoutez **+800 à +2 000 € de CA/mois** à votre officine — sans embaucher, sans changer de LGO, sans effort supplémentaire au comptoir."
- **Sous-titre** orienté douleur → solution :
  > "Vos préparateurs délivrent l'ordonnance, notre IA suggère en 2 secondes le produit associé pertinent (déjà en stock). Résultat : +1 vente sur 5 patients, panier moyen qui décolle."
- **CTA principal** : `Réserver ma démo (15 min) →`
- **CTA secondaire** : `Voir la garantie` (scroll ancre)
- **Trust bar sous le CTA** : `✓ Compatible Winpharma, LGPI, Pharmagest   ✓ Installation en 24 h   ✓ RGPD & HDS`
- Le `GainSimulator` reste à droite (déjà excellent — c'est notre "démonstration de valeur").

### 2. Nouvelle section "Preuve" (juste après le hero)

Une carte plein cadre :
> **« +880 € de chiffre d'affaires additionnel sur le 1er mois, avec 1 patient sur 5 qui repart avec le produit conseillé. »**
> — Pharmacie pilote, avril 2026

Avec 3 KPI en dessous :
- `+880 €` CA additionnel · 1er mois
- `1/5` patients acceptent le conseil
- `< 2 sec` latence par ordonnance

### 3. Nouvelle section "Offre" (le cœur Hormozi — "Stack de valeur")

Titre : **"Ce que vous obtenez en rejoignant Asclion aujourd'hui"**

Liste visuelle avec valeur perçue chiffrée en face de chaque item (barrée puis "inclus") :

```text
✓ Copilote IA Asclion (licence illimitée, tous postes)      ~ 199 €/mois
✓ Installation & connexion à votre LGO par nos équipes       ~ 490 €
✓ Formation de votre équipe (visio 30 min)                   ~ 190 €
✓ Base de 4 000+ correspondances médicaments → conseils      ~ inclus
✓ Support prioritaire (réponse < 4h ouvrées)                 ~ 90 €/mois
✓ Mises à jour cliniques mensuelles                          ~ inclus
─────────────────────────────────────────────────────────────
Valeur totale : ~ 970 € + 289 €/mois
Votre tarif pilote : sur devis (transparent, pas de surprise)
```

### 4. Nouvelle section "Garantie" — le levier n°1

Encadré très visible, badge "Garantie" :

> ### Notre garantie "Résultat ou remboursé"
> Si Asclion ne vous génère pas **au moins l'équivalent de son coût en CA additionnel dès le 2ᵉ mois**, on vous rembourse intégralement. Sans discussion.
>
> *On peut se le permettre : nos pharmacies pilotes font en moyenne +800 €/mois dès le premier mois.*

(Le montant exact du seuil sera ajustable — je te propose de commencer par "au moins l'équivalent de son coût". On pourra passer à "+500€/mois ou remboursé" plus tard quand tu auras 5 pharmas actives.)

### 5. Nouvelle section "À qui c'est destiné" (qualification)

> **Asclion est fait pour vous si :**
> ✓ Vous êtes titulaire d'une officine (indépendante ou groupement)
> ✓ Vous voulez augmenter votre CA sans sacrifier la qualité du conseil
> ✓ Vous êtes équipé Winpharma, LGPI, Pharmagest, Smart Rx, LGO, Périphar…
>
> **Ce n'est PAS pour vous si :**
> ✗ Vous cherchez uniquement à écouler du stock (Asclion ne recommande QUE ce qui est cliniquement pertinent)
> ✗ Vous n'avez pas de scanner de médicaments au comptoir

Ce paragraphe augmente paradoxalement la conversion : il crée l'auto-sélection et renforce la crédibilité.

### 6. Urgence / scarcity honnête

Bandeau juste au-dessus du formulaire :
> ⏱ **Places pilotes limitées** — nous accompagnons personnellement chaque pharmacie sur les 30 premiers jours. Nous acceptons **3 nouvelles pharmacies par mois** pour garantir la qualité de l'onboarding.

### 7. Formulaire réduit — friction divisée

Passe de **6 champs → 3 champs** au premier écran :
- Nom de la pharmacie
- Email
- Téléphone (optionnel affiché "recommandé — rappel sous 24 h")

Les champs contact_name / city / lgo_type deviennent facultatifs, révélés après clic dans un `<details>` "Ajouter des infos (optionnel)". Insertion DB inchangée (ces colonnes restent nullable en base).

CTA du form : `Réserver ma démo gratuite →` (au lieu de "Envoyer").

Micro-copy sous le bouton : `Réponse sous 24 h ouvrées · Aucune CB requise · Aucun engagement`

### 8. Réorganisation des sections

Nouvel ordre (celui qui convertit) :

```text
1. Hero (promesse chiffrée + simulateur + CTA)
2. Preuve sociale (880€ / 1 sur 5)
3. Comment ça marche (les 3 étapes actuelles, gardées)
4. Ce que vous obtenez (stack de valeur)
5. Garantie résultat
6. Pour qui / pas pour qui
7. FAQ courte (4 objections top : prix, temps d'install, LGO, RGPD)
8. Formulaire (urgence + form 3 champs)
9. Referral (déplacé après le form, en bonus, pas en distraction)
```

## Détails techniques

- **Fichier principal modifié** : `src/pages/Landing.tsx` (réécriture des sections + réordonnancement).
- **i18n** : ajout des nouvelles clés FR/EN dans `src/i18n/translations.ts` (namespaces `landing.hero.*`, `landing.proof.*`, `landing.stack.*`, `landing.guarantee.*`, `landing.forwhom.*`, `landing.faq.*`, `landing.urgency.*`, `form.short.*`). Toutes les nouvelles chaînes localisées.
- **Formulaire** : `AccessRequestForm` refactoré — 3 champs visibles + `<details>` optionnel. Aucun changement de schéma DB, aucune migration.
- **SEO** : le `<Seo>` reste, mais on met à jour `seo.landing.title` / `desc` pour matcher la nouvelle promesse chiffrée (bon pour CTR Google).
- **Aucun changement backend** : pas de nouvelles Edge Functions, pas de nouvelle table, pas de migration.
- **Design tokens** : uniquement classes shadcn/Tailwind existantes (`pharmacy-gradient`, `glass-card`, `bg-accent`…). Aucune couleur en dur.
- **Composants réutilisés** : `Button`, `Input`, `Checkbox`, `Card` shadcn. Nouvelles icônes Lucide (`ShieldCheck`, `TrendingUp`, `Clock`, `CheckCircle2`, `XCircle`).
- **Aucun impact** sur `/dashboard`, `/admin`, ni sur la logique métier (analyse ordonnance, LGO, etc.).

## Ce que je ne fais PAS dans ce plan (à valider si tu les veux plus tard)

- Ajouter des logos "ils nous font confiance" (tu n'en as qu'un pilote — pas assez pour être crédible)
- Ajouter une vidéo témoignage (à faire quand tu auras filmé ton titulaire pilote)
- Créer une page /demo dédiée avec Calendly embed (peut venir en v2 si le form 3 champs sature)
- A/B tester deux variantes de hero (Lovable ne fait pas d'A/B natif — à instrumenter via analytics existante)

## Livrable

Une landing qui suit la logique Hormozi de bout en bout : **promesse chiffrée → preuve → mécanisme → offre stackée → garantie qui retire le risque → urgence → formulaire ultra-court**. Objectif réaliste : passer d'un taux de conversion visiteur→lead très faible actuel à **2 à 5 %** sur les mêmes 200 visiteurs/semaine.
