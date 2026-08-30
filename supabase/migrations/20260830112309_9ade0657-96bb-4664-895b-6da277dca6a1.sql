
-- 1. Internal config table to hold a cron secret (service_role only, no anon/authenticated grants)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.internal_config TO service_role;

-- Generate a one-time cron secret (not readable by any client role)
INSERT INTO public.internal_config (key, value)
VALUES ('cron_secret', gen_random_uuid()::text || '-' || gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- 2. Remove unrestricted INSERT policy on scan_events (cross-pharmacy injection)
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;

-- 3. Remove unrestricted learned-insert policy on pc_cip_mapping (inserts now go through learn-pc-cip edge function)
DROP POLICY IF EXISTS "Authenticated can insert learned pc_cip_mapping" ON public.pc_cip_mapping;

-- 4. Re-arm the monthly recap cron job with the x-cron-secret header
SELECT cron.unschedule('send-monthly-recap');

SELECT cron.schedule(
  'send-monthly-recap',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://oknjfjplseopgymijnca.supabase.co/functions/v1/send-monthly-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
