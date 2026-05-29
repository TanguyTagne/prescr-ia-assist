
-- 1. Add detection_source column to pc_feedback
ALTER TABLE public.pc_feedback
  ADD COLUMN IF NOT EXISTS detection_source TEXT NOT NULL DEFAULT 'manual_click';

ALTER TABLE public.pc_feedback
  ADD CONSTRAINT pc_feedback_detection_source_chk
  CHECK (detection_source IN ('manual_click','hid_auto','lgo_sale','inferred'));

-- 2. Create sales_attribution_monthly
CREATE TABLE IF NOT EXISTS public.sales_attribution_monthly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL,
  month DATE NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  proposed_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  hid_auto_count INTEGER NOT NULL DEFAULT 0,
  inferred_count INTEGER NOT NULL DEFAULT 0,
  total_attributed INTEGER NOT NULL DEFAULT 0,
  revenue_estimate NUMERIC NOT NULL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, month, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_attribution_monthly TO authenticated;
GRANT ALL ON public.sales_attribution_monthly TO service_role;

ALTER TABLE public.sales_attribution_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage sales_attribution_monthly"
  ON public.sales_attribution_monthly
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage sales_attribution_monthly"
  ON public.sales_attribution_monthly
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own pharmacy sales_attribution"
  ON public.sales_attribution_monthly
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sales_attribution_pharmacy_month
  ON public.sales_attribution_monthly (pharmacy_id, month DESC);
