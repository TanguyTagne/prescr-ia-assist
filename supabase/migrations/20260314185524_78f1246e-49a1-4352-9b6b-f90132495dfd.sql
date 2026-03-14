-- Harden pathology_protocol RLS to avoid permissive read policy
DROP POLICY IF EXISTS "Authenticated can read pathology_protocol" ON public.pathology_protocol;

CREATE POLICY "Admin can read pathology_protocol"
ON public.pathology_protocol
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can read pathology_protocol"
ON public.pathology_protocol
FOR SELECT
TO service_role
USING (true);