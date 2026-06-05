# Phrases conseil format court

Objectif : phrases conseil plus discrètes — un **bénéfice unique** en 3-7 mots, affichées à côté du nom PC en gras. Régénération de l'ensemble du catalogue (~4 900 lignes).

## Format cible

- **Longueur** : 3 à 7 mots, **20 caractères max** (hors nom PC)
- **Style** : phrase verbale, bénéfice patient unique
- **Pas de** : nom du produit répété, ponctuation finale, mots techniques interdits (liste existante conservée)

Exemples :
- `Magnésium B6` · *apaise les tensions*
- `Smecta` · *calme la diarrhée*
- `Hexomédine` · *désinfecte la gorge*
- `Doliprane` · *soulage la douleur*

## Affichage UI (AnalysisResults.tsx)

Aujourd'hui, ligne 488 : nom PC en `font-semibold text-xs`, puis ligne 501-503 phrase tronquée à 45 chars en `text-[9.5px]` sur la ligne suivante.

Changement : afficher le conseil **sur la même ligne** que le nom, séparé par un point médian, plus de troncature artificielle :

```text
● Magnésium B6 · apaise les tensions   [Prio]   [✓]
```

- Nom : `font-semibold text-xs text-foreground`
- Séparateur : `·` en `text-muted-foreground`
- Conseil : `text-xs text-muted-foreground font-normal`
- Suppression du `<p>` séparé ligne 501-503 et de la logique `shortHint`/split
- Repli si phrase absente : afficher uniquement le nom (pas de séparateur)

## Régénération du catalogue

Mise à jour de `supabase/functions/rewrite-phrases/index.ts` :

1. **Nouveau SYSTEM_PROMPT** :
   - Règle stricte : **3 à 7 mots, 20 caractères max**, UNE phrase verbale, bénéfice unique
   - **Interdit** : nom du produit, ponctuation finale, majuscule initiale (commence par un verbe d'action en minuscule)
   - **Verbes encouragés** : apaise, calme, soulage, hydrate, protège, renforce, nourrit, désinfecte, facilite, complète, restaure
   - Liste des mots techniques interdits conservée
2. **Validation côté edge** : rejeter automatiquement (et redemander 1 fois max) toute phrase > 7 mots, > 60 caractères, ou contenant le nom du produit ; tronquer/fallback proprement si la 2e tentative échoue.
3. **Batch existant** (40 lignes / appel) conservé pour éviter les timeouts.

## Exécution de la régénération

Boucle d'invocation de `rewrite-phrases` sur les ~4 900 lignes :
- Pas de `ids` → mode pagination via `offset` / `next_offset` déjà supporté
- ~123 appels (4 900 / 40), exécutés depuis un petit script déclenché manuellement (ou bouton admin existant)
- Compteur progress + reporting des erreurs (déjà présent dans la réponse)

## Mémoire projet

- Mettre à jour le Core : `Counsel phrases: "mi-commercial / mi-technique", focus on patient benefits` → `Counsel phrases: 3-7 mots, bénéfice patient unique, format ultra-court`
- Mettre à jour `mem://features/counseling-phrases-spec` avec le nouveau format

## Hors scope

- Pas de changement de schéma DB (`phrase_conseil text` reste suffisant)
- Pas de modification de `analyze-prescription` (lit déjà `phrase_conseil` tel quel)
- Widget.tsx ligne 532 : aucun changement nécessaire (transmet la valeur DB)
- Pas de migration des phrases historiques en `cross_sell_tracking` (figées par design)

## Fichiers modifiés

- `supabase/functions/rewrite-phrases/index.ts` — nouveau prompt + validation longueur
- `src/components/AnalysisResults.tsx` (≈ lignes 472-503) — affichage inline
- `mem://index.md` + `mem://features/counseling-phrases-spec` — nouvelle spec
