
CREATE TABLE IF NOT EXISTS public.produit_complementaire_ranking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathologie_id uuid NOT NULL REFERENCES public.pathologies(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL REFERENCES public.produits_complementaires(id) ON DELETE CASCADE,
  score_clinique numeric NOT NULL DEFAULT 0.5,
  score_pertinence_pathologie numeric NOT NULL DEFAULT 0.5,
  score_cross_sell numeric NOT NULL DEFAULT 0.5,
  score_saisonnalite numeric NOT NULL DEFAULT 0.5,
  score_popularite numeric NOT NULL DEFAULT 0.5,
  score_final numeric GENERATED ALWAYS AS (
    0.4 * score_clinique + 
    0.25 * score_pertinence_pathologie + 
    0.15 * score_cross_sell + 
    0.10 * score_saisonnalite + 
    0.10 * score_popularite
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pathologie_id, produit_id)
);

ALTER TABLE public.produit_complementaire_ranking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage ranking" ON public.produit_complementaire_ranking
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read ranking" ON public.produit_complementaire_ranking
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can read ranking" ON public.produit_complementaire_ranking
  FOR SELECT TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.get_top_produits(p_pathologie_id uuid, p_limit int DEFAULT 3)
RETURNS TABLE(
  produit_id uuid,
  produit text,
  categorie text,
  description text,
  type_produit text,
  score_final numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    pc.id as produit_id,
    pc.produit,
    pc.categorie,
    pc.description,
    pc.type_produit,
    COALESCE(r.score_final, pc.priorite::numeric / 100.0) as score_final
  FROM produits_complementaires pc
  LEFT JOIN produit_complementaire_ranking r ON r.produit_id = pc.id AND r.pathologie_id = p_pathologie_id
  WHERE pc.pathologie_id = p_pathologie_id
  ORDER BY COALESCE(r.score_final, pc.priorite::numeric / 100.0) DESC
  LIMIT p_limit;
$$;
