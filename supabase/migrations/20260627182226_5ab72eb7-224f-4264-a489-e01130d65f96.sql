CREATE TABLE IF NOT EXISTS public.pc_cip_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_label TEXT NOT NULL,
  pc_label_norm TEXT NOT NULL,
  categorie TEXT,
  type_produit TEXT,
  code TEXT NOT NULL,
  type_code TEXT,
  produit_reference TEXT,
  marque TEXT,
  source TEXT,
  statut TEXT,
  occurrences INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pc_label_norm, code)
);

CREATE INDEX IF NOT EXISTS pc_cip_mapping_code_idx ON public.pc_cip_mapping (code);
CREATE INDEX IF NOT EXISTS pc_cip_mapping_label_norm_idx ON public.pc_cip_mapping (pc_label_norm);

GRANT SELECT ON public.pc_cip_mapping TO authenticated;
GRANT ALL ON public.pc_cip_mapping TO service_role;

ALTER TABLE public.pc_cip_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pc_cip_mapping"
  ON public.pc_cip_mapping FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pc_cip_mapping"
  ON public.pc_cip_mapping FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));