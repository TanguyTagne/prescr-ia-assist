CREATE TABLE public.pharmacy_instance_heartbeats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL,
  user_id UUID NOT NULL,
  instance_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  app_version TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, user_id, instance_id)
);

CREATE INDEX idx_heartbeats_pharmacy_last_seen
  ON public.pharmacy_instance_heartbeats (pharmacy_id, last_seen_at DESC);

ALTER TABLE public.pharmacy_instance_heartbeats ENABLE ROW LEVEL SECURITY;

-- Users can upsert/refresh their own heartbeat for their pharmacy
CREATE POLICY "Users insert own heartbeat"
  ON public.pharmacy_instance_heartbeats
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users update own heartbeat"
  ON public.pharmacy_instance_heartbeats
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own heartbeat"
  ON public.pharmacy_instance_heartbeats
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admin can read all; users can read their own pharmacy
CREATE POLICY "Admin read heartbeats"
  ON public.pharmacy_instance_heartbeats
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own pharmacy heartbeats"
  ON public.pharmacy_instance_heartbeats
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service manage heartbeats"
  ON public.pharmacy_instance_heartbeats
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Aggregated view: count connected instances per pharmacy (active = seen in last 3 min)
CREATE OR REPLACE FUNCTION public.get_pharmacy_connection_counts()
RETURNS TABLE (
  pharmacy_id UUID,
  connected_instances INTEGER,
  connected_users INTEGER,
  desktop_instances INTEGER,
  web_instances INTEGER,
  last_activity TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    h.pharmacy_id,
    COUNT(*)::int AS connected_instances,
    COUNT(DISTINCT h.user_id)::int AS connected_users,
    COUNT(*) FILTER (WHERE h.platform = 'desktop')::int AS desktop_instances,
    COUNT(*) FILTER (WHERE h.platform = 'web')::int AS web_instances,
    MAX(h.last_seen_at) AS last_activity
  FROM public.pharmacy_instance_heartbeats h
  WHERE h.last_seen_at > now() - interval '3 minutes'
  GROUP BY h.pharmacy_id;
$$;