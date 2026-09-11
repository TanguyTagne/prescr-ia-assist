SELECT cron.schedule(
  'subscription-annual-reminder',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknjfjplseopgymijnca.supabase.co/functions/v1/subscription-annual-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);