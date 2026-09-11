SELECT cron.schedule(
  'subscription-abandoned-cart',
  '15 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknjfjplseopgymijnca.supabase.co/functions/v1/subscription-abandoned-cart',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);