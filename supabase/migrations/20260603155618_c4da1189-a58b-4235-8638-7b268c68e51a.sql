-- 1) Defense-in-depth on profiles UPDATE: forbid self-mutation of sensitive fields at the policy level
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile (safe fields only)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND pharmacy_id IS NOT DISTINCT FROM (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
  AND managed_groupement_id IS NOT DISTINCT FROM (SELECT p.managed_groupement_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2) Service-role INSERT policy on scan_events with pharmacy_id constraint
DROP POLICY IF EXISTS "service_role can insert scan_events with pharmacy" ON public.scan_events;
CREATE POLICY "service_role can insert scan_events with pharmacy"
ON public.scan_events
FOR INSERT
TO service_role
WITH CHECK (pharmacy_id IS NOT NULL);
