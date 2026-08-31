-- ═══════════════════════════════════════════════════════════════════════════
-- Asclion — où manquent les produits conseil ?
-- 15 290 lignes portent une vigilance mais aucun pc_1. Cette requête dit
-- QUELLES CLASSES ATC sont concernées, pour écrire des règles et non des
-- lignes. Une règle par classe couvre mécaniquement toutes ses présentations.
-- Lecture seule. Renvoie-moi les trois blocs.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. LE TROU, CLASSE PAR CLASSE ─────────────────────────────────────────
-- Une ligne de texte par classe ATC, format  ATC | nb lignes | exemples.
-- Les classes hospitalières sont exclues : elles ne doivent PAS recevoir de PC.
SELECT
  m.atc_code || ' | ' || count(*) || ' | ' ||
  string_agg(DISTINCT split_part(m.nom_commercial, ' ', 1), ', ')
    FILTER (WHERE m.nom_commercial IS NOT NULL)                       AS ligne
FROM public.medicaments m
JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id
WHERE nullif(btrim(c.pc_1), '') IS NULL
  AND m.atc_code IS NOT NULL
  AND coalesce(m.statut_officine, '') <> 'exclu'
  AND m.atc_code !~ '^(V0[13456789]|B05|B02A|B02B|N01A|M03A|J06B|B06A|L01[ACDX])'
GROUP BY m.atc_code
HAVING count(*) >= 8
ORDER BY count(*) DESC
LIMIT 90;


-- ─── 2. CE QUE LA REQUÊTE 1 NE COUVRE PAS ──────────────────────────────────
-- Pour savoir combien il restera après les 90 premières règles.
WITH sans_pc AS (
  SELECT m.atc_code, count(*) AS n
  FROM public.medicaments m
  JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id
  WHERE nullif(btrim(c.pc_1), '') IS NULL
    AND coalesce(m.statut_officine, '') <> 'exclu'
  GROUP BY m.atc_code
)
SELECT
  sum(n) FILTER (WHERE atc_code IS NULL)                          AS lignes_sans_atc,
  sum(n) FILTER (WHERE atc_code IS NOT NULL AND n >= 8)           AS lignes_classes_grosses,
  sum(n) FILTER (WHERE atc_code IS NOT NULL AND n < 8)            AS lignes_longue_traine,
  count(*) FILTER (WHERE atc_code IS NOT NULL AND n < 8)          AS nb_classes_traine,
  sum(n)                                                          AS total_sans_pc
FROM sans_pc;


-- ─── 3. CE QUI EXISTE DÉJÀ — pour rester cohérent ──────────────────────────
-- Les produits conseil déjà en base. Mes nouvelles règles doivent réutiliser
-- ce vocabulaire plutôt que d'inventer un synonyme à chaque classe.
SELECT pc_1 || ' (' || count(*) || ')' AS produit_et_lignes
FROM public.medicament_curated_pcs
WHERE nullif(btrim(pc_1), '') IS NOT NULL
GROUP BY pc_1
ORDER BY count(*) DESC
LIMIT 60;
