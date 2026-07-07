
CREATE TABLE public.admin_2fa_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_2fa_codes TO service_role;
ALTER TABLE public.admin_2fa_codes ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: only service_role (edge functions) manages this table.

CREATE TABLE public.admin_2fa_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_2fa_sessions TO authenticated;
GRANT ALL ON public.admin_2fa_sessions TO service_role;
ALTER TABLE public.admin_2fa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own 2FA session"
  ON public.admin_2fa_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_admin_2fa_verified()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_2fa_sessions
    WHERE user_id = auth.uid() AND verified_until > now()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_2fa_verified() TO authenticated;
