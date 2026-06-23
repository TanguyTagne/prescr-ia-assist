
CREATE TABLE public.pharmacy_lgo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  lgo_type text NOT NULL DEFAULT 'winpharma',
  api_base_url text NOT NULL,
  api_key_encrypted text,
  auth_method text NOT NULL DEFAULT 'api_key',
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id)
);

ALTER TABLE public.pharmacy_lgo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage lgo config"
  ON public.pharmacy_lgo_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own pharmacy lgo config"
  ON public.pharmacy_lgo_config FOR SELECT
  TO authenticated
  USING (pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM profiles WHERE profiles.id = auth.uid()
  ));
