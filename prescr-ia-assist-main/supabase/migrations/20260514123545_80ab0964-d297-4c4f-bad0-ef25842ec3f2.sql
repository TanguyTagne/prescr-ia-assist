
-- 1. Prevent users from escalating their own role/groupement via profiles UPDATE
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Non-admins cannot change managed_groupement_id on their own profile
  IF NEW.managed_groupement_id IS DISTINCT FROM OLD.managed_groupement_id THEN
    RAISE EXCEPTION 'Not allowed to modify managed_groupement_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Restrict groupements SELECT to user's own groupement (or admin / group manager)
DROP POLICY IF EXISTS "Authenticated can read groupements" ON public.groupements;

CREATE POLICY "Users read own or managed groupement"
ON public.groupements
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id = get_user_managed_groupement(auth.uid())
  OR id IN (
    SELECT p.groupement_id FROM public.pharmacies p
    JOIN public.profiles pr ON pr.pharmacy_id = p.id
    WHERE pr.id = auth.uid() AND p.groupement_id IS NOT NULL
  )
);

-- 3. Scope unmatched_medicaments SELECT to user's pharmacy
DROP POLICY IF EXISTS "Users can read unmatched_medicaments" ON public.unmatched_medicaments;

CREATE POLICY "Users read own pharmacy unmatched_medicaments"
ON public.unmatched_medicaments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR pharmacy_id IN (
    SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- 4. Restrict medication_coverage_audit SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can read medication_coverage_audit" ON public.medication_coverage_audit;
