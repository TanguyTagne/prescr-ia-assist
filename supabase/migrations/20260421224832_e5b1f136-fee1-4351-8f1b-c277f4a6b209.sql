-- 1. Add onboarding_completed flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 2. Create user_shortcuts table
CREATE TABLE IF NOT EXISTS public.user_shortcuts (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcuts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shortcuts"
ON public.user_shortcuts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shortcuts"
ON public.user_shortcuts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shortcuts"
ON public.user_shortcuts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shortcuts"
ON public.user_shortcuts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all shortcuts"
ON public.user_shortcuts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_user_shortcuts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_shortcuts_updated_at ON public.user_shortcuts;
CREATE TRIGGER trg_user_shortcuts_updated_at
BEFORE UPDATE ON public.user_shortcuts
FOR EACH ROW
EXECUTE FUNCTION public.set_user_shortcuts_updated_at();