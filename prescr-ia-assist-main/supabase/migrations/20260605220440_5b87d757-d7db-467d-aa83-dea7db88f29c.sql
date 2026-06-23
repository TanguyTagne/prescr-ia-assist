CREATE OR REPLACE FUNCTION public.wipe_asclion_base()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  SELECT COUNT(*) INTO v_deleted FROM public.medicaments;

  TRUNCATE TABLE public.medicaments CASCADE;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.wipe_asclion_base() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wipe_asclion_base() TO service_role;