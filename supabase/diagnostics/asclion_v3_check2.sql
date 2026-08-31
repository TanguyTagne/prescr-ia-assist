-- ═══════════════════════════════════════════════════════════════════════════
-- Asclion — diagnostic v3, deuxième passe
-- La base EST importée (29 402 médicaments, 29 402 lignes de conseil,
-- 0 orpheline, 28 000 vigilances). Le problème est donc dans le CHEMIN DE
-- LECTURE, pas dans les données. Ces trois requêtes le localisent.
-- Lecture seule.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── A. LE CHEMIN DU SCAN, REJOUÉ SUR 300 CIP RÉELS ────────────────────────
-- C'est exactement ce que fait le widget : code-barre → medicament_cip →
-- nom BDPM → medicaments → medicament_curated_pcs.
-- Attendu si tout va bien : resolus ≈ cip_testes, et avec_vigilance élevé.
-- Si `resolus` s'effondre → les noms BDPM ne retrouvent pas `medicaments`,
-- et le pharmacien voit le médicament sans aucun conseil. C'est LE test.
WITH e AS (
  SELECT cip13, medicament_nom
  FROM public.medicament_cip
  ORDER BY random()
  LIMIT 300
)
SELECT
  count(*)                                                     AS cip_testes,
  count(*) FILTER (WHERE m.id IS NOT NULL)                     AS resolus,
  count(*) FILTER (WHERE m.par_cip)                            AS dont_par_cip_direct,
  count(*) FILTER (WHERE nullif(btrim(c.pc_1), '') IS NOT NULL) AS avec_pc1,
  count(*) FILTER (WHERE nullif(btrim(c.vigilance), '') IS NOT NULL
                      OR nullif(btrim(c.phrase_vigilance), '') IS NOT NULL)
                                                               AS avec_vigilance
FROM e
LEFT JOIN LATERAL (
  SELECT id, (cip_code = e.cip13) AS par_cip
  FROM public.medicaments
  WHERE cip_code = e.cip13
     OR nom_commercial ILIKE e.medicament_nom || '%'
  ORDER BY (cip_code = e.cip13) DESC
  LIMIT 1
) m ON true
LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id;


-- ─── B. DIX EXEMPLES CÔTE À CÔTE ───────────────────────────────────────────
-- Pour voir de mes yeux si le nom BDPM et le nom interne ont la même forme.
-- Un « DOLIPRANE 1000 MG COMPRIME » d'un côté et « Doliprane » de l'autre,
-- et le ILIKE '<nom bdpm>%' ne matche jamais.
SELECT
  e.cip13,
  e.medicament_nom                                  AS nom_bdpm,
  coalesce(m.nom_commercial, '### NON RESOLU ###')  AS nom_interne,
  coalesce(c.pc_1, '—')                             AS pc_1,
  left(coalesce(c.phrase_vigilance, '—'), 55)       AS vigilance
FROM (
  SELECT cip13, medicament_nom FROM public.medicament_cip ORDER BY random() LIMIT 10
) e
LEFT JOIN LATERAL (
  SELECT id, nom_commercial
  FROM public.medicaments
  WHERE cip_code = e.cip13 OR nom_commercial ILIKE e.medicament_nom || '%'
  ORDER BY (cip_code = e.cip13) DESC
  LIMIT 1
) m ON true
LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id;


-- ─── C. LE VOCABULAIRE EST-IL CELUI DE LA v3 ? ─────────────────────────────
-- On doit reconnaître : protection solaire SPF50+, vitamine B12 sublinguale,
-- Saccharomyces boulardii, laxatif osmotique, brosse à dents souple…
-- Si on lit surtout pilulier / carnet de suivi / tensiomètre, c'est l'ancienne.
SELECT pc_1, count(*) AS lignes
FROM public.medicament_curated_pcs
WHERE nullif(btrim(pc_1), '') IS NOT NULL
GROUP BY pc_1
ORDER BY lignes DESC
LIMIT 20;
