DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trigger ON public.profiles;

CREATE TRIGGER prevent_profile_privilege_escalation_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();