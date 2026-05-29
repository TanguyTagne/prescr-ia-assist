-- Fix 1: Remove unscoped INSERT policy on scan_events
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;

CREATE POLICY "Users can insert own pharmacy scan_events"
  ON public.scan_events FOR INSERT
  TO authenticated
  WITH CHECK (
    pharmacy_id IS NULL OR pharmacy_id IN (
      SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Fix 2: Scope analysis_history INSERT to user's pharmacy
DROP POLICY IF EXISTS "Users can insert own analysis_history" ON public.analysis_history;

CREATE POLICY "Users can insert own pharmacy analysis_history"
  ON public.analysis_history FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    pharmacy_id IN (
      SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Fix 3: Explicit storage policies for private 'imports' bucket (pharmacy-scoped via folder name = pharmacy_id)
CREATE POLICY "Pharmacy members can read own imports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can upload own imports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can update own imports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can delete own imports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );