
ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS posologie TEXT,
  ADD COLUMN IF NOT EXISTS voie_administration TEXT;

ALTER TABLE public.produits_complementaires
  ADD COLUMN IF NOT EXISTS medicament_id UUID REFERENCES public.medicaments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_produits_complementaires_medicament_id
  ON public.produits_complementaires(medicament_id)
  WHERE medicament_id IS NOT NULL;
