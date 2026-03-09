
-- Analysis history table for anonymized patient tracking
CREATE TABLE public.analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  patient_hash text NOT NULL,
  prescription_hash text NOT NULL,
  medicaments jsonb NOT NULL DEFAULT '[]'::jsonb,
  interactions_count integer NOT NULL DEFAULT 0,
  suggestions_count integer NOT NULL DEFAULT 0,
  has_major_interaction boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_analysis_history_pharmacy ON public.analysis_history(pharmacy_id);
CREATE INDEX idx_analysis_history_patient_hash ON public.analysis_history(patient_hash);
CREATE INDEX idx_analysis_history_prescription_hash ON public.analysis_history(prescription_hash);
CREATE INDEX idx_analysis_history_created_at ON public.analysis_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "Admin can manage analysis_history"
ON public.analysis_history FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own
CREATE POLICY "Users can insert own analysis_history"
ON public.analysis_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can read own pharmacy's history
CREATE POLICY "Users can read own pharmacy analysis_history"
ON public.analysis_history FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid())
);
