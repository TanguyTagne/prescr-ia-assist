
-- Table référentiel Top 300 ATC5
CREATE TABLE public.reference_top_300 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atc5_code text NOT NULL,
  molecule text NOT NULL,
  nom_commercial_ref text,
  volume_annuel integer DEFAULT 0,
  rang integer NOT NULL,
  classe_therapeutique text,
  source text DEFAULT 'open_medic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(atc5_code)
);

-- Table audit de couverture
CREATE TABLE public.medication_coverage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid REFERENCES public.reference_top_300(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'missing' CHECK (status IN ('present', 'missing', 'incomplete')),
  matched_medicament_id uuid,
  matched_molecule_id uuid,
  completeness_score integer DEFAULT 0,
  has_classe boolean DEFAULT false,
  has_contextes boolean DEFAULT false,
  has_symptomes boolean DEFAULT false,
  has_questions boolean DEFAULT false,
  has_suggestions_otc boolean DEFAULT false,
  has_pathologie_link boolean DEFAULT false,
  has_protocole boolean DEFAULT false,
  notes text,
  last_audit_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reference_top_300 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_coverage_audit ENABLE ROW LEVEL SECURITY;

-- Policies: admin full access, authenticated read
CREATE POLICY "Admin can manage reference_top_300" ON public.reference_top_300 FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read reference_top_300" ON public.reference_top_300 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage reference_top_300" ON public.reference_top_300 FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin can manage medication_coverage_audit" ON public.medication_coverage_audit FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read medication_coverage_audit" ON public.medication_coverage_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage medication_coverage_audit" ON public.medication_coverage_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
