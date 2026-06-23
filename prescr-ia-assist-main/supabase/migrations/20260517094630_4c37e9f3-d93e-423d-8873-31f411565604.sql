CREATE TABLE public.signalements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('medicament_different', 'pc_inadapte')),
  medicament_nom TEXT NOT NULL,
  pc_nom TEXT,
  pc_categorie TEXT,
  commentaire TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'resolu', 'rejete')),
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pharmacy signalements"
ON public.signalements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can read own pharmacy signalements"
ON public.signalements FOR SELECT TO authenticated
USING (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin can manage signalements"
ON public.signalements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage signalements"
ON public.signalements FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_signalements_pharmacy ON public.signalements(pharmacy_id);
CREATE INDEX idx_signalements_status ON public.signalements(status);
CREATE INDEX idx_signalements_created ON public.signalements(created_at DESC);

CREATE TRIGGER trg_signalements_updated_at
BEFORE UPDATE ON public.signalements
FOR EACH ROW EXECUTE FUNCTION public.set_pathology_protocol_updated_at();