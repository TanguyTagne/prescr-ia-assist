
-- Table: basket_context — mémoire du panier actif pour anti-boucle
CREATE TABLE public.basket_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) NOT NULL,
  session_id text NOT NULL,
  scanned_medicaments jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_pcs jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_pcs jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_pcs jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.basket_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pharmacy basket_context" ON public.basket_context
  FOR ALL TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Service can manage basket_context" ON public.basket_context
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Table: recommendation_metrics — tracking KPI réel des PC
CREATE TABLE public.recommendation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) NOT NULL,
  medicament_source text NOT NULL,
  pc_proposed text NOT NULL,
  pc_categorie text,
  times_proposed integer NOT NULL DEFAULT 0,
  times_displayed integer NOT NULL DEFAULT 0,
  times_clicked integer NOT NULL DEFAULT 0,
  times_scanned integer NOT NULL DEFAULT 0,
  times_sold integer NOT NULL DEFAULT 0,
  conversion_rate numeric GENERATED ALWAYS AS (
    CASE WHEN times_proposed > 0 THEN (times_sold::numeric / times_proposed::numeric) ELSE 0 END
  ) STORED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, medicament_source, pc_proposed)
);

ALTER TABLE public.recommendation_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pharmacy metrics" ON public.recommendation_metrics
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admin can manage recommendation_metrics" ON public.recommendation_metrics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage recommendation_metrics" ON public.recommendation_metrics
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Table: product_mapping — personnalisation par pharmacie (push produit)
CREATE TABLE public.product_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) NOT NULL,
  categorie text NOT NULL,
  produit_selectionne text NOT NULL,
  cip_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, categorie)
);

ALTER TABLE public.product_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pharmacy product_mapping" ON public.product_mapping
  FOR ALL TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admin can manage product_mapping" ON public.product_mapping
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage product_mapping" ON public.product_mapping
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable realtime for basket_context
ALTER PUBLICATION supabase_realtime ADD TABLE public.basket_context;
