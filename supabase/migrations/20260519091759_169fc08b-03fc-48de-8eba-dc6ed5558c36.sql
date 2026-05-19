
CREATE TABLE public.medicament_pc_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL,
  medicament_nom text NOT NULL,
  pc_nom text NOT NULL,
  pc_categorie text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicament_pc_mapping_pharmacy ON public.medicament_pc_mapping(pharmacy_id);
CREATE UNIQUE INDEX uq_medicament_pc_mapping ON public.medicament_pc_mapping(pharmacy_id, lower(medicament_nom), lower(pc_nom));

ALTER TABLE public.medicament_pc_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage medicament_pc_mapping"
ON public.medicament_pc_mapping FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage medicament_pc_mapping"
ON public.medicament_pc_mapping FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users read own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR SELECT TO authenticated
USING (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users insert own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR INSERT TO authenticated
WITH CHECK (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users update own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR UPDATE TO authenticated
USING (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users delete own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR DELETE TO authenticated
USING (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER set_medicament_pc_mapping_updated_at
BEFORE UPDATE ON public.medicament_pc_mapping
FOR EACH ROW EXECUTE FUNCTION public.set_pharmacy_quotas_updated_at();
