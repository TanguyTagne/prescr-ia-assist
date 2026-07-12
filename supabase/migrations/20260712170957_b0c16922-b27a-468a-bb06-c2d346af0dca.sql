CREATE POLICY "Authenticated can submit access request"
  ON public.access_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);