CREATE TABLE IF NOT EXISTS public._pc_audit_to_delete (id uuid PRIMARY KEY);
ALTER TABLE public._pc_audit_to_delete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON public._pc_audit_to_delete FOR ALL TO service_role USING (true) WITH CHECK (true);