
-- 1. Make sale_id nullable on cross_sell_tracking so we can record scan-based matches
ALTER TABLE public.cross_sell_tracking ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE public.cross_sell_tracking ADD COLUMN IF NOT EXISTS match_source text NOT NULL DEFAULT 'sale';
ALTER TABLE public.cross_sell_tracking ADD COLUMN IF NOT EXISTS matched_at timestamptz;

-- 2. Pending PC table: stores every recommended PC after a med scan,
--    so we can match a subsequent product scan within 10 minutes.
CREATE TABLE IF NOT EXISTS public.pending_cross_sell (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  device_id text,
  medicament_id uuid,
  medicament_nom text NOT NULL,
  pc_name text NOT NULL,
  pc_normalized text NOT NULL,
  pc_cip text,
  pathologie_id uuid,
  pathologie_nom text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  matched_at timestamptz,
  matched_cip text,
  matched_nom text
);

GRANT SELECT ON public.pending_cross_sell TO authenticated;
GRANT ALL ON public.pending_cross_sell TO service_role;

ALTER TABLE public.pending_cross_sell ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage pending_cross_sell"
  ON public.pending_cross_sell FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own pharmacy pending_cross_sell"
  ON public.pending_cross_sell FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admin can read pending_cross_sell"
  ON public.pending_cross_sell FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_pending_cs_pharmacy_active
  ON public.pending_cross_sell (pharmacy_id, expires_at)
  WHERE matched_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_cs_normalized
  ON public.pending_cross_sell (pharmacy_id, pc_normalized);
