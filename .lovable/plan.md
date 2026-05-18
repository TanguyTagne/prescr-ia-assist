## Objectif
Garantir que les médicaments pédiatriques (nourrisson / bébé / enfant) ne se voient proposer **que** des PCs adaptés à l'âge — jamais d'IPP adulte, d'AINS 400 mg, d'aspirine, d'huiles essentielles déconseillées <6 ans, etc.

## Constat
- **60 médicaments pédiatriques** identifiés en base.
- Aucun n'est orphelin de PC, MAIS la quasi-totalité hérite de PCs adultes via les pathologies génériques (Migraine, Douleur musculaire, IPP…).
- Exemple : *Advil enfant 20 mg/ml* propose *Doliprane 1000 mg*, *Mopralpro 20 mg*, *Harpagophytum*.

## Plan en 3 étapes

### 1. Flag pédiatrique sur les médicaments (migration)
- Ajouter colonne `cible_age TEXT` sur `medicaments` (valeurs : `nourrisson`, `enfant`, `adulte`, `tous`).
- Backfill via SQL en se basant sur :
  - nom commercial (`nourrisson|bébé|enfant|pédiatr|junior|kids`)
  - forme galénique (`sirop|suspension buvable|gouttes`)
  - dosage faible (paracétamol < 500 mg, ibuprofène ≤ 100 mg/5 ml…)
  - vaccins pédiatriques ATC `J07*`
- Ajouter colonne `cible_age TEXT[]` sur `produits_complementaires` (ex : `{enfant,adulte}`).

### 2. Remplissage GPT-5.5 ciblé pédiatrique
- Edge function `peds-pc-fill` : pour chacun des 60 médicaments pédiatriques, GPT-5.5 génère **2 PCs pédiatriques** :
  - **1 PC réduction d'effets / soulagement de symptôme** (ex : Pédiakid Vitamine D sirop, Stérimar bébé, Calmosine digestion)
  - **1 PC accompagnement traitement** (ex : Bétadine scrub enfant après vaccin, Bepanthen baume change, ZymaD gouttes)
- Insertion directe `medicament_id` → `produits_complementaires` avec `priorite=92`, `source_code='gpt55_peds_fill'`, `cible_age={nourrisson,enfant}`.

### 3. Filtre runtime dans `analyze-prescription` + `clinical-lookup`
- Si un médicament scanné a `cible_age IN ('nourrisson','enfant')`, alors :
  - Garder UNIQUEMENT les PCs dont `cible_age` contient `enfant`/`nourrisson` OU dont le nom matche la whitelist pédiatrique (Stérimar, Physiomer, Bepanthen, Mustela, Weleda bébé, Calmosine, Biogaia, Pediakid, Doliprane sirop, Doliprane 2,4%, Advil enfant, Nurofen enfant, Efferalgan susp, ZymaD, Forlax junior…).
  - Blacklist forte : tout PC contenant `aspirine|aspégic|kardégic|ibuprofène 400|paracétamol 1000|mopralpro|inexium|baume du tigre|huile essentielle (sauf eucalyptus radiata >3 ans)|harpagophytum|curcuma|magnésium >100 mg` → exclu pour nourrisson/<6 ans.

## Détail technique
- Migration : 2 colonnes + backfill SQL pur (pas d'IA pour étape 1).
- Edge function `peds-pc-fill` : boucle 60 meds, payload GPT-5.5 strict JSON (`{pc_symptome, pc_accompagnement}`), inserts en batch.
- Modif `analyze-prescription/index.ts` & `clinical-lookup/index.ts` : ajouter helper `filterPediatricPcs(pcs, scannedMeds)` appliqué juste avant le dédup.
- Coût estimé : ~60 appels Gemini Flash, < 1 min, ~0.05 € crédits.

## Risques
- Faux positifs sur le backfill `cible_age` (ex : "Spasfon Lyoc enfant" qui est en réalité adulte). Mitigation : revue manuelle des cas ambigus listés en sortie d'audit.
- Whitelist incomplète : prévoir un `console.warn` côté edge function quand un PC est filtré, pour enrichir la liste au fil de l'eau.