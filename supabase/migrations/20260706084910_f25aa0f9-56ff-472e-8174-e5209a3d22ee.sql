
-- Allow heartbeats regardless of pharmacy status so admin sees ghost connections
DROP POLICY IF EXISTS "Users insert own heartbeat" ON public.pharmacy_instance_heartbeats;
CREATE POLICY "Users insert own heartbeat"
ON public.pharmacy_instance_heartbeats
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Users update own heartbeat" ON public.pharmacy_instance_heartbeats;
CREATE POLICY "Users update own heartbeat"
ON public.pharmacy_instance_heartbeats
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
