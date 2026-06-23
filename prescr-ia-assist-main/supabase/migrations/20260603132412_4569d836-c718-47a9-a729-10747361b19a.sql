-- 1) Fix scan_events: drop over-permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;

-- 2) Protect pharmacy_lgo_config.api_key from client-side reads
-- Managers/admins keep table-level SELECT for the other columns; api_key is service_role only.
REVOKE SELECT (api_key) ON public.pharmacy_lgo_config FROM authenticated;
REVOKE SELECT (api_key) ON public.pharmacy_lgo_config FROM anon;

-- 3) Defense-in-depth: prevent UPDATE on sensitive profile columns at the GRANT layer
-- (trigger prevent_profile_privilege_escalation_trigger already enforces this)
REVOKE UPDATE (role, pharmacy_id, managed_groupement_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (role, pharmacy_id, managed_groupement_id) ON public.profiles FROM anon;