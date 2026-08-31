-- ═══════════════════════════════════════════════════════════════════════════
-- Asclion — réparations ciblées base v3
-- ⚠️ CES REQUÊTES ÉCRIVENT. À lancer une par une, après le diagnostic,
-- et seulement si la requête correspondante du diagnostic l'indique.
-- Elles ne remplacent PAS un réimport : elles corrigent des données déjà là.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── R1. Nettoyer les CIP à suffixe flottant (« 3400930000001.0 ») ─────────
-- À lancer si la requête 7 du diagnostic remonte des cip_suffixe_flottant > 0.
-- Aucun logiciel d'officine ne reconnaît un CIP avec « .0 » : le scan reste muet.
-- NB : on utilise regexp_replace et non rtrim(cip, '.0') — rtrim retire TOUS
-- les caractères de l'ensemble {'.','0'} en fin de chaîne et mangerait les
-- zéros terminaux d'un CIP légitime (3400930000010.0 → 3400930000 01).
UPDATE public.medicaments
SET cip_code = regexp_replace(cip_code, '\.0$', '')
WHERE cip_code ~ '\.0$'
  AND regexp_replace(cip_code, '\.0$', '') ~ '^[0-9]{13}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.medicaments m2
    WHERE m2.cip_code = regexp_replace(public.medicaments.cip_code, '\.0$', '')
  );


-- ─── R2. Marquer les produits hors comptoir ────────────────────────────────
-- Les 5 747 lignes hospitalières ne doivent jamais recevoir de conseil au
-- comptoir. Le code applique désormais ce filtre à l'import via la colonne
-- `canal` ; ceci rattrape une base déjà importée sans cette colonne.
-- Classes ATC concernées : gaz médicaux, produits de contraste, solutions de
-- perfusion et dialyse, radiopharmaceutiques, cytotoxiques injectables.
UPDATE public.medicaments
SET statut_officine = 'exclu',
    est_eligible_comme_complementaire = false
WHERE statut_officine <> 'exclu'
  AND (
       atc_code LIKE 'V08%'   -- produits de contraste
    OR atc_code LIKE 'V09%'   -- radiopharmaceutiques diagnostiques
    OR atc_code LIKE 'V10%'   -- radiopharmaceutiques thérapeutiques
    OR atc_code LIKE 'B05%'   -- solutions de perfusion, dialyse, albumine
    OR atc_code LIKE 'L01%'   -- cytotoxiques
    OR atc_code LIKE 'N01A%'  -- anesthésiques généraux
    OR atc_code = 'V03AN01'   -- oxygène médicinal
  );

-- Puis retirer les conseils comptoir posés à tort sur ces lignes.
UPDATE public.medicament_curated_pcs c
SET pc_1 = NULL, pertinence_pc1 = NULL, phrase_conseil_pc1 = NULL,
    pc_2 = NULL, pertinence_pc2 = NULL, phrase_conseil_pc2 = NULL
FROM public.medicaments m
WHERE m.id = c.medicament_id
  AND m.statut_officine = 'exclu'
  AND (c.pc_1 IS NOT NULL OR c.pc_2 IS NOT NULL);


-- ─── R3. Combler pertinence_vigilance ──────────────────────────────────────
-- L'app affiche ce libellé comme badge. Vide, le badge disparaît et la
-- vigilance passe inaperçue.
UPDATE public.medicament_curated_pcs
SET pertinence_vigilance = 'Sécurité'
WHERE nullif(btrim(pertinence_vigilance), '') IS NULL
  AND (nullif(btrim(vigilance), '') IS NOT NULL
    OR nullif(btrim(phrase_vigilance), '') IS NOT NULL);


-- ─── R4. Supprimer les lignes de conseil orphelines ────────────────────────
-- À lancer si la requête 4 du diagnostic remonte des orphelines : elles ne
-- seront jamais lues et faussent tous les compteurs de couverture.
DELETE FROM public.medicament_curated_pcs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.medicaments m WHERE m.id = c.medicament_id
);


-- ─── R5. Contrôle final ────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.medicaments)                                   AS medicaments,
  (SELECT count(*) FROM public.medicaments WHERE statut_officine = 'exclu')   AS hors_comptoir,
  (SELECT count(*) FROM public.medicament_curated_pcs
    WHERE nullif(btrim(pc_1), '') IS NOT NULL)                                AS avec_pc1,
  (SELECT count(*) FROM public.medicament_curated_pcs
    WHERE nullif(btrim(phrase_vigilance), '') IS NOT NULL)                    AS avec_vigilance;
