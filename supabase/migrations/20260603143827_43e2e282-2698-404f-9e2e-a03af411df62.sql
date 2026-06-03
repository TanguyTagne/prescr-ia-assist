
-- 1. scan_events: enforce user_id = auth.uid() on INSERT
DROP POLICY IF EXISTS "Users can insert own pharmacy scan events" ON public.scan_events;
CREATE POLICY "Users can insert own pharmacy scan events"
ON public.scan_events
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. gdpr_requests: restrict INSERT to manager/admin
DROP POLICY IF EXISTS "Users can insert own pharmacy gdpr requests" ON public.gdpr_requests;
CREATE POLICY "Managers can insert own pharmacy gdpr requests"
ON public.gdpr_requests
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

-- 3. Remove orphan storage policies for non-existent 'uploads' bucket
DROP POLICY IF EXISTS "Pharmacy members can upload to uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacy members can read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacy members can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacy members can delete own uploads" ON storage.objects;
