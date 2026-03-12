
-- =============================================
-- BASE DE CONNAISSANCES CLINIQUES PRESCRIA
-- =============================================

-- TABLE: MOLECULES
CREATE TABLE public.molecules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_molecule TEXT NOT NULL UNIQUE,
  atc_code TEXT,
  classe_therapeutique TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: CLASSE_ATC
CREATE TABLE public.classe_atc (
  atc_code TEXT PRIMARY KEY,
  nom_classe TEXT NOT NULL,
  description TEXT,
  niveau INTEGER NOT NULL DEFAULT 5,
  parent_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: PATHOLOGIES
CREATE TABLE public.pathologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_pathologie TEXT NOT NULL UNIQUE,
  categorie TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: MEDICAMENTS (nouvelle table structurée)
CREATE TABLE public.medicaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_commercial TEXT NOT NULL,
  cip_code TEXT UNIQUE,
  molecule_id UUID REFERENCES public.molecules(id) ON DELETE SET NULL,
  atc_code TEXT REFERENCES public.classe_atc(atc_code) ON DELETE SET NULL,
  laboratoire TEXT,
  forme_galenique TEXT,
  dosage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: MOLECULE_PATHOLOGIE (many-to-many)
CREATE TABLE public.molecule_pathologie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molecule_id UUID NOT NULL REFERENCES public.molecules(id) ON DELETE CASCADE,
  pathologie_id UUID NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  UNIQUE(molecule_id, pathologie_id)
);

-- TABLE: CONSEILS_ASSOCIES
CREATE TABLE public.conseils_associes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathologie_id UUID NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  conseil TEXT NOT NULL,
  priorite INTEGER NOT NULL DEFAULT 50,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: PRODUITS_COMPLEMENTAIRES
CREATE TABLE public.produits_complementaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathologie_id UUID NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  produit TEXT NOT NULL,
  categorie TEXT,
  priorite INTEGER NOT NULL DEFAULT 50,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: REGLES_RANKING
CREATE TABLE public.regles_ranking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID REFERENCES public.produits_complementaires(id) ON DELETE CASCADE,
  score_pathologie NUMERIC NOT NULL DEFAULT 1.0,
  score_panier NUMERIC NOT NULL DEFAULT 1.0,
  score_saison NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_medicaments_cip ON public.medicaments(cip_code);
CREATE INDEX idx_medicaments_nom ON public.medicaments(nom_commercial);
CREATE INDEX idx_medicaments_molecule ON public.medicaments(molecule_id);
CREATE INDEX idx_medicaments_atc ON public.medicaments(atc_code);
CREATE INDEX idx_molecules_atc ON public.molecules(atc_code);
CREATE INDEX idx_molecule_pathologie_mol ON public.molecule_pathologie(molecule_id);
CREATE INDEX idx_molecule_pathologie_path ON public.molecule_pathologie(pathologie_id);
CREATE INDEX idx_conseils_pathologie ON public.conseils_associes(pathologie_id);
CREATE INDEX idx_produits_pathologie ON public.produits_complementaires(pathologie_id);

-- RLS
ALTER TABLE public.molecules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classe_atc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.molecule_pathologie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conseils_associes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produits_complementaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regles_ranking ENABLE ROW LEVEL SECURITY;

-- READ policies (authenticated users can read all clinical data)
CREATE POLICY "Authenticated can read molecules" ON public.molecules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read classe_atc" ON public.classe_atc FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read pathologies" ON public.pathologies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read medicaments" ON public.medicaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read molecule_pathologie" ON public.molecule_pathologie FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read conseils_associes" ON public.conseils_associes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read produits_complementaires" ON public.produits_complementaires FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read regles_ranking" ON public.regles_ranking FOR SELECT TO authenticated USING (true);

-- Service role read
CREATE POLICY "Service can read molecules" ON public.molecules FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read classe_atc" ON public.classe_atc FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read pathologies" ON public.pathologies FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read medicaments" ON public.medicaments FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read molecule_pathologie" ON public.molecule_pathologie FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read conseils_associes" ON public.conseils_associes FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read produits_complementaires" ON public.produits_complementaires FOR SELECT TO service_role USING (true);
CREATE POLICY "Service can read regles_ranking" ON public.regles_ranking FOR SELECT TO service_role USING (true);

-- Admin WRITE policies
CREATE POLICY "Admin can manage molecules" ON public.molecules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage classe_atc" ON public.classe_atc FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage pathologies" ON public.pathologies FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage medicaments" ON public.medicaments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage molecule_pathologie" ON public.molecule_pathologie FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage conseils_associes" ON public.conseils_associes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage produits_complementaires" ON public.produits_complementaires FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage regles_ranking" ON public.regles_ranking FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
