-- Protocole pathologie -> 1 conseil principal + 2 produits complémentaires
CREATE TABLE IF NOT EXISTS public.pathology_protocol (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathologie TEXT NOT NULL UNIQUE,
  conseil TEXT NOT NULL,
  produit_1 TEXT NOT NULL,
  produit_2 TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pathology_protocol ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Authenticated can read pathology_protocol" ON public.pathology_protocol;
CREATE POLICY "Authenticated can read pathology_protocol"
ON public.pathology_protocol
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can manage pathology_protocol" ON public.pathology_protocol;
CREATE POLICY "Admin can manage pathology_protocol"
ON public.pathology_protocol
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_pathology_protocol_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pathology_protocol_updated_at ON public.pathology_protocol;
CREATE TRIGGER trg_pathology_protocol_updated_at
BEFORE UPDATE ON public.pathology_protocol
FOR EACH ROW
EXECUTE FUNCTION public.set_pathology_protocol_updated_at();

-- Seed 10 protocoles métier
INSERT INTO public.pathology_protocol (pathologie, conseil, produit_1, produit_2, priority)
VALUES
  ('fièvre', 'Surveiller la température et rester hydraté.', 'Thermomètre digital', 'Compresses froides', 95),
  ('rhume', 'Nettoyer les voies nasales pour améliorer la respiration.', 'Spray eau de mer', 'Mouchoirs doux', 92),
  ('toux sèche', 'Apaiser l''irritation de la gorge.', 'Pastilles pour la gorge', 'Spray gorge hydratant', 90),
  ('douleurs musculaires', 'Appliquer un traitement local pour accélérer la récupération.', 'Gel anti-inflammatoire', 'Patch chauffant', 90),
  ('allergie saisonnière', 'Protéger les yeux et limiter les allergènes.', 'Collyre antihistaminique', 'Spray nasal anti-allergique', 90),
  ('maux de gorge', 'Maintenir la gorge hydratée.', 'Pastilles adoucissantes', 'Spray gorge antiseptique', 88),
  ('brûlures d''estomac', 'Protéger la muqueuse gastrique.', 'Pansement gastrique', 'Complément digestion', 88),
  ('diarrhée', 'Éviter la déshydratation.', 'Solution de réhydratation orale', 'Probiotiques', 93),
  ('rhume bébé', 'Dégager les voies respiratoires.', 'Mouche bébé', 'Sérum physiologique', 92),
  ('infection urinaire légère', 'Hydratation et prévention.', 'Complément cranberry', 'Bandelettes urinaires', 89)
ON CONFLICT (pathologie)
DO UPDATE SET
  conseil = EXCLUDED.conseil,
  produit_1 = EXCLUDED.produit_1,
  produit_2 = EXCLUDED.produit_2,
  priority = EXCLUDED.priority,
  updated_at = now();