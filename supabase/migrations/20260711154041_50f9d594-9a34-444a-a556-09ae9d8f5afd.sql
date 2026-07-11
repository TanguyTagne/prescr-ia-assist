DROP FUNCTION IF EXISTS public.check_and_increment_quota(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.increment_pharmacy_quota_usage(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.increment_pharmacy_quota_on_analysis() CASCADE;
DROP FUNCTION IF EXISTS public.set_pharmacy_quotas_updated_at() CASCADE;
DROP TABLE IF EXISTS public.pharmacy_quotas CASCADE;