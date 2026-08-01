# Landing page façon Acquisition.com : une offre, un CTA, une preuve

## Diagnostic

La page actuelle a déjà les briques Hormozi (value stack, garantie, FAQ, urgence), mais elle échoue sur les trois règles qui font converser acquisition.com :

1. **Trop de sorties.** Hero avec 2 CTA + widget démo flottant + formulaire d'accès + section parrainage : le visiteur a 4 actions possibles, donc aucune.
2. **Pas de promesse chiffrée en haut.** Acquisition.com ouvre sur une question ("Do You Want to Scale Your Business?") suivie d'un chiffre de preuve ($250m+). Notre hero parle du produit, pas du résultat du titulaire.
3. **Preuve enterrée.** Le seul chiffre réel (+1 200 € de CA en 1 mois sur la pharmacie pilote) n'est pas au-dessus de la ligne de flottaison.

## Réponse à la question CTA

**Un seul CTA : "Tester le copilote"** (démo self-service), pas l'appel.
Raison : le titulaire indépendant est occupé et sceptique — un appel coûte cher en friction et notre trafic est encore faible. La démo laisse le produit prouver la valeur en 30 secondes, l'email est la conversion, et l'appel devient l'étape 2 déclenchée après la démo (là où l'intention est maximale). Acquisition.com fait exactement ça : le "free training" self-service capture, la vente qualifiée vient ensuite.

## Ce qu'on construit

### 1. Hero réécrit (une promesse, un chiffre, un CTA)
- Question d'accroche : "Votre officine laisse-t-elle du chiffre sur le comptoir ?"
- Sous-titre preuve : "+1 200 € de CA en 1 mois sur notre pharmacie pilote — sans vendre plus fort, juste sans oublier le conseil associé."
- Un seul bouton : **Tester le copilote (30 s, gratuit)** → ouvre la démo en grand.
- Suppression du CTA secondaire du hero. Le simulateur de gain reste à droite mais son bouton pointe sur le même CTA.

### 2. Démo mise au centre, plus détaillée
- Nouveau composant plein écran (modale/section ancrée) au lieu du petit widget 320 px : saisie du médicament, suggestions, résultat PC avec phrases conseil, et **ligne de gain estimé** sous le résultat ("~X € de panier moyen sur cette ordonnance").
- Le widget flottant reste, mais son clic ouvre la même vue détaillée.
- Après le 1er test : bandeau "Testez-en un 2ᵉ" → email requis (mécanique déjà en place).
- Après le résultat : CTA unique "Je veux Asclion dans mon officine" → formulaire court.

### 3. Barre de preuve sous le hero
Trois chiffres seulement, sourcés et honnêtes : `+1 200 € de CA / mois (pilote)` · `< 2,5 s par ordonnance` · `0 saisie, 0 config`. Le témoignage nommé existant reste juste dessous.

### 4. Offre reformulée (Grand Slam)
Bloc unique remplaçant le value stack actuel :
- 1 mois d'essai **gratuit, sans engagement**
- Installation offerte
- Formation de l'équipe offerte
- Aucune carte bancaire, résiliation en un email
Titre : "Vous ne risquez rien, littéralement." Le tableau de valeurs est simplifié en 4 lignes lisibles.

### 5. Formulaire réduit à 3 champs
Nom de la pharmacie, email, téléphone. Ville / LGO / nom du contact passent en optionnels repliés. Le formulaire est répété 3 fois sur la page (après démo, après offre, en bas), toujours le même.

### 6. Ce qu'on enlève / déplace
- Section parrainage : déplacée hors de la page principale (elle parle à des clients, pas à des prospects) — accessible depuis le footer.
- CTA secondaires et liens sortants du hero.
- "Pour qui / pas pour qui" est conservé (Hormozi l'utilise pour qualifier) mais raccourci à 3 lignes par colonne.

### Ordre final de la page
Hero (question + chiffre + 1 CTA) → barre de preuve → démo détaillée → témoignage pilote → comment ça marche (3 étapes) → offre + garantie → pour qui / pas pour qui → FAQ → formulaire 3 champs → footer.

## Détails techniques

- `src/pages/Landing.tsx` : réordonnancement des sections, hero à un CTA, barre de preuve, offre simplifiée, formulaire réduit, retrait de la section parrainage.
- Nouveau `src/components/DemoFullPanel.tsx` : réutilise la logique de `WidgetDemo.tsx` (recherche → `demo-med-lookup` → `AnalysisResults` → gate email) dans une mise en page large ; `WidgetDemo` reste pour le widget flottant et partage le même hook de state extrait dans `src/hooks/useDemoLookup.ts`.
- `src/components/SiteDemoWidget.tsx` : le clic ouvre le panneau plein écran.
- `src/i18n/translations.ts` : nouvelles clés FR/EN (`landing.hero.*`, `landing.proofbar.*`, `landing.offer.*`, `demo.gain.*`), suppression des clés devenues inutilisées.
- `src/components/GainSimulator.tsx` : CTA aligné sur le CTA unique.
- Aucun changement de schéma ni d'edge function ; le tracking existant (`trackEvent`, `submit-demo-lead`) est conservé, avec un event `demo_opened_hero` en plus.
