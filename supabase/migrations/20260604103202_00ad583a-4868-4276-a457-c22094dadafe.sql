
WITH parsed AS (
  SELECT
    m.id,
    btrim(regexp_replace(mc.denomination, '^' || regexp_replace(mc.medicament_nom, '([.+*?()\[\]{}|\\^$])', '\\\1', 'g'), '', 'i')) AS remainder
  FROM public.medicaments m
  JOIN public.medicament_cip mc ON mc.cip13 = m.cip_code
  WHERE m.cip_code IS NOT NULL
),
split AS (
  SELECT
    id,
    btrim((regexp_match(remainder, '^(.*),\s*([^,]+)$'))[1]) AS new_dosage,
    btrim((regexp_match(remainder, '^(.*),\s*([^,]+)$'))[2]) AS new_forme
  FROM parsed
  WHERE remainder ~ ','
)
UPDATE public.medicaments m
SET
  dosage = NULLIF(s.new_dosage, ''),
  forme_galenique = NULLIF(s.new_forme, '')
FROM split s
WHERE m.id = s.id;
