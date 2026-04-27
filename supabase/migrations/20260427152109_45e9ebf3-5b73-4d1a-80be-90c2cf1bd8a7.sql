-- ============================================================================
-- 1. Registre des traitements RGPD (Article 30)
-- ============================================================================
CREATE TABLE public.rgpd_processing_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom_traitement TEXT NOT NULL,
  finalite TEXT NOT NULL,
  base_legale TEXT NOT NULL,
  categories_donnees TEXT NOT NULL,
  categories_personnes TEXT NOT NULL,
  destinataires TEXT NOT NULL,
  transferts_hors_ue TEXT DEFAULT 'Aucun',
  duree_conservation TEXT NOT NULL,
  mesures_securite TEXT NOT NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rgpd_processing_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage rgpd register" ON public.rgpd_processing_register
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read rgpd register" ON public.rgpd_processing_register
  FOR SELECT TO authenticated USING (active = true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_rgpd_register_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_rgpd_register_updated
  BEFORE UPDATE ON public.rgpd_processing_register
  FOR EACH ROW EXECUTE FUNCTION public.set_rgpd_register_updated_at();

-- Seed default register (5 traitements principaux)
INSERT INTO public.rgpd_processing_register
  (nom_traitement, finalite, base_legale, categories_donnees, categories_personnes, destinataires, duree_conservation, mesures_securite, ordre)
VALUES
  ('Analyse d''ordonnance',
   'Aide à la dispensation et recommandation de produits complémentaires',
   'Intérêt légitime (amélioration du conseil pharmaceutique)',
   'Hash anonyme du nom patient, liste des médicaments, métadonnées techniques',
   'Patients (indirectement, via hash), pharmaciens utilisateurs',
   'Lovable Cloud (Supabase EU - Frankfurt), Lovable AI Gateway (Google Gemini)',
   '24 mois puis anonymisation totale',
   'RLS PostgreSQL, JWT, TLS 1.3, hash SHA-256 patients, isolation pharmacy_id',
   1),
  ('CRM patient & rappels',
   'Suivi de fidélisation et envoi de rappels de fin de traitement',
   'Intérêt légitime + consentement patient au comptoir',
   'Hash patient, numéro téléphone (chiffré), date traitement, message rappel',
   'Patients consentants, pharmaciens',
   'Lovable Cloud, Twilio (envoi SMS si activé)',
   '12 mois après dernier contact',
   'RLS, chiffrement téléphone, opt-in obligatoire',
   2),
  ('Analytics produit',
   'Mesure d''usage et amélioration de l''application',
   'Consentement explicite (cookie banner)',
   'Évènements UI anonymisés, pharmacy_id, timestamps',
   'Pharmaciens utilisateurs',
   'Lovable Cloud',
   '6 mois',
   'RLS, opt-in cookie, pas de PII',
   3),
  ('Leads démo & contact',
   'Suivi commercial des prospects ayant testé la démo',
   'Intérêt légitime (prospection B2B)',
   'Nom, email pro, officine, ville, session démo',
   'Prospects pharmaciens',
   'Lovable Cloud, Resend (emails)',
   '36 mois ou demande d''effacement',
   'RLS admin, droit d''opposition immédiat',
   4),
  ('Traçabilité clinique',
   'Audit des règles cliniques et conformité réglementaire',
   'Obligation légale (traçabilité des recommandations)',
   'Source clinique, version règle, validateur, timestamps modifications',
   'Pharmaciens (validateurs), admins',
   'Lovable Cloud',
   'Indéfinie (registre opposable)',
   'RLS admin, journal append-only, signatures',
   5);

-- ============================================================================
-- 2. Journal d'audit RGPD (demandes export/suppression)
-- ============================================================================
CREATE TABLE public.gdpr_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL,
  requested_by UUID,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'rectification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result_summary JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage gdpr requests" ON public.gdpr_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage gdpr requests" ON public.gdpr_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own pharmacy gdpr requests" ON public.gdpr_requests
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own pharmacy gdpr requests" ON public.gdpr_requests
  FOR INSERT TO authenticated
  WITH CHECK (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_gdpr_requests_pharmacy ON public.gdpr_requests(pharmacy_id, requested_at DESC);

-- ============================================================================
-- 3. Quotas applicatifs par pharmacie
-- ============================================================================
CREATE TABLE public.pharmacy_quotas (
  pharmacy_id UUID NOT NULL PRIMARY KEY,
  daily_analyses_limit INTEGER NOT NULL DEFAULT 500,
  monthly_ai_calls_limit INTEGER NOT NULL DEFAULT 15000,
  max_upload_size_mb INTEGER NOT NULL DEFAULT 10,
  current_daily_analyses INTEGER NOT NULL DEFAULT 0,
  current_monthly_ai_calls INTEGER NOT NULL DEFAULT 0,
  last_reset_daily DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reset_monthly DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  over_limit_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacy_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage quotas" ON public.pharmacy_quotas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage quotas" ON public.pharmacy_quotas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own pharmacy quotas" ON public.pharmacy_quotas
  FOR SELECT TO authenticated
  USING (pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_pharmacy_quotas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_pharmacy_quotas_updated
  BEFORE UPDATE ON public.pharmacy_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_pharmacy_quotas_updated_at();

-- Seed quotas pour pharmacies existantes
INSERT INTO public.pharmacy_quotas (pharmacy_id)
SELECT id FROM public.pharmacies
ON CONFLICT (pharmacy_id) DO NOTHING;

-- ============================================================================
-- 4. Fonction check_and_increment_quota
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_quota(
  _pharmacy_id UUID,
  _quota_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota pharmacy_quotas%ROWTYPE;
  v_current INTEGER;
  v_limit INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Auto-create quota row if missing
  INSERT INTO public.pharmacy_quotas (pharmacy_id)
  VALUES (_pharmacy_id)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  SELECT * INTO v_quota FROM public.pharmacy_quotas WHERE pharmacy_id = _pharmacy_id FOR UPDATE;

  -- Reset journalier
  IF v_quota.last_reset_daily < CURRENT_DATE THEN
    UPDATE public.pharmacy_quotas
       SET current_daily_analyses = 0,
           last_reset_daily = CURRENT_DATE
     WHERE pharmacy_id = _pharmacy_id;
    v_quota.current_daily_analyses := 0;
    v_quota.last_reset_daily := CURRENT_DATE;
  END IF;

  -- Reset mensuel
  IF v_quota.last_reset_monthly < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.pharmacy_quotas
       SET current_monthly_ai_calls = 0,
           last_reset_monthly = date_trunc('month', CURRENT_DATE)::date
     WHERE pharmacy_id = _pharmacy_id;
    v_quota.current_monthly_ai_calls := 0;
    v_quota.last_reset_monthly := date_trunc('month', CURRENT_DATE)::date;
  END IF;

  IF _quota_type = 'analysis' THEN
    v_current := v_quota.current_daily_analyses;
    v_limit := v_quota.daily_analyses_limit;
  ELSIF _quota_type = 'ai_call' THEN
    v_current := v_quota.current_monthly_ai_calls;
    v_limit := v_quota.monthly_ai_calls_limit;
  ELSE
    RETURN jsonb_build_object('allowed', false, 'error', 'Invalid quota_type');
  END IF;

  v_allowed := v_current < v_limit;

  IF v_allowed THEN
    IF _quota_type = 'analysis' THEN
      UPDATE public.pharmacy_quotas
         SET current_daily_analyses = current_daily_analyses + 1
       WHERE pharmacy_id = _pharmacy_id;
      v_current := v_current + 1;
    ELSE
      UPDATE public.pharmacy_quotas
         SET current_monthly_ai_calls = current_monthly_ai_calls + 1
       WHERE pharmacy_id = _pharmacy_id;
      v_current := v_current + 1;
    END IF;
  ELSE
    -- Increment over_limit_count
    UPDATE public.pharmacy_quotas
       SET over_limit_count = over_limit_count + 1
     WHERE pharmacy_id = _pharmacy_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_current),
    'quota_type', _quota_type
  );
END;
$$;