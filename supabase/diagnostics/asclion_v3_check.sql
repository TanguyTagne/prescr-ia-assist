-- ═══════════════════════════════════════════════════════════════════════════
-- Asclion — diagnostic base v3
-- À coller dans le SQL editor Lovable / Supabase. Lecture seule, aucun risque.
-- Objectif : savoir POURQUOI ni les PC ni les phrases de vigilance ne
-- s'affichent alors que l'import a été lancé.
-- Lancer les requêtes une par une et lire les commentaires « attendu ».
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ REQUÊTE EXPRESS ═══════════════════════════════════════════════════════
-- Une seule requête, une seule ligne de résultat, à renvoyer telle quelle.
-- Elle suffit à trancher entre les trois hypothèses.
SELECT
  (SELECT count(*) FROM public.medicaments)                                       AS meds,
  (SELECT count(*) FROM public.medicament_curated_pcs)                            AS curated,
  (SELECT count(*) FROM public.medicament_cip)                                    AS bdpm,
  (SELECT count(*) FROM public.medicament_curated_pcs
     WHERE nullif(btrim(pc_1), '') IS NOT NULL)                                   AS avec_pc1,
  (SELECT count(*) FROM public.medicament_curated_pcs
     WHERE nullif(btrim(phrase_conseil_pc1), '') IS NOT NULL)                     AS avec_phrase1,
  (SELECT count(*) FROM public.medicament_curated_pcs
     WHERE nullif(btrim(vigilance), '') IS NOT NULL
        OR nullif(btrim(phrase_vigilance), '') IS NOT NULL)                       AS avec_vigilance,
  (SELECT count(*) FROM public.medicament_curated_pcs c
     WHERE NOT EXISTS (SELECT 1 FROM public.medicaments m WHERE m.id = c.medicament_id))
                                                                                  AS curated_orphelines,
  (SELECT string_agg(DISTINCT source, ', ') FROM public.medicament_curated_pcs)   AS sources,
  (SELECT count(*) FROM public.medicaments WHERE cip_code IS NULL)                AS meds_sans_cip;


-- ─── 1. VOLUMÉTRIE ─────────────────────────────────────────────────────────
-- Attendu v3 : ~29 402 médicaments et autant de lignes curated.
-- Si medicaments = 0        → le wipe a eu lieu mais l'import n'a rien écrit
--                             (colonne `id` absente du CSV : chaque ligne était
--                             sautée en silence). C'est le scénario n°1.
-- Si curated  << medicaments → l'import s'est interrompu en cours de route.
SELECT
  (SELECT count(*) FROM public.medicaments)              AS medicaments,
  (SELECT count(*) FROM public.medicament_curated_pcs)   AS curated,
  (SELECT count(*) FROM public.medicament_cip)           AS bdpm_cip;


-- ─── 2. REMPLISSAGE DE LA TABLE CURATED ────────────────────────────────────
-- Attendu v3 : pc_1 sur ~90 % des lignes officine, vigilance sur ~90,9 %,
-- pc_2 sur ~9,5 % seulement (c'est normal, la v3 ne double que si ça le mérite).
-- Si vigilance = 0 → les colonnes n'ont pas été alimentées : le CSV importé
-- n'est pas le v3, ou ses en-têtes ne sont pas reconnus.
SELECT
  count(*)                                                            AS lignes,
  count(*) FILTER (WHERE nullif(btrim(pc_1), '') IS NOT NULL)         AS avec_pc1,
  count(*) FILTER (WHERE nullif(btrim(pc_2), '') IS NOT NULL)         AS avec_pc2,
  count(*) FILTER (WHERE nullif(btrim(phrase_conseil_pc1), '') IS NOT NULL) AS avec_phrase1,
  count(*) FILTER (WHERE nullif(btrim(vigilance), '') IS NOT NULL)          AS avec_vigilance,
  count(*) FILTER (WHERE nullif(btrim(phrase_vigilance), '') IS NOT NULL)   AS avec_phrase_vig
FROM public.medicament_curated_pcs;


-- ─── 3. QUELLE BASE EST RÉELLEMENT EN PLACE ? ──────────────────────────────
-- Attendu après le correctif : source = 'asclion_v3'.
-- 'asclion_2026_06' = ancien import. Plusieurs sources = base hybride.
SELECT source, count(*) AS lignes, max(updated_at) AS derniere_ecriture
FROM public.medicament_curated_pcs
GROUP BY source
ORDER BY lignes DESC;


-- ─── 4. LE JOIN EST-IL CASSÉ ? (cause n°2 la plus probable) ────────────────
-- medicament_curated_pcs.medicament_id doit pointer sur medicaments.id.
-- Attendu : 0 orpheline. Si > 0, les PC existent mais ne sont jamais lus,
-- ce qui donne exactement le symptôme observé.
SELECT count(*) AS curated_orphelines
FROM public.medicament_curated_pcs c
LEFT JOIN public.medicaments m ON m.id = c.medicament_id
WHERE m.id IS NULL;

-- Et l'inverse : des médicaments sans aucune ligne de conseil.
SELECT count(*) AS medicaments_sans_curated
FROM public.medicaments m
LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id
WHERE c.medicament_id IS NULL;


-- ─── 5. LE CHEMIN DU SCAN (cause n°3) ──────────────────────────────────────
-- Le widget résout : code-barre → medicament_cip (BDPM) → nom → medicaments.
-- Si le nom BDPM ne retrouve aucune ligne dans `medicaments`, le widget
-- affiche le médicament SANS aucun conseil (med.id vide). Voilà ce que ça donne
-- sur un échantillon de 200 CIP réels :
WITH echantillon AS (
  SELECT cip13, medicament_nom FROM public.medicament_cip LIMIT 200
)
SELECT
  count(*)                                                       AS cip_testes,
  count(*) FILTER (WHERE m.id IS NOT NULL)                       AS resolus_dans_medicaments,
  count(*) FILTER (WHERE c.medicament_id IS NOT NULL)            AS avec_conseil_curated,
  count(*) FILTER (WHERE nullif(btrim(c.vigilance), '') IS NOT NULL) AS avec_vigilance
FROM echantillon e
LEFT JOIN LATERAL (
  SELECT id FROM public.medicaments
  WHERE nom_commercial ILIKE e.medicament_nom || '%'
  ORDER BY nom_commercial LIMIT 1
) m ON true
LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id;


-- ─── 6. TEST CONCRET — les 5 médicaments de la démo ────────────────────────
-- Attendu : une ligne par médicament, avec pc_1 ET phrase_vigilance remplis.
-- Aucune ligne = le médicament n'existe plus dans `medicaments` après le wipe.
SELECT
  m.nom_commercial,
  m.cip_code,
  m.statut_officine,
  c.pc_1,
  c.pertinence_pc1,
  left(coalesce(c.phrase_conseil_pc1, '—'), 60) AS phrase_pc1,
  left(coalesce(c.phrase_vigilance,  '—'), 80) AS phrase_vigilance
FROM public.medicaments m
LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id
WHERE m.nom_commercial ILIKE ANY (ARRAY[
  '%curacne%', '%bactrim%', '%flagyl%', '%jardiance%', '%durogesic%',
  '%glucophage%', '%plavix%', '%augmentin%', '%doliprane%'
])
ORDER BY m.nom_commercial
LIMIT 40;


-- ─── 7. QUALITÉ DES CIP ────────────────────────────────────────────────────
-- cip_code NULL = médicament non résolvable par scan direct (il ne reste que
-- le chemin BDPM par nom). Un taux élevé explique des scans muets.
SELECT
  count(*)                                                  AS total,
  count(*) FILTER (WHERE cip_code IS NULL)                  AS sans_cip,
  count(*) FILTER (WHERE cip_code LIKE '%.0')               AS cip_suffixe_flottant,
  count(*) FILTER (WHERE cip_code IS NOT NULL
                     AND cip_code !~ '^[0-9]{13}$')         AS cip_format_invalide,
  count(*) FILTER (WHERE statut_officine = 'exclu')         AS hors_comptoir
FROM public.medicaments;


-- ─── 8. LES SUGGESTIONS À FAIBLE VALEUR SONT-ELLES BIEN PARTIES ? ──────────
-- Baromètre de la refonte v3 : le pilulier / carnet / tensiomètre devait
-- tomber de 45,4 % à 10,7 % des pc_1. Si on est encore au-dessus de 40 %,
-- c'est l'ancienne base qui est en place.
SELECT
  round(100.0 * count(*) FILTER (
    WHERE pc_1 ~* 'pilulier|carnet|tensiom|compresse|pansement|thermom'
  ) / nullif(count(*) FILTER (WHERE nullif(btrim(pc_1), '') IS NOT NULL), 0), 1)
    AS pct_pc1_faible_valeur,
  count(DISTINCT pc_1) AS produits_conseil_distincts   -- attendu v3 : ~54
FROM public.medicament_curated_pcs;


-- ─── 9. TOP DES PRODUITS CONSEIL PROPOSÉS ──────────────────────────────────
-- Coup d'œil qualitatif : on doit reconnaître le vocabulaire de la v3
-- (protection solaire SPF50+, vitamine B12 sublinguale, Saccharomyces
-- boulardii, laxatif osmotique…) et non l'ancienne liste diluée.
SELECT pc_1, count(*) AS lignes
FROM public.medicament_curated_pcs
WHERE nullif(btrim(pc_1), '') IS NOT NULL
GROUP BY pc_1
ORDER BY lignes DESC
LIMIT 25;
