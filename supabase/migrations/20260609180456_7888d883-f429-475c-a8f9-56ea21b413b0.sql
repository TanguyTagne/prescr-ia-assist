
-- 1) scan_events: ensure DELETE policy targets authenticated role only
DROP POLICY IF EXISTS "Admins can delete scan events" ON public.scan_events;
CREATE POLICY "Admins can delete scan events"
  ON public.scan_events
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) gdpr_requests: hide ip_address from pharmacy managers (admins keep full access via separate policy)
-- Use column-level privileges: revoke SELECT on the whole table from authenticated,
-- then re-grant SELECT on every column EXCEPT ip_address. Admins read via service-role/admin policy too;
-- but the manager SELECT policy + column grants ensures ip_address is never returned to managers.
REVOKE SELECT ON public.gdpr_requests FROM authenticated;
GRANT SELECT (id, pharmacy_id, requested_by, request_type, status, requested_at, completed_at, result_summary, notes, created_at)
  ON public.gdpr_requests TO authenticated;
-- Preserve write privileges
GRANT INSERT, UPDATE, DELETE ON public.gdpr_requests TO authenticated;
