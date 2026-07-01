CREATE POLICY "Users can insert own pharmacy metrics" ON public.recommendation_metrics
  FOR INSERT TO authenticated
  WITH CHECK (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update own pharmacy metrics" ON public.recommendation_metrics
  FOR UPDATE TO authenticated
  USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (pharmacy_id IN (SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()));