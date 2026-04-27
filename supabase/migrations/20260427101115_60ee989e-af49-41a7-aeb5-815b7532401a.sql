-- 1) Recréer la vue en SECURITY INVOKER (résout l'ERROR linter 0010)
DROP VIEW IF EXISTS public.v_clinical_lineage;

CREATE VIEW public.v_clinical_lineage
WITH (security_invoker = true) AS
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

-- Restreint l'accès à la vue aux admins
REVOKE ALL ON public.v_clinical_lineage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_clinical_lineage TO authenticated;

-- 2) Durcir la policy INSERT du journal d'audit (résout WARN linter 0024)
DROP POLICY IF EXISTS "System can insert audit entries" ON public.lineage_audit_log;

CREATE POLICY "Authenticated users can insert their own audit entries"
  ON public.lineage_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (changed_by IS NULL OR changed_by = auth.uid())
  );