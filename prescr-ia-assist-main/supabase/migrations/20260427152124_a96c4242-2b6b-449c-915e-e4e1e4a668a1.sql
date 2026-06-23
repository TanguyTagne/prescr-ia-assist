REVOKE EXECUTE ON FUNCTION public.check_and_increment_quota(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_quota(UUID, TEXT) TO authenticated, service_role;