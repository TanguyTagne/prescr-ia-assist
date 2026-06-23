
CREATE TABLE public.unmatched_medicaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom_saisi TEXT NOT NULL,
  nom_normalise TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  notes TEXT,
  UNIQUE(nom_normalise)
);

ALTER TABLE public.unmatched_medicaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage unmatched_medicaments"
  ON public.unmatched_medicaments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can manage unmatched_medicaments"
  ON public.unmatched_medicaments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read unmatched_medicaments"
  ON public.unmatched_medicaments FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_unmatched_status ON public.unmatched_medicaments(status);
CREATE INDEX idx_unmatched_occurrence ON public.unmatched_medicaments(occurrence_count DESC);
