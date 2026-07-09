CREATE OR REPLACE FUNCTION public.increment_pharmacy_quota_usage(
  _pharmacy_id uuid,
  _medication_count integer DEFAULT 1,
  _ai_call_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_medication_count integer := GREATEST(0, COALESCE(_medication_count, 0));
  v_ai_call_count integer := GREATEST(0, COALESCE(_ai_call_count, 0));
  v_quota public.pharmacy_quotas%ROWTYPE;
BEGIN
  IF _pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing pharmacy_id');
  END IF;

  INSERT INTO public.pharmacy_quotas (pharmacy_id)
  VALUES (_pharmacy_id)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  SELECT * INTO v_quota
  FROM public.pharmacy_quotas
  WHERE pharmacy_id = _pharmacy_id
  FOR UPDATE;

  IF v_quota.last_reset_daily < CURRENT_DATE THEN
    UPDATE public.pharmacy_quotas
       SET current_daily_analyses = 0,
           last_reset_daily = CURRENT_DATE
     WHERE pharmacy_id = _pharmacy_id;
  END IF;

  IF v_quota.last_reset_monthly < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.pharmacy_quotas
       SET current_monthly_ai_calls = 0,
           last_reset_monthly = date_trunc('month', CURRENT_DATE)::date
     WHERE pharmacy_id = _pharmacy_id;
  END IF;

  UPDATE public.pharmacy_quotas
     SET current_daily_analyses = current_daily_analyses + v_medication_count,
         current_monthly_ai_calls = current_monthly_ai_calls + v_ai_call_count,
         updated_at = now()
   WHERE pharmacy_id = _pharmacy_id;

  RETURN jsonb_build_object(
    'ok', true,
    'medications_counted', v_medication_count,
    'ai_calls_counted', v_ai_call_count
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_pharmacy_quota_usage(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_pharmacy_quota_usage(uuid, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_pharmacy_quota_on_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_medication_count integer;
BEGIN
  IF NEW.pharmacy_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE((NEW.metadata->>'quota_counted')::boolean, false) THEN
    RETURN NEW;
  END IF;

  v_medication_count := COALESCE(
    NULLIF((NEW.metadata->>'medications_count')::integer, 0),
    CASE WHEN jsonb_typeof(NEW.medicaments) = 'array' THEN jsonb_array_length(NEW.medicaments) ELSE 1 END,
    1
  );

  PERFORM public.increment_pharmacy_quota_usage(NEW.pharmacy_id, v_medication_count, 1);

  RETURN NEW;
END;
$function$;