
-- Table: latent_needs — maps medications to hidden/inferred patient needs
CREATE TABLE public.latent_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicament_source TEXT NOT NULL,
  besoin_infere TEXT NOT NULL,
  categorie TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0.5,
  description TEXT,
  phrase_patient TEXT,
  benefice TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(medicament_source, besoin_infere)
);

ALTER TABLE public.latent_needs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage latent_needs" ON public.latent_needs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read latent_needs" ON public.latent_needs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can read latent_needs" ON public.latent_needs
  FOR SELECT TO service_role
  USING (true);

-- Table: latent_need_metrics — tracks conversion impact of hidden needs
CREATE TABLE public.latent_need_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id),
  besoin TEXT NOT NULL,
  medicament_source TEXT NOT NULL,
  pc_proposed TEXT NOT NULL,
  times_proposed INTEGER NOT NULL DEFAULT 0,
  times_converted INTEGER NOT NULL DEFAULT 0,
  impact_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.latent_need_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage latent_need_metrics" ON public.latent_need_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can manage latent_need_metrics" ON public.latent_need_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own pharmacy latent_need_metrics" ON public.latent_need_metrics
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));
