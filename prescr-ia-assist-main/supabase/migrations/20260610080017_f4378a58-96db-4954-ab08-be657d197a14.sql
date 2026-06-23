
DROP POLICY IF EXISTS "Users update own profile (safe fields only)" ON public.profiles;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

CREATE POLICY "Users update own profile (safe fields only)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (pharmacy_id IS DISTINCT FROM (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (managed_groupement_id IS DISTINCT FROM (SELECT p.managed_groupement_id FROM public.profiles p WHERE p.id = auth.uid()))
);

DROP POLICY IF EXISTS "Anyone can insert demo sessions" ON public.demo_sessions;
CREATE POLICY "Anyone can insert demo sessions"
ON public.demo_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  COALESCE(length(user_agent), 0) <= 500
  AND COALESCE(length(ip_city), 0) <= 100
  AND COALESCE(length(ip_country), 0) <= 100
  AND COALESCE(length(referrer), 0) <= 500
);
