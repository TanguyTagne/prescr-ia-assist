
INSERT INTO storage.buckets (id, name, public) VALUES ('downloads', 'downloads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for downloads" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'downloads');
