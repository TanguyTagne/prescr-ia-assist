## Objectif

Obtenir une base **"top du top"** : chaque médicament a entre 2 et ~10 PC réellement pertinents (mécanisme documenté), avec au minimum 1 PC effets secondaires/symptômes + 1 PC accompagnement.

## Étape 1 — Finir l'audit GPT-5.5 (301 paires restantes)

Relancer `/tmp/audit2.py` en mode reprise (le `done` set saute les 810 déjà traitées). Budget : ~10 min, ~301 appels GPT-5.5 sur les paires `(ATC3 × catégorie × finalité)` manquantes.

→ Sortie : `/tmp/audit2_results.jsonl` complet (1 111 verdicts keep/reject avec justification).

## Étape 2 — Appliquer le filtre hybride "top du top"

**Règle de suppression** (= on supprime un lien si **toutes** ces conditions) :
1. GPT-5.5 a jugé la paire `(atc3, catégorie, finalité) = reject`
2. ET la raison du rejet est **structurelle** (catégorie générique sans cible, ex: "phytothérapie générique", "complément trop générique", "minéral sans lien direct")
3. ET l'ATC du médicament est défini (≠ "NON")

**On conserve** :
- Tous les liens vers médicaments à ATC = "NON" (vaccins, DM, OTC purs) — GPT manque de contexte
- Les liens où GPT n'a pas tranché (paire absente du verdict)
- Les liens vers les PC à `medicament_id` direct (PC explicitement attachés au médicament, pas via pathologie)
- Tous les "keep" GPT

**Estimation impact** : ~8 600 liens supprimés (43% du bruit), reste ~11 600 liens / ~1 100 méd couverts. Orphelins attendus : ~50.

## Étape 3 — Combler les orphelins (~542 si strict, ~50 en hybride)

Pour chaque médicament identifié comme orphelin **après l'étape 2**, appel GPT-5.5 demandant strictement :
- **1 PC "side_effect" ou "symptom_relief"** (réduit un effet indésirable connu OU soulage un symptôme associé)
- **1 PC "treatment_support"** (accompagne ou améliore l'efficacité)

Format de réponse imposé : JSON `{pcs: [{produit, categorie, description, phrase_conseil, finalite, atc:[...]}, …]}`.

Insertion dans `produits_complementaires` avec `medicament_id` direct (pas via pathologie), `finalite` + `trigger_atc_prefixes` pré-remplis, `priorite=80`, et création du lien dans `medicament_pc_valide`.

## Étape 4 — Rapport final

Tableau dans le chat :
- Avant / après nombre total de liens
- Distribution PC par médicament (médian, p25, p75, max)
- Nombre d'orphelins comblés et exemples (3 méd avec leurs 2 nouveaux PC)
- 10 exemples de liens supprimés (haut volume) pour validation visuelle

## Détails techniques

- **Modèle** : `openai/gpt-5.5` via Lovable AI Gateway (vérifier les crédits avant lancement de l'étape 3 — ~542 appels × 2 PC).
- **Suppressions** : via `supabase--insert` (DELETE FROM `medicament_pc_valide`), pas de migration de schéma.
- **Insertions orphelins** : batch de 30 méd en parallèle via `Promise.all` pour rester dans le budget temps.
- **Aucun changement front-end** : la table `medicament_pc_valide` reste l'unique source de vérité lue par `analyze-prescription`.
- **Idempotence** : on conserve `source='audit_v1'` pour pouvoir replay si besoin ; nouveaux PC tagués `source_code='gpt55_orphan_fill'` pour traçabilité.

## Risques

- **Crédits Lovable AI** : ~300 appels (étape 1) + ~540 appels (étape 3) = ~840 appels GPT-5.5. Si épuisés en cours de route, le script reprend (resume via `done` set).
- **Faux rejets** : on garde un filtre conservateur (raison structurelle seulement) pour éviter de couper des liens valides que GPT aurait mal compris.
- **Aucune perte irréversible** : les liens supprimés peuvent être recréés à partir de `medicament_pathologie` (la jointure d'origine reste intacte).
