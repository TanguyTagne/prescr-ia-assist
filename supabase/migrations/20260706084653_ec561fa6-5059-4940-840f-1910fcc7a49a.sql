
-- Helper: check if a pharmacy is active (used by RLS to hard-block disabled/paused pharmacies)
CREATE OR REPLACE FUNCTION public.is_pharmacy_active(_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.pharmacies WHERE id = _pharmacy_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_pharmacy_active(uuid) TO authenticated, anon, service_role;

-- ANALYSIS_HISTORY: block inserts for disabled/paused pharmacies
DROP POLICY IF EXISTS "Users can insert own pharmacy analysis_history" ON public.analysis_history;
CREATE POLICY "Users can insert own pharmacy analysis_history"
ON public.analysis_history
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
  AND public.is_pharmacy_active(pharmacy_id)
);

-- HEARTBEATS: block inserts/updates for disabled/paused pharmacies
DROP POLICY IF EXISTS "Users insert own heartbeat" ON public.pharmacy_instance_heartbeats;
CREATE POLICY "Users insert own heartbeat"
ON public.pharmacy_instance_heartbeats
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
  AND public.is_pharmacy_active(pharmacy_id)
);

DROP POLICY IF EXISTS "Users update own heartbeat" ON public.pharmacy_instance_heartbeats;
CREATE POLICY "Users update own heartbeat"
ON public.pharmacy_instance_heartbeats
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.is_pharmacy_active(pharmacy_id))
WITH CHECK (auth.uid() = user_id AND public.is_pharmacy_active(pharmacy_id));

-- SCAN_EVENTS: block scan tracking when pharmacy is disabled
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='scan_events' AND schemaname='public' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.scan_events', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users insert own pharmacy scan_events"
ON public.scan_events
FOR INSERT
TO authenticated
WITH CHECK (
  pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
  AND public.is_pharmacy_active(pharmacy_id)
);

-- Clean up stale heartbeats & recent analyses for pharmacies currently disabled/paused
DELETE FROM public.pharmacy_instance_heartbeats
WHERE pharmacy_id IN (SELECT id FROM public.pharmacies WHERE status <> 'active');
