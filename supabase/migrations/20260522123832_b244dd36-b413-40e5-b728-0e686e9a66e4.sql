
-- basket_context
DROP POLICY IF EXISTS "Users can manage own pharmacy basket_context" ON public.basket_context;
DROP POLICY IF EXISTS "Users can read own pharmacy basket_context" ON public.basket_context;
DROP POLICY IF EXISTS "Managers can write own pharmacy basket_context" ON public.basket_context;

CREATE POLICY "Users can read own pharmacy basket_context"
ON public.basket_context FOR SELECT TO authenticated
USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Managers can write own pharmacy basket_context"
ON public.basket_context FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));

-- pharmacy_registers
DROP POLICY IF EXISTS "Users can manage own pharmacy registers" ON public.pharmacy_registers;
DROP POLICY IF EXISTS "Users can read own pharmacy registers" ON public.pharmacy_registers;
DROP POLICY IF EXISTS "Managers can write own pharmacy registers" ON public.pharmacy_registers;

CREATE POLICY "Users can read own pharmacy registers"
ON public.pharmacy_registers FOR SELECT TO authenticated
USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Managers can write own pharmacy registers"
ON public.pharmacy_registers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));

-- product_mapping
DROP POLICY IF EXISTS "Users can manage own pharmacy product_mapping" ON public.product_mapping;
DROP POLICY IF EXISTS "Users can read own pharmacy product_mapping" ON public.product_mapping;
DROP POLICY IF EXISTS "Managers can write own pharmacy product_mapping" ON public.product_mapping;

CREATE POLICY "Users can read own pharmacy product_mapping"
ON public.product_mapping FOR SELECT TO authenticated
USING (pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Managers can write own pharmacy product_mapping"
ON public.product_mapping FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) AND pharmacy_id IN (SELECT profiles.pharmacy_id FROM public.profiles WHERE profiles.id = auth.uid()));
