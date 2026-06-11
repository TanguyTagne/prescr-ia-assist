-- Drop overly permissive INSERT policy on scan_events; rely on per-pharmacy policy
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;

-- Remove tables from Realtime publication that don't need broadcast (basket_context, pc_feedback)
-- These contain sensitive prescription/feedback data and are not consumed via realtime subscriptions client-side.
ALTER PUBLICATION supabase_realtime DROP TABLE public.basket_context;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pc_feedback;