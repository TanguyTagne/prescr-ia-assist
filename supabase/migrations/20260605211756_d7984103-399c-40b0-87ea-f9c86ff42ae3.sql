CREATE OR REPLACE FUNCTION public.get_medicaments_coverage_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH m AS (
    SELECT
      id, cip_code,
      lower(btrim(nom_commercial)) AS nom_k,
      COALESCE(lower(btrim(dosage)),'') AS dosage_k,
      COALESCE(lower(btrim(forme_galenique)),'') AS forme_k
    FROM public.medicaments
  ),
  totals AS (
    SELECT
      COUNT(*) AS total_rows,
      COUNT(*) FILTER (WHERE cip_code IS NOT NULL AND cip_code <> '') AS with_cip,
      COUNT(*) FILTER (WHERE cip_code IS NULL OR cip_code = '') AS without_cip,
      COUNT(DISTINCT nom_k) AS unique_nom,
      COUNT(DISTINCT (nom_k || '|' || dosage_k || '|' || forme_k)) AS unique_presentations
    FROM m
  ),
  dups AS (
    SELECT COUNT(*) AS dup_groups, COALESCE(SUM(c-1),0) AS dup_extra_rows
    FROM (SELECT COUNT(*) c FROM m GROUP BY nom_k, dosage_k, forme_k HAVING COUNT(*) > 1) g
  ),
  pc_per_med AS (
    SELECT m.nom_k,
      MAX(
        CASE WHEN c.pc_1 IS NOT NULL AND c.pc_1 <> '' THEN 1 ELSE 0 END +
        CASE WHEN c.pc_2 IS NOT NULL AND c.pc_2 <> '' THEN 1 ELSE 0 END
      ) AS pc_count
    FROM m LEFT JOIN public.medicament_curated_pcs c ON c.medicament_id = m.id
    GROUP BY m.nom_k
  ),
  pc_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE pc_count > 0) AS meds_with_pc,
      COUNT(*) AS unique_nom_total,
      COALESCE(ROUND(AVG(pc_count) FILTER (WHERE pc_count > 0)::numeric, 2), 0) AS avg_pc_per_med,
      COALESCE(MAX(pc_count), 0) AS max_pc_per_med
    FROM pc_per_med
  )
  SELECT jsonb_build_object(
    'total_rows', t.total_rows,
    'with_cip', t.with_cip,
    'without_cip', t.without_cip,
    'unique_nom', t.unique_nom,
    'unique_presentations', t.unique_presentations,
    'dup_groups', d.dup_groups,
    'dup_extra_rows', d.dup_extra_rows,
    'meds_with_pc', p.meds_with_pc,
    'meds_without_pc', p.unique_nom_total - p.meds_with_pc,
    'pc_coverage_rate', CASE WHEN p.unique_nom_total > 0 THEN ROUND((p.meds_with_pc::numeric / p.unique_nom_total) * 100, 1) ELSE 0 END,
    'avg_pc_per_med', p.avg_pc_per_med,
    'max_pc_per_med', p.max_pc_per_med
  )
  FROM totals t, dups d, pc_stats p;
$function$;