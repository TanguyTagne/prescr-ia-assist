
-- 1) Helper to read the current user's pharmacy id without recursive RLS issues
CREATE OR REPLACE FUNCTION public.current_user_pharmacy_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_user_pharmacy_id() TO authenticated;

-- 2) Restrict realtime subscriptions on scan_queue_* topics to the user's own pharmacy.
--    Other realtime topics (e.g. analysis_feed) remain allowed.
DROP POLICY IF EXISTS "scan_queue topic restricted to own pharmacy" ON realtime.messages;
CREATE POLICY "scan_queue topic restricted to own pharmacy"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'scan_queue_%'
      THEN realtime.topic() = 'scan_queue_' || COALESCE(public.current_user_pharmacy_id()::text, '')
    ELSE true
  END
);

-- 3) user_roles: explicit restrictive policies blocking any write from end users.
--    Service-role edge functions bypass RLS so admin flows keep working.
DROP POLICY IF EXISTS "no_insert_user_roles_authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "no_update_user_roles_authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "no_delete_user_roles_authenticated" ON public.user_roles;

CREATE POLICY "no_insert_user_roles_authenticated"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "no_update_user_roles_authenticated"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "no_delete_user_roles_authenticated"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);
