-- Table for scanner/POS incoming scans
CREATE TABLE public.scan_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  scan_type text NOT NULL DEFAULT 'prescription',
  status text NOT NULL DEFAULT 'pending',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  source text NOT NULL DEFAULT 'api',
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.scan_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pharmacy scans"
  ON public.scan_queue FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Service can manage scan_queue"
  ON public.scan_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert scan_queue"
  ON public.scan_queue FOR INSERT TO anon
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_queue;

CREATE TABLE public.pharmacy_scanner_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  api_key text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  label text DEFAULT 'Scanner principal',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacy_scanner_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage scanner keys"
  ON public.pharmacy_scanner_keys FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own pharmacy scanner keys"
  ON public.pharmacy_scanner_keys FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Service can read scanner keys"
  ON public.pharmacy_scanner_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);