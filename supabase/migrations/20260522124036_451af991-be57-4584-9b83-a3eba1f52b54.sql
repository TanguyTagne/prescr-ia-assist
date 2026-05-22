
-- medicament_pc_mapping: restrict writes to managers/admins
DROP POLICY IF EXISTS "Users insert own pharmacy medicament_pc_mapping" ON public.medicament_pc_mapping;
DROP POLICY IF EXISTS "Users update own pharmacy medicament_pc_mapping" ON public.medicament_pc_mapping;
DROP POLICY IF EXISTS "Users delete own pharmacy medicament_pc_mapping" ON public.medicament_pc_mapping;

CREATE POLICY "Managers insert own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers update own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers delete own pharmacy medicament_pc_mapping"
ON public.medicament_pc_mapping FOR DELETE TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);

-- gdpr_requests: restrict SELECT to managers/admins (IP address PII)
DROP POLICY IF EXISTS "Users can read own pharmacy gdpr requests" ON public.gdpr_requests;

CREATE POLICY "Managers can read own pharmacy gdpr requests"
ON public.gdpr_requests FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);
