
-- 1) Profiles: remove the overly broad UPDATE policy; keep only the safe-fields-only one
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2) Groupements: restrict contact fields exposure — only admins and group managers can read
DROP POLICY IF EXISTS "Users read own or managed groupement" ON public.groupements;

CREATE POLICY "Admins and managers read groupements"
ON public.groupements
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id = get_user_managed_groupement(auth.uid())
);

-- 3) scan_events: drop the unconstrained insert policy (service_role bypasses RLS anyway,
-- and the named policy allowed any caller to insert with just pharmacy_id, masking origin)
DROP POLICY IF EXISTS "service_role can insert scan_events with pharmacy" ON public.scan_events;
