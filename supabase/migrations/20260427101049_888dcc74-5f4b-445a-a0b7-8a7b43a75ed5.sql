-- ============================================================
-- TRAÇABILITÉ (Data Lineage) — Asclion
-- Objectif : rendre opposable la chaîne source → validation → conseil
-- ============================================================

-- 1) Table de référence des sources cliniques officielles
CREATE TABLE IF NOT EXISTS public.clinical_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                 -- ex: BDPM, HAS, AMELI, OPENMEDIC, ATC_WHO, EMA, PUBMED
  nom_complet TEXT NOT NULL,
  type_source TEXT NOT NULL,                 -- 'officielle_fr' | 'standard_international' | 'validation_scientifique'
  licence TEXT NOT NULL,                     -- ex: 'Licence Ouverte Etalab 2.0'
  url_officielle TEXT,
  url_attribution TEXT,
  derniere_synchro DATE,
  version_donnees TEXT,                      -- ex: 'BDPM 2025-Q4'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical sources are publicly readable"
  ON public.clinical_sources FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Only admins manage clinical sources"
  ON public.clinical_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed des 7 sources documentées dans le pack de conformité
INSERT INTO public.clinical_sources (code, nom_complet, type_source, licence, url_officielle, derniere_synchro, version_donnees) VALUES
  ('BDPM',      'Base de Données Publique des Médicaments',           'officielle_fr',          'Licence Ouverte Etalab 2.0', 'https://base-donnees-publique.medicaments.gouv.fr/', CURRENT_DATE, '2025'),
  ('HAS',       'Haute Autorité de Santé',                            'officielle_fr',          'Licence Ouverte Etalab 2.0', 'https://www.has-sante.fr/',                          CURRENT_DATE, '2025'),
  ('AMELI',     'Assurance Maladie',                                  'officielle_fr',          'Licence Ouverte Etalab 2.0', 'https://www.ameli.fr/',                              CURRENT_DATE, '2025'),
  ('OPENMEDIC', 'Open Medic (CNAM)',                                  'officielle_fr',          'Licence Ouverte Etalab 2.0', 'https://www.data.gouv.fr/fr/datasets/open-medic/',   CURRENT_DATE, '2024'),
  ('ATC_WHO',   'Classification ATC — OMS',                           'standard_international', 'Usage scientifique libre',   'https://www.whocc.no/atc_ddd_index/',                CURRENT_DATE, 'WHOCC 2025'),
  ('EMA',       'European Medicines Agency',                          'standard_international', 'Réutilisation libre',        'https://www.ema.europa.eu/',                         CURRENT_DATE, '2025'),
  ('PUBMED',    'PubMed / NLM',                                       'validation_scientifique','Usage libre',                'https://pubmed.ncbi.nlm.nih.gov/',                   CURRENT_DATE, '2025')
ON CONFLICT (code) DO NOTHING;

-- 2) Colonnes de traçabilité sur les règles cliniques
-- Ces colonnes sont opposables en cas d'audit : qui a validé, quand, sur quelle source.

ALTER TABLE public.produits_complementaires
  ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES public.clinical_sources(code) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS rule_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.conseils_associes
  ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES public.clinical_sources(code) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS rule_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.pathology_protocol
  ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES public.clinical_sources(code) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS rule_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES public.clinical_sources(code) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ DEFAULT now();

-- Index pour audits rapides
CREATE INDEX IF NOT EXISTS idx_pc_source_code ON public.produits_complementaires(source_code);
CREATE INDEX IF NOT EXISTS idx_ca_source_code ON public.conseils_associes(source_code);
CREATE INDEX IF NOT EXISTS idx_pp_source_code ON public.pathology_protocol(source_code);
CREATE INDEX IF NOT EXISTS idx_pc_validated_by ON public.produits_complementaires(validated_by);
CREATE INDEX IF NOT EXISTS idx_ca_validated_by ON public.conseils_associes(validated_by);

-- 3) Journal d'audit (lineage_audit_log) : capture chaque modification de règle clinique
CREATE TABLE IF NOT EXISTS public.lineage_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,                  -- 'produits_complementaires' | 'conseils_associes' | 'pathology_protocol'
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,                   -- 'INSERT' | 'UPDATE' | 'DELETE' | 'VALIDATE'
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_code TEXT,
  source_reference TEXT,
  before_data JSONB,
  after_data JSONB,
  rule_version INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lineage_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read full audit log"
  ON public.lineage_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit entries"
  ON public.lineage_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.lineage_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON public.lineage_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.lineage_audit_log(created_at DESC);

-- 4) Trigger générique de capture du lineage
CREATE OR REPLACE FUNCTION public.capture_lineage_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_source TEXT;
  v_ref TEXT;
  v_version INTEGER;
BEGIN
  v_user := auth.uid();

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.lineage_audit_log(table_name, record_id, operation, changed_by, before_data, source_code, source_reference, rule_version)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_user, to_jsonb(OLD),
            (to_jsonb(OLD)->>'source_code'),
            (to_jsonb(OLD)->>'source_reference'),
            COALESCE((to_jsonb(OLD)->>'rule_version')::int, 1));
    RETURN OLD;
  END IF;

  v_source  := (to_jsonb(NEW)->>'source_code');
  v_ref     := (to_jsonb(NEW)->>'source_reference');
  v_version := COALESCE((to_jsonb(NEW)->>'rule_version')::int, 1);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lineage_audit_log(table_name, record_id, operation, changed_by, after_data, source_code, source_reference, rule_version)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_user, to_jsonb(NEW), v_source, v_ref, v_version);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Auto-incrément de la version sur modification réelle
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      NEW.rule_version := COALESCE(OLD.rule_version, 1) + 1;
    END IF;

    INSERT INTO public.lineage_audit_log(table_name, record_id, operation, changed_by, before_data, after_data, source_code, source_reference, rule_version)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_user, to_jsonb(OLD), to_jsonb(NEW), v_source, v_ref, NEW.rule_version);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Attache les triggers sur les 3 tables cliniques sensibles
DROP TRIGGER IF EXISTS trg_lineage_pc ON public.produits_complementaires;
CREATE TRIGGER trg_lineage_pc
  BEFORE INSERT OR UPDATE OR DELETE ON public.produits_complementaires
  FOR EACH ROW EXECUTE FUNCTION public.capture_lineage_changes();

DROP TRIGGER IF EXISTS trg_lineage_ca ON public.conseils_associes;
CREATE TRIGGER trg_lineage_ca
  BEFORE INSERT OR UPDATE OR DELETE ON public.conseils_associes
  FOR EACH ROW EXECUTE FUNCTION public.capture_lineage_changes();

DROP TRIGGER IF EXISTS trg_lineage_pp ON public.pathology_protocol;
CREATE TRIGGER trg_lineage_pp
  BEFORE INSERT OR UPDATE OR DELETE ON public.pathology_protocol
  FOR EACH ROW EXECUTE FUNCTION public.capture_lineage_changes();

-- 5) Vue d'audit unifiée pour extraction "data lineage par règle"
CREATE OR REPLACE VIEW public.v_clinical_lineage AS
SELECT
  'produits_complementaires'::text AS rule_type,
  pc.id AS rule_id,
  pc.produit AS rule_label,
  pc.pathologie_id,
  pc.source_code,
  cs.nom_complet AS source_nom,
  cs.licence AS source_licence,
  cs.derniere_synchro AS source_derniere_synchro,
  pc.source_reference,
  pc.validated_by,
  pc.validated_at,
  pc.rule_version,
  pc.created_at
FROM public.produits_complementaires pc
LEFT JOIN public.clinical_sources cs ON cs.code = pc.source_code
UNION ALL
SELECT
  'conseils_associes'::text,
  ca.id, LEFT(ca.conseil, 80), ca.pathologie_id,
  ca.source_code, cs.nom_complet, cs.licence, cs.derniere_synchro,
  ca.source_reference, ca.validated_by, ca.validated_at, ca.rule_version, ca.created_at
FROM public.conseils_associes ca
LEFT JOIN public.clinical_sources cs ON cs.code = ca.source_code
UNION ALL
SELECT
  'pathology_protocol'::text,
  pp.id, pp.pathologie, NULL::uuid,
  pp.source_code, cs.nom_complet, cs.licence, cs.derniere_synchro,
  pp.source_reference, pp.validated_by, pp.validated_at, pp.rule_version, pp.created_at
FROM public.pathology_protocol pp
LEFT JOIN public.clinical_sources cs ON cs.code = pp.source_code;

-- 6) Triggers updated_at sur clinical_sources
DROP TRIGGER IF EXISTS trg_cs_updated_at ON public.clinical_sources;
CREATE TRIGGER trg_cs_updated_at
  BEFORE UPDATE ON public.clinical_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_groupements_updated_at();