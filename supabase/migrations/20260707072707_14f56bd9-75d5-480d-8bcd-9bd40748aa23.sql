
CREATE OR REPLACE FUNCTION public.check_and_increment_quota(_pharmacy_id uuid, _quota_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quota pharmacy_quotas%ROWTYPE;
  v_current INTEGER;
  v_limit INTEGER;
  v_allowed BOOLEAN;
BEGIN
  INSERT INTO public.pharmacy_quotas (pharmacy_id)
  VALUES (_pharmacy_id)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  SELECT * INTO v_quota FROM public.pharmacy_quotas WHERE pharmacy_id = _pharmacy_id FOR UPDATE;

  IF v_quota.last_reset_daily < CURRENT_DATE THEN
    UPDATE public.pharmacy_quotas
       SET current_daily_analyses = 0,
           last_reset_daily = CURRENT_DATE
     WHERE pharmacy_id = _pharmacy_id;
    v_quota.current_daily_analyses := 0;
  END IF;

  IF v_quota.last_reset_monthly < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.pharmacy_quotas
       SET current_monthly_ai_calls = 0,
           last_reset_monthly = date_trunc('month', CURRENT_DATE)::date
     WHERE pharmacy_id = _pharmacy_id;
    v_quota.current_monthly_ai_calls := 0;
  END IF;

  IF _quota_type = 'analysis' THEN
    v_current := v_quota.current_daily_analyses;
    v_limit := v_quota.daily_analyses_limit;
  ELSIF _quota_type = 'ai_call' THEN
    v_current := v_quota.current_monthly_ai_calls;
    v_limit := v_quota.monthly_ai_calls_limit;
  ELSE
    RETURN jsonb_build_object('allowed', false, 'error', 'Invalid quota_type');
  END IF;

  v_allowed := v_current < v_limit;

  -- NOTE: increment is now handled exclusively by the trigger
  -- trg_increment_quota_on_analysis on public.analysis_history.
  -- We only track over-limit here to avoid double counting.
  IF NOT v_allowed THEN
    UPDATE public.pharmacy_quotas
       SET over_limit_count = over_limit_count + 1
     WHERE pharmacy_id = _pharmacy_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_current),
    'quota_type', _quota_type
  );
END;
$function$;
