
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'preparateur', 'manager');

-- Create user_roles table (separate from profiles as per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin can read all analytics (override existing policy)
DROP POLICY IF EXISTS "Users can read own pharmacy analytics" ON public.analytics_events;

CREATE POLICY "Users can read analytics" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admin can read all pharmacies
DROP POLICY IF EXISTS "Users can read their pharmacy" ON public.pharmacies;

CREATE POLICY "Users can read pharmacies" ON public.pharmacies
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admin can manage pharmacies
CREATE POLICY "Admin can insert pharmacies" ON public.pharmacies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update pharmacies" ON public.pharmacies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all profiles
CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = id
  );

-- Drop the old select policy to avoid conflict
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
