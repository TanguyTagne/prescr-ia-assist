CREATE TABLE public.patient_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  patient_hash text NOT NULL,
  patient_name text,
  phone text,
  reminder_type text NOT NULL DEFAULT 'end_of_treatment',
  treatment_end_date date NOT NULL,
  reminder_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  sent_at timestamptz,
  message text,
  analysis_id uuid REFERENCES public.analysis_history(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage patient_reminders" ON public.patient_reminders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own pharmacy reminders" ON public.patient_reminders
  FOR ALL TO authenticated
  USING (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Service can manage patient_reminders" ON public.patient_reminders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_patient_reminders_reminder_date ON public.patient_reminders(reminder_date) WHERE status = 'scheduled';
CREATE INDEX idx_patient_reminders_pharmacy ON public.patient_reminders(pharmacy_id);