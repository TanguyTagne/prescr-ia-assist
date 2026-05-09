
-- 1. patient_reminders: restrict to admin + manager only
DROP POLICY IF EXISTS "Users can manage own pharmacy reminders" ON public.patient_reminders;

CREATE POLICY "Managers can read own pharmacy reminders"
ON public.patient_reminders FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can insert own pharmacy reminders"
ON public.patient_reminders FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can update own pharmacy reminders"
ON public.patient_reminders FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can delete own pharmacy reminders"
ON public.patient_reminders FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. tracking_links: remove anon/authenticated public read
DROP POLICY IF EXISTS "Anon can read active tracking_links by slug" ON public.tracking_links;

-- 3. gdpr_requests: restrict reads to admin only (drop pharmacy-wide read)
DROP POLICY IF EXISTS "Users can read own pharmacy gdpr requests" ON public.gdpr_requests;

-- 4. lineage_audit_log: only service_role can write
DROP POLICY IF EXISTS "Authenticated users can insert their own audit entries" ON public.lineage_audit_log;

CREATE POLICY "Service role can insert audit entries"
ON public.lineage_audit_log FOR INSERT TO service_role
WITH CHECK (true);

-- 5. Rename misleading api_key_encrypted column (was plaintext)
ALTER TABLE public.pharmacy_lgo_config
  RENAME COLUMN api_key_encrypted TO api_key;
