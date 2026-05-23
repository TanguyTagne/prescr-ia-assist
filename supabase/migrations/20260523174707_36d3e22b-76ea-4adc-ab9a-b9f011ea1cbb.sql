REVOKE EXECUTE ON FUNCTION public.get_pharmacy_connection_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pharmacy_connection_counts() TO authenticated, service_role;