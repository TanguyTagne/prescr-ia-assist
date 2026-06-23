CREATE TABLE public.accepted_combinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL,
  user_id UUID,
  register_id UUID,
  medicaments_analyses TEXT[] NOT NULL DEFAULT '{}',
  pcs_proposes TEXT[] NOT NULL DEFAULT '{}',
  pc_accepte TEXT NOT NULL,
  pc_categorie TEXT,
  medicament_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accepted_combinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their pharmacy combinations"
ON public.accepted_combinations FOR SELECT
USING (
  pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can insert their pharmacy combinations"
ON public.accepted_combinations FOR INSERT
WITH CHECK (
  pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

CREATE INDEX idx_accepted_combinations_pharmacy ON public.accepted_combinations(pharmacy_id, created_at DESC);