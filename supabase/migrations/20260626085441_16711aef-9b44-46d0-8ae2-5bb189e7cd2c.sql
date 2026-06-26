ALTER TABLE public.scan_queue
  ADD COLUMN IF NOT EXISTS wwks2_source_id integer,
  ADD COLUMN IF NOT EXISTS ean_code text;

CREATE INDEX IF NOT EXISTS scan_queue_pharmacy_wwks2_idx
  ON public.scan_queue (pharmacy_id, wwks2_source_id);
