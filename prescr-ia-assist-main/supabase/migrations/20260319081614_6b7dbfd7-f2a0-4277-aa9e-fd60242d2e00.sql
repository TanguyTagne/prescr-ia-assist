-- Sales transactions: each ticket/vente from the caisse
CREATE TABLE public.sales_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  transaction_id text,
  device_id text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_items integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'webhook'
);

-- Cross-sell tracking: links a sale to detected recommendations
CREATE TABLE public.cross_sell_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
  medicament_id uuid REFERENCES public.medicaments(id),
  medicament_nom text NOT NULL,
  pathologie_id uuid REFERENCES public.pathologies(id),
  pathologie_nom text,
  produit_complementaire_id uuid REFERENCES public.produits_complementaires(id),
  produit_complementaire_nom text NOT NULL,
  was_sold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_sell_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service can manage sales_transactions" ON public.sales_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage cross_sell_tracking" ON public.cross_sell_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin can read sales_transactions" ON public.sales_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can read cross_sell_tracking" ON public.cross_sell_tracking FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own pharmacy sales" ON public.sales_transactions FOR SELECT TO authenticated 
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can read own pharmacy cross_sell" ON public.cross_sell_tracking FOR SELECT TO authenticated 
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

-- Indexes
CREATE INDEX idx_sales_transactions_pharmacy ON public.sales_transactions(pharmacy_id, created_at DESC);
CREATE INDEX idx_cross_sell_tracking_pharmacy ON public.cross_sell_tracking(pharmacy_id, created_at DESC);
CREATE INDEX idx_cross_sell_tracking_medicament ON public.cross_sell_tracking(medicament_id);
CREATE INDEX idx_cross_sell_tracking_pathologie ON public.cross_sell_tracking(pathologie_id);