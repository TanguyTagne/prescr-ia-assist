
-- Fix analytics_events INSERT policy: scope pharmacy_id to user's own pharmacy
DROP POLICY IF EXISTS "Users can insert analytics" ON public.analytics_events;
CREATE POLICY "Users can insert analytics" ON public.analytics_events
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    pharmacy_id IS NULL
    OR pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
  )
);

-- Fix recommendation_usage INSERT policy: scope pharmacy_id to user's own pharmacy
DROP POLICY IF EXISTS "Users can insert recommendation_usage" ON public.recommendation_usage;
CREATE POLICY "Users can insert recommendation_usage" ON public.recommendation_usage
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    pharmacy_id IS NULL
    OR pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
  )
);
