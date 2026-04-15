
-- 1. Table des caisses (registers) par pharmacie
CREATE TABLE public.pharmacy_registers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Caisse 1',
  device_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, label)
);

ALTER TABLE public.pharmacy_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage registers" ON public.pharmacy_registers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own pharmacy registers" ON public.pharmacy_registers
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can manage own pharmacy registers" ON public.pharmacy_registers
  FOR ALL TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Service can manage registers" ON public.pharmacy_registers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Table feedback des recommandations PC
CREATE TABLE public.pc_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  register_id UUID REFERENCES public.pharmacy_registers(id),
  user_id UUID NOT NULL,
  medicament_nom TEXT NOT NULL,
  pc_nom TEXT NOT NULL,
  pc_categorie TEXT,
  action TEXT NOT NULL DEFAULT 'accepted',
  reason TEXT,
  analysis_id UUID REFERENCES public.analysis_history(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pc_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pharmacy feedback" ON public.pc_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can read own pharmacy feedback" ON public.pc_feedback
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admin can manage feedback" ON public.pc_feedback
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage feedback" ON public.pc_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_pc_feedback_pharmacy ON public.pc_feedback(pharmacy_id);
CREATE INDEX idx_pc_feedback_action ON public.pc_feedback(action);
CREATE INDEX idx_pc_feedback_created ON public.pc_feedback(created_at);

-- 3. Table benchmark anonymisé
CREATE TABLE public.pharmacy_benchmark (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  total_analyses INTEGER NOT NULL DEFAULT 0,
  avg_analyses_per_day NUMERIC NOT NULL DEFAULT 0,
  total_pc_proposed INTEGER NOT NULL DEFAULT 0,
  total_pc_sold INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC NOT NULL DEFAULT 0,
  avg_pc_per_analysis NUMERIC NOT NULL DEFAULT 0,
  top_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, period, period_start)
);

ALTER TABLE public.pharmacy_benchmark ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage benchmark" ON public.pharmacy_benchmark
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage benchmark" ON public.pharmacy_benchmark
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_benchmark_period ON public.pharmacy_benchmark(period, period_start);

-- 4. Ajouter register_id aux tables existantes
ALTER TABLE public.analysis_history ADD COLUMN register_id UUID REFERENCES public.pharmacy_registers(id);
ALTER TABLE public.analytics_events ADD COLUMN register_id UUID REFERENCES public.pharmacy_registers(id);
ALTER TABLE public.recommendation_metrics ADD COLUMN register_id UUID REFERENCES public.pharmacy_registers(id);

-- 5. Index pour les requêtes par caisse
CREATE INDEX idx_analysis_history_register ON public.analysis_history(register_id);
CREATE INDEX idx_analytics_events_register ON public.analytics_events(register_id);
CREATE INDEX idx_recommendation_metrics_register ON public.recommendation_metrics(register_id);

-- 6. Enable realtime for pc_feedback
ALTER PUBLICATION supabase_realtime ADD TABLE public.pc_feedback;
