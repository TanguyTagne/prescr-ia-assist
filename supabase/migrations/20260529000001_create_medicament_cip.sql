-- Lookup table : CIP13 → médicament
-- Source : BDPM (15 848 spécialités) + TOP 2500 XLSX
-- ~37 600 entrées | 10 143 CIP13 uniques | 2 714 médicaments couverts
-- Peuplée via l'edge function import-cip-mapping

CREATE TABLE IF NOT EXISTS public.medicament_cip (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cip13          TEXT        NOT NULL,
  medicament_nom TEXT        NOT NULL,
  denomination   TEXT,        -- Dénomination complète BDPM
  forme          TEXT,
  statut         TEXT,
  cis            TEXT,        -- Code Identifiant Spécialité (BDPM)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cip13, medicament_nom)
);

CREATE INDEX IF NOT EXISTS medicament_cip_cip13_idx ON public.medicament_cip (cip13);
CREATE INDEX IF NOT EXISTS medicament_cip_nom_idx   ON public.medicament_cip (medicament_nom);

ALTER TABLE public.medicament_cip ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés (scanner, pharmaciens)
CREATE POLICY "Authenticated read medicament_cip"
  ON public.medicament_cip FOR SELECT TO authenticated
  USING (true);

-- Gestion : admins uniquement
CREATE POLICY "Admins manage medicament_cip"
  ON public.medicament_cip FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
