---
name: Champ vigilance (Sécurité)
description: Troisième champ des fiches conseil — avertissement de sécurité qui ne vend aucun produit
type: feature
---
`medicament_curated_pcs` porte, en plus de pc_1/pc_2, un triplet `vigilance` / `phrase_vigilance` / `pertinence_vigilance` (défaut « Sécurité »).

Rôle : porter les messages de bon usage qui ne vendent rien (pas d'alcool sous métronidazole, chaleur sous patch de fentanyl, acidocétose euglycémique sous gliflozine, hydratation sous sulfamide, plan de prévention des grossesses sous isotrétinoïne).

Affichage : bloc ambre avec icône d'alerte au-dessus des PC dans `AnalysisResults`, alimenté par `demo-med-lookup` (clé `medicament.vigilance`). Positionnement produit : Asclion n'est pas un moteur d'upsell.
