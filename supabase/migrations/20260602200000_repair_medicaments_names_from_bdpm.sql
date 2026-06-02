-- ================================================================
-- Migration : réparation MASSIVE de la table medicaments
--
-- Constat : un UPDATE accidentel a renommé 7 000+ entrées en "Timoptol 0.5%".
-- Conséquence : tous les scans sur ces CIPs affichent "Timoptol" peu importe
-- le vrai produit. Risque clinique grave (ex: scan Cérulyse → Timoptol).
--
-- Stratégie de réparation :
--   1. Pour chaque medicament avec CIP valide, restaurer le nom depuis BDPM
--      (table medicament_cip = source de vérité ANSM)
--   2. Marquer les lignes sans CIP valide pour qu'elles ne polluent plus les
--      résolutions par nom (utilisées par le fallback Widget.tsx)
--   3. Marquer les CIPs invalides (longueur ≠ 13) comme "CIP_INVALIDE"
-- ================================================================

-- ── 1. Restaurer le nom depuis BDPM pour les CIPs valides ─────────────────
-- BDPM est la source ANSM officielle, donc autoritative.
UPDATE public.medicaments m
SET nom_commercial = mc.medicament_nom
FROM public.medicament_cip mc
WHERE m.cip_code = mc.cip13
  AND m.cip_code IS NOT NULL
  AND m.cip_code ~ '^\d{13}$'
  AND (m.nom_commercial IS NULL OR m.nom_commercial != mc.medicament_nom);

-- ── 2. Marquer les entrées sans CIP comme inutilisables ──────────────────
-- Ces lignes ne servent à rien (pas de CIP, donc impossible à matcher au scan).
-- On les renomme pour qu'elles n'apparaissent plus dans les recherches par nom.
UPDATE public.medicaments
SET nom_commercial = '__ORPHELIN_SANS_CIP__'
WHERE (cip_code IS NULL OR cip_code = '')
  AND nom_commercial = 'Timoptol 0.5%';

-- ── 3. Marquer les CIPs invalides (longueur ≠ 13 ou non numériques) ──────
UPDATE public.medicaments
SET nom_commercial = '__CIP_INVALIDE__'
WHERE cip_code IS NOT NULL
  AND cip_code != ''
  AND NOT (cip_code ~ '^\d{13}$')
  AND nom_commercial = 'Timoptol 0.5%';

-- ── 4. Pour les CIPs valides mais ABSENTS de BDPM (produits OTC récents,
--      grossiste-spécifiques), on conserve l'entrée mais on flag visuellement.
UPDATE public.medicaments m
SET nom_commercial = '__INCONNU_BDPM__' || ' (cip:' || m.cip_code || ')'
WHERE m.cip_code IS NOT NULL
  AND m.cip_code ~ '^\d{13}$'
  AND m.nom_commercial = 'Timoptol 0.5%'
  AND NOT EXISTS (
    SELECT 1 FROM public.medicament_cip mc
    WHERE mc.cip13 = m.cip_code
  );

-- ── Vérification post-migration ──────────────────────────────────────────
-- SELECT
--   COUNT(*) FILTER (WHERE nom_commercial = 'Timoptol 0.5%') AS still_fake_timoptol,
--   COUNT(*) FILTER (WHERE nom_commercial LIKE '__%') AS flagged_orphans,
--   COUNT(*) FILTER (WHERE nom_commercial NOT LIKE '__%' AND nom_commercial != 'Timoptol 0.5%') AS healthy_rows
-- FROM medicaments;
--
-- → still_fake_timoptol doit être proche de 0 (uniquement les vrais Timoptol 0.5%)
-- → flagged_orphans = lignes orphelines explicitement marquées (≠ scannables)
-- → healthy_rows = entrées correctement nommées depuis BDPM
