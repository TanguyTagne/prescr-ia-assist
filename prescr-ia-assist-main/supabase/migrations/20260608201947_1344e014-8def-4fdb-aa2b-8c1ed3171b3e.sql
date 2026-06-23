CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Bypass when executed by the service role (edge functions / back-office tasks).
  -- Front-end users always run as the 'authenticated' role, so this only loosens
  -- the rule for trusted server-side code.
  IF current_user = 'service_role' OR current_user = 'supabase_admin' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
$function$;