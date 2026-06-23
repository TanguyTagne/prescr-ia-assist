-- 1. Ajouter colonnes finalite + trigger_atc sur produits_complementaires
ALTER TABLE public.produits_complementaires
  ADD COLUMN IF NOT EXISTS finalite text,
  ADD COLUMN IF NOT EXISTS trigger_atc_prefixes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS finalite_audited_at timestamptz;

ALTER TABLE public.produits_complementaires
  DROP CONSTRAINT IF EXISTS pc_finalite_check;

ALTER TABLE public.produits_complementaires
  ADD CONSTRAINT pc_finalite_check
  CHECK (finalite IS NULL OR finalite IN ('side_effect','treatment_support','symptom_relief'));

-- 2. Table des liens validés med ↔ pc avec finalité explicite
CREATE TABLE IF NOT EXISTS public.medicament_pc_valide (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medicament_id uuid NOT NULL,
  pc_id uuid NOT NULL,
  finalite text NOT NULL CHECK (finalite IN ('side_effect','treatment_support','symptom_relief')),
  score integer NOT NULL DEFAULT 50,
  source text NOT NULL DEFAULT 'audit_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicament_id, pc_id)
);

CREATE INDEX IF NOT EXISTS idx_med_pc_valide_med ON public.medicament_pc_valide(medicament_id);
CREATE INDEX IF NOT EXISTS idx_med_pc_valide_pc ON public.medicament_pc_valide(pc_id);

ALTER TABLE public.medicament_pc_valide ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read medicament_pc_valide" ON public.medicament_pc_valide;
CREATE POLICY "Authenticated can read medicament_pc_valide"
  ON public.medicament_pc_valide FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service can read medicament_pc_valide" ON public.medicament_pc_valide;
CREATE POLICY "Service can read medicament_pc_valide"
  ON public.medicament_pc_valide FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Admin can manage medicament_pc_valide" ON public.medicament_pc_valide;
CREATE POLICY "Admin can manage medicament_pc_valide"
  ON public.medicament_pc_valide FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Service can manage medicament_pc_valide" ON public.medicament_pc_valide;
CREATE POLICY "Service can manage medicament_pc_valide"
  ON public.medicament_pc_valide FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Table de suivi des audits
CREATE TABLE IF NOT EXISTS public.pc_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  pcs_classified integer NOT NULL DEFAULT 0,
  links_created integer NOT NULL DEFAULT 0,
  links_rejected integer NOT NULL DEFAULT 0,
  orphans_filled integer NOT NULL DEFAULT 0,
  new_pcs_created integer NOT NULL DEFAULT 0,
  error text
);

ALTER TABLE public.pc_audit_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage pc_audit_runs" ON public.pc_audit_runs;
CREATE POLICY "Admin can manage pc_audit_runs"
  ON public.pc_audit_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Service can manage pc_audit_runs" ON public.pc_audit_runs;
CREATE POLICY "Service can manage pc_audit_runs"
  ON public.pc_audit_runs FOR ALL TO service_role USING (true) WITH CHECK (true);