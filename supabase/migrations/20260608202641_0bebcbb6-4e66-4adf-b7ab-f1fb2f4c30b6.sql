
-- 1) Hide pharmacy_lgo_config.api_key from authenticated role (managers + admins).
--    Server-side service_role keeps full access for edge functions (lgo-push-cart).
--    Writes (INSERT/UPDATE) are still permitted by existing column-level INSERT/UPDATE grants.
REVOKE SELECT (api_key) ON public.pharmacy_lgo_config FROM authenticated;

-- 2) Lock down demo_leads INSERT. The submit-demo-lead edge function uses
--    service_role and validates inputs server-side; no client should insert directly.
DROP POLICY IF EXISTS "Anyone can insert demo leads" ON public.demo_leads;
