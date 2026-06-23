
-- 1. scan_events: add SELECT policy scoped to user's pharmacy
CREATE POLICY "Users can read own pharmacy scan events"
  ON public.scan_events
  FOR SELECT
  TO authenticated
  USING (
    pharmacy_id IN (
      SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. uploads bucket: scope by pharmacy_id folder prefix (consistent with 'imports')
DROP POLICY IF EXISTS "Users can upload to uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

CREATE POLICY "Pharmacy members can upload to uploads bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can read uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can update own uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Pharmacy members can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IN (
      SELECT pharmacy_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
