-- Table de logs centralisée pour tous les scans HID de toutes les pharmacies.
-- Visible uniquement par les admins. Utilisée dans le Diagnostic Hardware admin.

CREATE TABLE IF NOT EXISTS public.scan_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  pharmacy_id       UUID        REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  user_id           UUID,
  register_id       TEXT,
  ean_code          TEXT        NOT NULL,
  status            TEXT        NOT NULL
                    CHECK (status IN ('success', 'no_match', 'no_pharmacy', 'error', 'anti_loop')),
  product_name      TEXT,
  suggestions_count INT         NOT NULL DEFAULT 0,
  error_message     TEXT,
  metadata          JSONB
);

CREATE INDEX IF NOT EXISTS scan_events_created_at_idx  ON public.scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS scan_events_pharmacy_id_idx ON public.scan_events (pharmacy_id);
CREATE INDEX IF NOT EXISTS scan_events_status_idx      ON public.scan_events (status);

-- RLS
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Trigger : remplit user_id depuis le JWT — le client n'a pas à l'envoyer.
CREATE OR REPLACE FUNCTION public.set_scan_event_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER scan_events_set_user
  BEFORE INSERT ON public.scan_events
  FOR EACH ROW EXECUTE FUNCTION public.set_scan_event_user();

-- Tout utilisateur authentifié peut écrire (les pharmaciens loguent leurs scans)
CREATE POLICY "Authenticated users can insert scan events"
  ON public.scan_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Seuls les admins peuvent lire l'ensemble des événements
CREATE POLICY "Admins can read all scan events"
  ON public.scan_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
