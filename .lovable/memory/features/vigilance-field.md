---
name: Champ vigilance non affiché
description: Les données de vigilance restent importées mais ne doivent plus apparaître dans l'application ni la démo
type: feature
---
`medicament_curated_pcs` porte, en plus de pc_1/pc_2, un triplet `vigilance` / `phrase_vigilance` / `pertinence_vigilance` (défaut « Sécurité »).

Rôle : porter les messages de bon usage qui ne vendent rien (pas d'alcool sous métronidazole, chaleur sous patch de fentanyl, acidocétose euglycémique sous gliflozine, hydratation sous sulfamide, plan de prévention des grossesses sous isotrétinoïne).

Affichage depuis le 14 septembre 2026 : ne jamais montrer ces champs dans l'application Electron, la démo ou les textes commerciaux. Ils restent dans la base et dans l'import, mais ne sont plus chargés au moment de l'analyse et ne déclenchent pas seuls l'ouverture de l'application. L'expérience est présentée simplement comme « produit complémentaire du médicament scanné ».
