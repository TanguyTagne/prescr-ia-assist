
CREATE OR REPLACE FUNCTION public.increment_pharmacy_quota_on_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pharmacy_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pharmacy_quotas (pharmacy_id)
  VALUES (NEW.pharmacy_id)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  -- Daily reset
  UPDATE public.pharmacy_quotas
     SET current_daily_analyses = 0,
         last_reset_daily = CURRENT_DATE
   WHERE pharmacy_id = NEW.pharmacy_id
     AND last_reset_daily < CURRENT_DATE;

  -- Monthly reset
  UPDATE public.pharmacy_quotas
     SET current_monthly_ai_calls = 0,
         last_reset_monthly = date_trunc('month', CURRENT_DATE)::date
   WHERE pharmacy_id = NEW.pharmacy_id
     AND last_reset_monthly < date_trunc('month', CURRENT_DATE)::date;

  UPDATE public.pharmacy_quotas
     SET current_daily_analyses = current_daily_analyses + 1,
         current_monthly_ai_calls = current_monthly_ai_calls + 1,
         updated_at = now()
   WHERE pharmacy_id = NEW.pharmacy_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_quota_on_analysis ON public.analysis_history;
CREATE TRIGGER trg_increment_quota_on_analysis
AFTER INSERT ON public.analysis_history
FOR EACH ROW
EXECUTE FUNCTION public.increment_pharmacy_quota_on_analysis();
