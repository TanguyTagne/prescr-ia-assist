-- Remove permissive INSERT policies on scan_events that allow cross-pharmacy writes
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;
DROP POLICY IF EXISTS "Users can insert own pharmacy scan_events" ON public.scan_events;

-- Keep only the strict pharmacy-scoped INSERT policy (already exists: "Users can insert own pharmacy scan events")
-- Recreate it defensively to ensure it exists with strict scope
DROP POLICY IF EXISTS "Users can insert own pharmacy scan events" ON public.scan_events;
CREATE POLICY "Users can insert own pharmacy scan events"
ON public.scan_events
FOR INSERT
TO authenticated
WITH CHECK (
  pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

-- Add explicit pharmacy-scoped INSERT policy on scan_queue (currently only service_role can write)
CREATE POLICY "Users can insert own pharmacy scan_queue"
ON public.scan_queue
FOR INSERT
TO authenticated
WITH CHECK (
  pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);