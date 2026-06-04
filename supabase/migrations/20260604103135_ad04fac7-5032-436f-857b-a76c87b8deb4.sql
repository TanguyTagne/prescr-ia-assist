
-- Sync dosage & forme_galenique from medicament_cip.denomination (ANSM source of truth)
-- for all medicaments that have a CIP. Parses "NAME DOSAGE, forme" format.

WITH parsed AS (
  SELECT
    m.id,
    mc.denomination,
    mc.medicament_nom,
    -- Remove the name prefix (case-insensitive), then split on first comma
    btrim(regexp_replace(mc.denomination, '^' || regexp_replace(mc.medicament_nom, '([.+*?()\[\]{}|\\^$])', '\\\1', 'g'), '', 'i')) AS remainder
  FROM public.medicaments m
  JOIN public.medicament_cip mc ON mc.cip13 = m.cip_code
  WHERE m.cip_code IS NOT NULL
),
split AS (
  SELECT
    id,
    btrim(split_part(remainder, ',', 1)) AS new_dosage,
    btrim(NULLIF(substring(remainder FROM position(',' IN remainder) + 1), '')) AS new_forme
  FROM parsed
  WHERE position(',' IN remainder) > 0
)
UPDATE public.medicaments m
SET
  dosage = NULLIF(s.new_dosage, ''),
  forme_galenique = NULLIF(s.new_forme, '')
FROM split s
WHERE m.id = s.id
  AND (
    COALESCE(m.dosage, '') IS DISTINCT FROM COALESCE(NULLIF(s.new_dosage, ''), '')
    OR COALESCE(m.forme_galenique, '') IS DISTINCT FROM COALESCE(NULLIF(s.new_forme, ''), '')
  );
