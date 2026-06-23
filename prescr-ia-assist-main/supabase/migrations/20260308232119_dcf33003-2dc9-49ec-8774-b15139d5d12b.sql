
-- Table: therapeutic_classes (classes thérapeutiques)
CREATE TABLE public.therapeutic_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  systeme_physiologique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: medications (médicaments avec données pharmacologiques)
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_commercial TEXT NOT NULL,
  molecule_active TEXT NOT NULL,
  code_atc TEXT,
  classe_therapeutique_id UUID REFERENCES public.therapeutic_classes(id),
  indications_principales TEXT[],
  mecanisme_action TEXT,
  effets_secondaires_frequents TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: contexts (contextes thérapeutiques par classe)
CREATE TABLE public.therapeutic_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_therapeutique_id UUID REFERENCES public.therapeutic_classes(id) NOT NULL,
  medication_id UUID REFERENCES public.medications(id),
  description TEXT NOT NULL,
  frequence_score INT DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: symptoms (symptômes associés aux contextes)
CREATE TABLE public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contexte_id UUID REFERENCES public.therapeutic_contexts(id) NOT NULL,
  symptome TEXT NOT NULL,
  frequence_score INT DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: questions (questions associées aux symptômes)
CREATE TABLE public.pharma_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id UUID REFERENCES public.symptoms(id) NOT NULL,
  question TEXT NOT NULL,
  contexte_explication TEXT,
  priorite INT DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: patient_needs (besoins patients identifiés)
CREATE TABLE public.patient_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id UUID REFERENCES public.symptoms(id) NOT NULL,
  besoin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: otc_suggestions (suggestions OTC liées aux besoins)
CREATE TABLE public.otc_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_need_id UUID REFERENCES public.patient_needs(id) NOT NULL,
  categorie_produit TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '💊',
  priorite TEXT DEFAULT 'moyenne' CHECK (priorite IN ('haute', 'moyenne')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: recommendation_usage (apprentissage par l'usage)
CREATE TABLE public.recommendation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  user_id UUID,
  question_id UUID REFERENCES public.pharma_questions(id),
  otc_suggestion_id UUID REFERENCES public.otc_suggestions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('question_shown', 'question_answered_yes', 'question_answered_no', 'suggestion_shown', 'suggestion_used', 'suggestion_ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: pharmacy_preferences (personnalisation par pharmacie)
CREATE TABLE public.pharmacy_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) NOT NULL,
  categories_prioritaires TEXT[],
  marques_partenaires TEXT[],
  produits_recommandes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id)
);

-- RLS policies: tables de référence lisibles par tous les authentifiés
ALTER TABLE public.therapeutic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapeutic_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otc_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_preferences ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés sur les tables de référence
CREATE POLICY "Authenticated can read therapeutic_classes" ON public.therapeutic_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read medications" ON public.medications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read therapeutic_contexts" ON public.therapeutic_contexts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read symptoms" ON public.symptoms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read pharma_questions" ON public.pharma_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read patient_needs" ON public.patient_needs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read otc_suggestions" ON public.otc_suggestions FOR SELECT TO authenticated USING (true);

-- Admin peut tout modifier sur les tables de référence
CREATE POLICY "Admin can manage therapeutic_classes" ON public.therapeutic_classes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage medications" ON public.medications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage therapeutic_contexts" ON public.therapeutic_contexts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage symptoms" ON public.symptoms FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage pharma_questions" ON public.pharma_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage patient_needs" ON public.patient_needs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage otc_suggestions" ON public.otc_suggestions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Usage: users can insert their own, read their pharmacy's
CREATE POLICY "Users can insert recommendation_usage" ON public.recommendation_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read recommendation_usage" ON public.recommendation_usage FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);

-- Pharmacy preferences: pharmacy members can read, admin can manage
CREATE POLICY "Users can read own pharmacy preferences" ON public.pharmacy_preferences FOR SELECT TO authenticated USING (
  pharmacy_id IN (SELECT pharmacy_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin can manage pharmacy preferences" ON public.pharmacy_preferences FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow service role / edge functions to read all reference tables
CREATE POLICY "Service can read therapeutic_classes" ON public.therapeutic_classes FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read medications" ON public.medications FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read therapeutic_contexts" ON public.therapeutic_contexts FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read symptoms" ON public.symptoms FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read pharma_questions" ON public.pharma_questions FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read patient_needs" ON public.patient_needs FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read otc_suggestions" ON public.otc_suggestions FOR SELECT TO service_role USING (true);
