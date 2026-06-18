-- Prevent any non-admin/non-service role from reading the raw api_key column.
REVOKE SELECT (api_key) ON public.pharmacy_scanner_keys FROM authenticated;
REVOKE SELECT (api_key) ON public.pharmacy_scanner_keys FROM anon;