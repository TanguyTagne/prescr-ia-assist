
-- ============================================
-- PHASE 1: ENRICHIR LES TABLES EXISTANTES
-- ============================================

-- 1. Ajouter colonnes à medicaments
ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS statut_officine text DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS est_otc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_produit_conseil boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_eligible_comme_complementaire boolean DEFAULT false;

-- 2. Ajouter colonnes à pathologies
ALTER TABLE public.pathologies
  ADD COLUMN IF NOT EXISTS niveau_gravite integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS orientation_urgence boolean DEFAULT false;

-- 3. Ajouter colonnes à molecule_pathologie
ALTER TABLE public.molecule_pathologie
  ADD COLUMN IF NOT EXISTS score_pertinence integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS source_mapping text DEFAULT 'manual';

-- 4. Ajouter conseil_code à conseils_associes
ALTER TABLE public.conseils_associes
  ADD COLUMN IF NOT EXISTS conseil_code text;

-- 5. Ajouter niveaux ATC à classe_atc
ALTER TABLE public.classe_atc
  ADD COLUMN IF NOT EXISTS niveau_1 text,
  ADD COLUMN IF NOT EXISTS niveau_2 text,
  ADD COLUMN IF NOT EXISTS niveau_3 text,
  ADD COLUMN IF NOT EXISTS niveau_4 text;

-- 6. Enrichir produits_complementaires
ALTER TABLE public.produits_complementaires
  ADD COLUMN IF NOT EXISTS nom_produit text,
  ADD COLUMN IF NOT EXISTS type_produit text DEFAULT 'produit_conseil',
  ADD COLUMN IF NOT EXISTS est_dispositif_medical boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_complement boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_otc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS est_eligible_cross_sell boolean DEFAULT true;

UPDATE public.produits_complementaires SET nom_produit = produit WHERE nom_produit IS NULL;

-- 7. Enrichir regles_ranking
ALTER TABLE public.regles_ranking
  ADD COLUMN IF NOT EXISTS pathologie_id uuid REFERENCES public.pathologies(id),
  ADD COLUMN IF NOT EXISTS score_clinique numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS score_officine numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS score_friction_achat numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS score_popularite numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS score_final numeric DEFAULT 1.0;

-- ============================================
-- PHASE 2: CRÉER LES NOUVELLES TABLES
-- ============================================

-- 8. Table symptomes_officine
CREATE TABLE IF NOT EXISTS public.symptomes_officine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_symptome text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.symptomes_officine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read symptomes_officine"
  ON public.symptomes_officine FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can read symptomes_officine"
  ON public.symptomes_officine FOR SELECT TO service_role USING (true);
CREATE POLICY "Admin can manage symptomes_officine"
  ON public.symptomes_officine FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 9. Table symptome_pathologie
CREATE TABLE IF NOT EXISTS public.symptome_pathologie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptome_id uuid NOT NULL REFERENCES public.symptomes_officine(id) ON DELETE CASCADE,
  pathologie_id uuid NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  score_pertinence integer NOT NULL DEFAULT 50,
  UNIQUE (symptome_id, pathologie_id)
);

ALTER TABLE public.symptome_pathologie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read symptome_pathologie"
  ON public.symptome_pathologie FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can read symptome_pathologie"
  ON public.symptome_pathologie FOR SELECT TO service_role USING (true);
CREATE POLICY "Admin can manage symptome_pathologie"
  ON public.symptome_pathologie FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 10. Table medicament_pathologie
CREATE TABLE IF NOT EXISTS public.medicament_pathologie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicament_id uuid NOT NULL REFERENCES public.medicaments(id) ON DELETE CASCADE,
  pathologie_id uuid NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  score_pertinence integer NOT NULL DEFAULT 50,
  source_mapping text DEFAULT 'manual',
  UNIQUE (medicament_id, pathologie_id)
);

ALTER TABLE public.medicament_pathologie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read medicament_pathologie"
  ON public.medicament_pathologie FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can read medicament_pathologie"
  ON public.medicament_pathologie FOR SELECT TO service_role USING (true);
CREATE POLICY "Admin can manage medicament_pathologie"
  ON public.medicament_pathologie FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 11. Table protocole_pathologie (remplace pathology_protocol)
CREATE TABLE IF NOT EXISTS public.protocole_pathologie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathologie_id uuid NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  conseil_1_id uuid REFERENCES public.conseils_associes(id),
  conseil_2_id uuid REFERENCES public.conseils_associes(id),
  produit_complementaire_1_id uuid REFERENCES public.produits_complementaires(id),
  produit_complementaire_2_id uuid REFERENCES public.produits_complementaires(id),
  produit_complementaire_3_id uuid REFERENCES public.produits_complementaires(id),
  justification_1 text,
  justification_2 text,
  justification_3 text,
  priorite_produit_1 integer DEFAULT 90,
  priorite_produit_2 integer DEFAULT 70,
  priorite_produit_3 integer DEFAULT 50,
  version_protocole integer DEFAULT 1,
  actif boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocole_pathologie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read protocole_pathologie"
  ON public.protocole_pathologie FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can read protocole_pathologie"
  ON public.protocole_pathologie FOR SELECT TO service_role USING (true);
CREATE POLICY "Admin can manage protocole_pathologie"
  ON public.protocole_pathologie FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 12. Trigger updated_at pour protocole_pathologie
CREATE TRIGGER set_protocole_pathologie_updated_at
  BEFORE UPDATE ON public.protocole_pathologie
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pathology_protocol_updated_at();

-- 13. Index pour performance
CREATE INDEX IF NOT EXISTS idx_symptome_pathologie_symptome ON public.symptome_pathologie(symptome_id);
CREATE INDEX IF NOT EXISTS idx_symptome_pathologie_pathologie ON public.symptome_pathologie(pathologie_id);
CREATE INDEX IF NOT EXISTS idx_medicament_pathologie_medicament ON public.medicament_pathologie(medicament_id);
CREATE INDEX IF NOT EXISTS idx_medicament_pathologie_pathologie ON public.medicament_pathologie(pathologie_id);
CREATE INDEX IF NOT EXISTS idx_protocole_pathologie_pathologie ON public.protocole_pathologie(pathologie_id);
CREATE INDEX IF NOT EXISTS idx_protocole_pathologie_actif ON public.protocole_pathologie(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_medicaments_est_otc ON public.medicaments(est_otc) WHERE est_otc = true;
CREATE INDEX IF NOT EXISTS idx_medicaments_molecule_id ON public.medicaments(molecule_id);
CREATE INDEX IF NOT EXISTS idx_regles_ranking_pathologie ON public.regles_ranking(pathologie_id);
