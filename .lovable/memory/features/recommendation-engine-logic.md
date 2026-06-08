---
name: Recommendation Engine Logic
description: STRICT curated-only mode — PCs sourced exclusively from medicament_curated_pcs (Asclion medicaments finals CSV)
type: feature
---
Depuis 2026-06, l'engine `analyze-prescription` est en **mode strict curated-only** :

- **Source unique des PCs** : table `medicament_curated_pcs` (colonnes `pc_1`, `pc_2`) importée du CSV "asclion medicaments finals".
- **Interdit** : déduire un PC depuis la pathologie, l'ATC, la classe thérapeutique, un protocole, la KB clinique, ou `medicament_pc_valide`.
- Si un médicament n'a pas d'entrée dans `medicament_curated_pcs` → 0 reco affichée.
- Le `conseil_associe` reste autorisé (texte médicament-spécifique, non-PC).
- UI dégressive maintenue : Top 3 (1 med), Top 2 (2 meds), Top 1 (3+ meds), max 1 latent need.
