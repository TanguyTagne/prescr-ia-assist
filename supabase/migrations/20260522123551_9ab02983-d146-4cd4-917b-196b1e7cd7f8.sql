
-- gdpr_requests: allow users to read their own pharmacy's requests
CREATE POLICY "Users can read own pharmacy gdpr requests"
ON public.gdpr_requests
FOR SELECT
TO authenticated
USING (
  pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

-- pharmacy_lgo_config: managers manage their own pharmacy's config
CREATE POLICY "Managers can read own pharmacy lgo config"
ON public.pharmacy_lgo_config
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can insert own pharmacy lgo config"
ON public.pharmacy_lgo_config
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can update own pharmacy lgo config"
ON public.pharmacy_lgo_config
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can delete own pharmacy lgo config"
ON public.pharmacy_lgo_config
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

-- pharmacy_scanner_keys: managers manage their own pharmacy's keys
CREATE POLICY "Managers can read own pharmacy scanner keys"
ON public.pharmacy_scanner_keys
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can insert own pharmacy scanner keys"
ON public.pharmacy_scanner_keys
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can update own pharmacy scanner keys"
ON public.pharmacy_scanner_keys
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Managers can delete own pharmacy scanner keys"
ON public.pharmacy_scanner_keys
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND pharmacy_id IN (
    SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
);
