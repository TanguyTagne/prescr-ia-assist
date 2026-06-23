
-- 1. Strengthen profile escalation prevention to cover role and pharmacy_id
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.managed_groupement_id IS DISTINCT FROM OLD.managed_groupement_id THEN
    RAISE EXCEPTION 'Not allowed to modify managed_groupement_id';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to modify role';
  END IF;
  IF NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id THEN
    RAISE EXCEPTION 'Not allowed to modify pharmacy_id';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop duplicate trigger
DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;

-- Add WITH CHECK on the UPDATE policy for defense in depth
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. pharmacy_benchmark: per-pharmacy read for managers/preparateurs
CREATE POLICY "Users can read own pharmacy benchmark"
ON public.pharmacy_benchmark
FOR SELECT
TO authenticated
USING (
  pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

-- 3. pharmacy_preferences: allow managers to write their own
CREATE POLICY "Managers can insert own pharmacy preferences"
ON public.pharmacy_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can update own pharmacy preferences"
ON public.pharmacy_preferences
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can delete own pharmacy preferences"
ON public.pharmacy_preferences
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);
