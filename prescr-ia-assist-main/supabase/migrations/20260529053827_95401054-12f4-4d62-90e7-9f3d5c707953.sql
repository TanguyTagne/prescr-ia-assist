
-- 1. Scope analysis_history & accepted_combinations policies to authenticated role only
ALTER POLICY "Users can insert own analysis_history" ON public.analysis_history TO authenticated;
ALTER POLICY "Users can read own pharmacy analysis_history" ON public.analysis_history TO authenticated;
ALTER POLICY "Admin can manage analysis_history" ON public.analysis_history TO authenticated;
ALTER POLICY "Users can insert their pharmacy combinations" ON public.accepted_combinations TO authenticated;
ALTER POLICY "Users can view their pharmacy combinations" ON public.accepted_combinations TO authenticated;

-- 2. Fix scan_events INSERT: prevent cross-pharmacy injection
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;
CREATE POLICY "Users can insert own pharmacy scan events"
  ON public.scan_events
  FOR INSERT TO authenticated
  WITH CHECK (
    pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Storage policies for private 'uploads' bucket (owner-scoped)
DROP POLICY IF EXISTS "Users can read own uploads" ON storage.objects;
CREATE POLICY "Users can read own uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can upload to uploads bucket" ON storage.objects;
CREATE POLICY "Users can upload to uploads bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND owner = auth.uid());
