
CREATE TABLE IF NOT EXISTS public.medicament_atc_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicament_id UUID NOT NULL REFERENCES public.medicaments(id) ON DELETE CASCADE,
  nom_commercial TEXT NOT NULL,
  current_atc TEXT,
  suggested_atc TEXT,
  current_class_name TEXT,
  suggested_class_name TEXT,
  mismatch BOOLEAN NOT NULL DEFAULT false,
  confidence TEXT,
  reasoning TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medicament_id)
);

GRANT SELECT, UPDATE ON public.medicament_atc_audit TO authenticated;
GRANT ALL ON public.medicament_atc_audit TO service_role;

ALTER TABLE public.medicament_atc_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read atc audit"
  ON public.medicament_atc_audit FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update atc audit"
  ON public.medicament_atc_audit FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS medicament_atc_audit_mismatch_idx
  ON public.medicament_atc_audit (mismatch) WHERE mismatch = true;

CREATE OR REPLACE FUNCTION public.set_atc_audit_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS atc_audit_updated_at ON public.medicament_atc_audit;
CREATE TRIGGER atc_audit_updated_at
  BEFORE UPDATE ON public.medicament_atc_audit
  FOR EACH ROW EXECUTE FUNCTION public.set_atc_audit_updated_at();
