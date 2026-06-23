
-- Fix 1: enforce auth.uid() = user_id on accepted_combinations INSERT
DROP POLICY IF EXISTS "Users can insert their pharmacy combinations" ON public.accepted_combinations;
CREATE POLICY "Users can insert their pharmacy combinations"
ON public.accepted_combinations
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

-- Fix 3: add explicit restrictive INSERT policy on profiles (creation only via trigger/service_role)
CREATE POLICY "Users can insert their own profile only"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = id
  AND pharmacy_id IS NULL
  AND managed_groupement_id IS NULL
);
