DROP POLICY IF EXISTS "Authenticated users can insert scan events" ON public.scan_events;

DROP POLICY IF EXISTS "scan_queue topic restricted to own pharmacy" ON realtime.messages;
CREATE POLICY "scan_queue topic restricted to own pharmacy"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'scan_queue_%'
      THEN realtime.topic() = ('scan_queue_' || COALESCE((public.current_user_pharmacy_id())::text, ''))
    ELSE false
  END
);