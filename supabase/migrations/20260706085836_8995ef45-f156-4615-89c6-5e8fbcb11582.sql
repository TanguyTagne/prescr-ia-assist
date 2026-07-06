
-- Drop old policies that used the previous single-arg version keyed on pharmacy_id
DROP POLICY IF EXISTS "Users can insert own pharmacy analysis_history" ON public.analysis_history;
DROP POLICY IF EXISTS "Users insert own pharmacy scan_events" ON public.scan_events;

-- Now safe to drop the old is_pharmacy_active(uuid)
DROP FUNCTION IF EXISTS public.is_pharmacy_active(uuid);

-- Recreate the two dropped permissive policies WITHOUT status check (the new
-- RESTRICTIVE policy below handles status enforcement globally).
CREATE POLICY "Users can insert own pharmacy analysis_history"
ON public.analysis_history
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Users insert own pharmacy scan_events"
ON public.scan_events
FOR INSERT
TO authenticated
WITH CHECK (
  pharmacy_id IN (SELECT p.pharmacy_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- ============================================================
-- New is_pharmacy_active(_user_id): the real kill switch
-- ============================================================
CREATE FUNCTION public.is_pharmacy_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN _user_id IS NULL THEN TRUE   -- service_role / cron paths
      WHEN public.has_role(_user_id, 'admin'::app_role) THEN TRUE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND pharmacy_id IS NOT NULL
      ) THEN TRUE
      ELSE COALESCE(
        (
          SELECT (ph.status IS NULL OR ph.status = 'active')
          FROM public.profiles pr
          JOIN public.pharmacies ph ON ph.id = pr.pharmacy_id
          WHERE pr.id = _user_id
        ),
        FALSE
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.is_pharmacy_active(uuid) TO authenticated, service_role;

-- ============================================================
-- Apply RESTRICTIVE policies to all business tables
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'analysis_history',
    'scan_events',
    'scan_queue',
    'sales_transactions',
    'cross_sell_tracking',
    'pending_cross_sell',
    'pc_feedback',
    'recommendation_metrics',
    'recommendation_usage',
    'basket_context',
    'analytics_events',
    'medication_coverage_audit',
    'unmatched_medicaments',
    'pharmacy_registers',
    'pharmacy_lgo_config',
    'pharmacy_preferences',
    'pharmacy_scanner_keys',
    'patient_reminders',
    'product_mapping',
    'pharmacy_instance_heartbeats',
    'signalements',
    'accepted_combinations',
    'latent_need_metrics',
    'sales_attribution_monthly',
    'patient_needs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS "restrict_when_pharmacy_disabled" ON public.%I',
      t
    );

    EXECUTE format($f$
      CREATE POLICY "restrict_when_pharmacy_disabled"
      ON public.%I
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (public.is_pharmacy_active(auth.uid()))
      WITH CHECK (public.is_pharmacy_active(auth.uid()))
    $f$, t);
  END LOOP;
END $$;

-- Clear heartbeats for pharmacies currently suspended
DELETE FROM public.pharmacy_instance_heartbeats
WHERE pharmacy_id IN (
  SELECT id FROM public.pharmacies WHERE status IN ('paused', 'disabled')
);
