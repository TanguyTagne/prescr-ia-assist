CREATE TABLE public.medicament_curated_pcs (
  medicament_id uuid PRIMARY KEY REFERENCES public.medicaments(id) ON DELETE CASCADE,
  pc_1 text,
  pc_2 text,
  pc_3 text,
  source text NOT NULL DEFAULT 'csv_2026_06',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.medicament_curated_pcs TO authenticated;
GRANT ALL ON public.medicament_curated_pcs TO service_role;

ALTER TABLE public.medicament_curated_pcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read medicament_curated_pcs"
ON public.medicament_curated_pcs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage medicament_curated_pcs"
ON public.medicament_curated_pcs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage medicament_curated_pcs"
ON public.medicament_curated_pcs FOR ALL TO service_role USING (true) WITH CHECK (true);