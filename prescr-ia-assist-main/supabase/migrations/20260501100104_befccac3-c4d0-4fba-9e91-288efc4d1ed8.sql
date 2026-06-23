-- Tracking links: short shareable URLs to attribute clicks/demos/leads to a recipient
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  destination text NOT NULL DEFAULT '/',
  campaign text,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  clicks_count int NOT NULL DEFAULT 0,
  unique_clicks_count int NOT NULL DEFAULT 0,
  demos_count int NOT NULL DEFAULT 0,
  leads_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_links_slug ON public.tracking_links(slug);
CREATE INDEX idx_tracking_links_created_at ON public.tracking_links(created_at DESC);

ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tracking_links"
  ON public.tracking_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage tracking_links"
  ON public.tracking_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read active tracking_links by slug"
  ON public.tracking_links FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Click events
CREATE TABLE public.tracking_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.tracking_links(id) ON DELETE CASCADE,
  session_id text,
  ip_country text,
  ip_city text,
  referrer text,
  user_agent text,
  device_type text,
  is_unique boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_clicks_link_id ON public.tracking_clicks(link_id, created_at DESC);
CREATE INDEX idx_tracking_clicks_session ON public.tracking_clicks(link_id, session_id);

ALTER TABLE public.tracking_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read tracking_clicks"
  ON public.tracking_clicks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage tracking_clicks"
  ON public.tracking_clicks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Attribution columns
ALTER TABLE public.demo_sessions ADD COLUMN tracking_link_id uuid REFERENCES public.tracking_links(id) ON DELETE SET NULL;
ALTER TABLE public.demo_leads ADD COLUMN tracking_link_id uuid REFERENCES public.tracking_links(id) ON DELETE SET NULL;

CREATE INDEX idx_demo_sessions_tracking_link ON public.demo_sessions(tracking_link_id);
CREATE INDEX idx_demo_leads_tracking_link ON public.demo_leads(tracking_link_id);

-- Trigger to bump counters on demo_sessions / demo_leads
CREATE OR REPLACE FUNCTION public.bump_tracking_link_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'demo_sessions' AND NEW.tracking_link_id IS NOT NULL THEN
    UPDATE public.tracking_links
       SET demos_count = demos_count + 1, updated_at = now()
     WHERE id = NEW.tracking_link_id;
  ELSIF TG_TABLE_NAME = 'demo_leads' AND NEW.tracking_link_id IS NOT NULL THEN
    UPDATE public.tracking_links
       SET leads_count = leads_count + 1, updated_at = now()
     WHERE id = NEW.tracking_link_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_demo_sessions_bump_link
  AFTER INSERT ON public.demo_sessions
  FOR EACH ROW EXECUTE FUNCTION public.bump_tracking_link_counters();

CREATE TRIGGER trg_demo_leads_bump_link
  AFTER INSERT ON public.demo_leads
  FOR EACH ROW EXECUTE FUNCTION public.bump_tracking_link_counters();

CREATE TRIGGER trg_tracking_links_updated_at
  BEFORE UPDATE ON public.tracking_links
  FOR EACH ROW EXECUTE FUNCTION public.set_pharmacy_quotas_updated_at();