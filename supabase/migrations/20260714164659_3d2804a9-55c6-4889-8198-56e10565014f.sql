GRANT INSERT ON public.access_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;