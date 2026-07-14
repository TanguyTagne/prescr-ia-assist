GRANT INSERT ON TABLE public.access_requests TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.access_requests TO authenticated;
GRANT ALL ON TABLE public.access_requests TO service_role;