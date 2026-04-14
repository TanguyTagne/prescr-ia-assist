
-- Restrict pharmacy_lgo_config: remove user read policy, only admin can see API keys
DROP POLICY IF EXISTS "Users can read own pharmacy lgo config" ON public.pharmacy_lgo_config;

-- Restrict pharmacy_scanner_keys: remove user read policy, only admin can see raw API keys  
DROP POLICY IF EXISTS "Users can read own pharmacy scanner keys" ON public.pharmacy_scanner_keys;
