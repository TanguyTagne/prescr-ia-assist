## Constat

- **53 359 paires** médicament↔PC (via la pathologie).
- Beaucoup sont **incohérentes** : ex. *Advil 400mg* hérite de *Macrogol (laxatif)* avec une phrase qui parle du **tramadol** (constipation opioïde) — alors qu'Advil n'est pas un opioïde. De même *Dompéridone* (médicament sur ordonnance) apparaît comme PC.
- Cause racine : les PC sont rattachés à une **pathologie**, donc tout médicament lié à cette pathologie hérite automatiquement de **tous** ses PC, sans filtre par classe ATC ni par finalité clinique.

## Règle cible

Chaque PC rattaché à un médicament doit relever d'**une** des 2 finalités :
1. **Réduit / prévient un effet indésirable** de la classe ATC du médicament (ex : IPP sous AINS, laxatif sous opioïde, candidose sous corticoïde inhalé…).
2. **Accompagne l'efficacité** du traitement (ex : magnésium + statine, probiotiques + antibiotique, hydratation + diurétique…).

Tout PC qui ne correspond à aucune des deux pour la classe ATC du médicament → **lien supprimé**.

## Plan

### 1. Schéma : finalité explicite sur chaque PC
Migration : ajouter à `produits_complementaires` :
- `finalite text check in ('side_effect','treatment_support','symptom_relief',null)`
- `trigger_atc_prefixes text[]` (classes ATC qui justifient ce PC — ex `{'M01A','N02BE'}` pour un IPP gastroprotecteur AINS)

### 2. Classification AI (Gemini Flash, batch)
Edge function `audit-pc-purpose` (admin only) :
- Pour chaque PC unique (3 233), appel Gemini Flash : "Classe la finalité (side_effect / treatment_support / symptom_relief) et liste les préfixes ATC qui justifient ce PC".
- Écrit `finalite` + `trigger_atc_prefixes` en base.
- Coût ≈ 3k appels Flash, lance-le en chunks de 50 en parallèle (~5 min).

### 3. Re-validation des liens med↔PC
SQL en batch :
- Pour chaque paire `(medicament, pc)` issue de `medicament_pathologie ⨝ pc`, garder uniquement si `medicament.atc_code` commence par un des `pc.trigger_atc_prefixes`, **OU** si `pc.finalite = 'symptom_relief'` ET le PC est lié à la pathologie principale du médicament.
- Matérialiser les liens validés dans une nouvelle table `medicament_pc_valide(medicament_id, pc_id, finalite, score)`.
- Le front lit cette table plutôt que la jointure pathologie large.

### 4. Combler les médicaments qui perdent tous leurs PC
Après filtrage, certains médicaments n'auront plus de PC pertinent (effet de bord du nettoyage).
- Liste ces orphelins, génère via Gemini Flash 2-3 PC ciblés (finalité + ATC trigger explicite) par médicament orphelin.
- Insertion en `produits_complementaires` avec `medicament_id` direct + `finalite`.

### 5. Reporting admin
Nouvel onglet "Audit PC" dans Admin :
- Avant/après : nombre de paires, paires supprimées avec exemple, médicaments enrichis.
- Liste filtrable des PC sans finalité (validation manuelle si besoin).

## Détails techniques

- AI : Gemini Flash via `LOVABLE_API_KEY` (déjà configuré).
- Sécurité : fonction admin-only avec check `has_role(_, 'admin')`.
- Idempotent : `ON CONFLICT DO UPDATE` partout, ré-exécutable.
- Pas de breaking change côté `analyze-prescription` : on garde la jointure actuelle en fallback si `medicament_pc_valide` est vide pour un médicament.

## Livrables

1. Migration schéma (`finalite`, `trigger_atc_prefixes`, table `medicament_pc_valide`).
2. Edge function `audit-pc-purpose` (classification AI + re-validation + comblement orphelins).
3. Onglet admin "Audit PC" avec bouton de lancement et stats.

Pas de changement UX côté pharmacien — uniquement une amélioration qualitative des PC proposés.