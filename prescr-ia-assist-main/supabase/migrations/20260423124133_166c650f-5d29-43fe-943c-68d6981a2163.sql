-- Table: demo_sessions (tracking anonyme)
CREATE TABLE public.demo_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  ordonnance_id TEXT NOT NULL,
  ip_country TEXT,
  ip_city TEXT,
  referrer TEXT,
  user_agent TEXT,
  converted_to_lead BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_sessions_session_id ON public.demo_sessions(session_id);
CREATE INDEX idx_demo_sessions_created_at ON public.demo_sessions(created_at DESC);

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert demo sessions"
  ON public.demo_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can read demo sessions"
  ON public.demo_sessions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update demo sessions"
  ON public.demo_sessions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage demo sessions"
  ON public.demo_sessions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Table: demo_leads (coordonnées opt-in)
CREATE TABLE public.demo_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  officine TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouveau',
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_leads_session_id ON public.demo_leads(session_id);
CREATE INDEX idx_demo_leads_created_at ON public.demo_leads(created_at DESC);
CREATE INDEX idx_demo_leads_status ON public.demo_leads(status);

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert demo leads"
  ON public.demo_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can read demo leads"
  ON public.demo_leads FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update demo leads"
  ON public.demo_leads FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete demo leads"
  ON public.demo_leads FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage demo leads"
  ON public.demo_leads FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER demo_leads_updated_at
  BEFORE UPDATE ON public.demo_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pathology_protocol_updated_at();