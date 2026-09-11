CREATE TYPE public.subscription_plan AS ENUM ('classic', 'premium');
CREATE TYPE public.subscription_cycle AS ENUM ('monthly', 'annual');
CREATE TYPE public.subscription_status AS ENUM ('checkout_started', 'payment_pending', 'paid_pending_validation', 'activation_requested', 'active', 'payment_issue', 'cancel_at_period_end', 'expired', 'cancelled');

CREATE TABLE public.subscription_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name TEXT NOT NULL,
  billing_name TEXT,
  siret TEXT,
  billing_address TEXT,
  contact_first_name TEXT NOT NULL,
  contact_last_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  registers_count INTEGER,
  robot_declared BOOLEAN NOT NULL DEFAULT FALSE,
  robot_brand TEXT,
  robot_model TEXT,
  source TEXT,
  utm_campaign TEXT,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validation_completed_at TIMESTAMPTZ,
  training_at TIMESTAMPTZ,
  followup_d14_at TIMESTAMPTZ,
  followup_d30_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_offices TO authenticated;
GRANT ALL ON public.subscription_offices TO service_role;
ALTER TABLE public.subscription_offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read offices" ON public.subscription_offices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner can read own office" ON public.subscription_offices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages offices" ON public.subscription_offices FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.subscription_offices(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL,
  billing_cycle public.subscription_cycle NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'checkout_started',
  setup_fee_charged BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_price_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stripe_checkout_session_id),
  UNIQUE (stripe_subscription_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can read own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (office_id IN (SELECT id FROM public.subscription_offices WHERE user_id = auth.uid()));
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read subscription events" ON public.subscription_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages subscription events" ON public.subscription_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE public.subscription_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.subscription_notes TO authenticated;
GRANT ALL ON public.subscription_notes TO service_role;
ALTER TABLE public.subscription_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notes" ON public.subscription_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins add notes" ON public.subscription_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages notes" ON public.subscription_notes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER trg_subscription_offices_updated_at BEFORE UPDATE ON public.subscription_offices FOR EACH ROW EXECUTE FUNCTION public.set_groupements_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_groupements_updated_at();

CREATE INDEX idx_subscriptions_office ON public.subscriptions(office_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscription_offices_siret ON public.subscription_offices(siret);
CREATE INDEX idx_subscription_offices_email ON public.subscription_offices(contact_email);