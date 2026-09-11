-- 1. Admin-only connection counts
CREATE OR REPLACE FUNCTION public.get_pharmacy_connection_counts()
 RETURNS TABLE(pharmacy_id uuid, connected_instances integer, connected_users integer, desktop_instances integer, web_instances integer, last_activity timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    h.pharmacy_id,
    COUNT(*)::int AS connected_instances,
    COUNT(DISTINCT h.user_id)::int AS connected_users,
    COUNT(*) FILTER (WHERE h.platform = 'desktop')::int AS desktop_instances,
    COUNT(*) FILTER (WHERE h.platform = 'web')::int AS web_instances,
    MAX(h.last_seen_at) AS last_activity
  FROM public.pharmacy_instance_heartbeats h
  WHERE h.last_seen_at > now() - interval '3 minutes'
    AND (auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role))
  GROUP BY h.pharmacy_id;
$function$;

-- 2. Hide plaintext api_key columns from client roles
REVOKE SELECT ON public.pharmacy_lgo_config FROM authenticated;
GRANT SELECT (id, pharmacy_id, lgo_type, api_base_url, auth_method, enabled, last_sync_at, created_at, updated_at)
  ON public.pharmacy_lgo_config TO authenticated;
REVOKE SELECT ON public.pharmacy_lgo_config FROM anon;

REVOKE SELECT ON public.pharmacy_scanner_keys FROM authenticated;
GRANT SELECT (id, pharmacy_id, label, active, created_at)
  ON public.pharmacy_scanner_keys TO authenticated;
REVOKE SELECT ON public.pharmacy_scanner_keys FROM anon;

-- 3. Scan events insert must be scoped to the user's own pharmacy
DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;
