
-- ============================================================
-- 1) profiles: lock privileged columns via column-level REVOKE
--    (defense-in-depth on top of existing trigger)
-- ============================================================
REVOKE UPDATE (role, pharmacy_id, managed_groupement_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (role, pharmacy_id, managed_groupement_id) ON public.profiles FROM anon;
-- service_role keeps full access (admin RPCs / triggers)
GRANT UPDATE (role, pharmacy_id, managed_groupement_id) ON public.profiles TO service_role;

-- ============================================================
-- 2) pharmacy_lgo_config: hide api_key from managers
--    Only service_role (edge functions) can read raw api_key.
-- ============================================================
REVOKE SELECT (api_key) ON public.pharmacy_lgo_config FROM authenticated;
REVOKE SELECT (api_key) ON public.pharmacy_lgo_config FROM anon;
GRANT  SELECT (api_key) ON public.pharmacy_lgo_config TO service_role;

-- Also block managers from writing api_key directly (must go through edge function)
REVOKE INSERT (api_key), UPDATE (api_key) ON public.pharmacy_lgo_config FROM authenticated;
GRANT  INSERT (api_key), UPDATE (api_key) ON public.pharmacy_lgo_config TO service_role;

-- ============================================================
-- 3) storage.objects (imports bucket): add owner check on UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Pharmacy members can delete own imports" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacy members can update own imports" ON storage.objects;

CREATE POLICY "Pharmacy members can delete own imports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'imports'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] IN (
    SELECT (profiles.pharmacy_id)::text FROM profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Pharmacy members can update own imports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'imports'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] IN (
    SELECT (profiles.pharmacy_id)::text FROM profiles WHERE profiles.id = auth.uid()
  )
);
