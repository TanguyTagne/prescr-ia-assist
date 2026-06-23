-- 1. Add cible_age columns
ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS cible_age TEXT NOT NULL DEFAULT 'tous'
  CHECK (cible_age IN ('nourrisson','enfant','adulte','tous'));

ALTER TABLE public.produits_complementaires
  ADD COLUMN IF NOT EXISTS cible_age TEXT[] NOT NULL DEFAULT ARRAY['tous']::TEXT[];

CREATE INDEX IF NOT EXISTS idx_medicaments_cible_age ON public.medicaments(cible_age);
CREATE INDEX IF NOT EXISTS idx_pc_cible_age ON public.produits_complementaires USING GIN(cible_age);

-- 2. Backfill medicaments.cible_age
-- Nourrisson
UPDATE public.medicaments SET cible_age = 'nourrisson'
WHERE cible_age = 'tous'
  AND (nom_commercial ~* '(nourrisson|nourisson|bébé|bebe|baby|infant)'
       OR posologie    ~* '(nourrisson|< ?6 ?mois|0-?6 ?mois|moins de 6 mois)');

-- Enfant
UPDATE public.medicaments SET cible_age = 'enfant'
WHERE cible_age = 'tous'
  AND (nom_commercial ~* '(enfant|pédiatr|pediatr|junior|kids|child)'
       OR posologie    ~* '(enfant|pédiatr|< ?12 ?ans|moins de 12 ans|6-?12 ?ans)'
       OR (atc_code LIKE 'J07%' AND nom_commercial ~* '(infanrix|prevenar|rotateq|rotarix|priorix|engerix|gardasil 9|menjugate|repevax)')
       OR (forme_galenique ~* 'sirop' AND nom_commercial !~* 'toux adulte')
       OR (forme_galenique ~* 'suspension buvable' AND dosage ~* '(2,?4 ?%|100 ?mg|20 ?mg/ml|125 ?mg)'));

-- 3. Backfill produits_complementaires.cible_age
-- Whitelist pédiatrique
UPDATE public.produits_complementaires SET cible_age = ARRAY['nourrisson','enfant']::TEXT[]
WHERE produit ~* '(stérimar.*bébé|stérimar.*nourrisson|physiomer.*bébé|physiomer.*nourrisson|prorhinel.*bébé|bepanthen|mustela|weleda bébé|calmosine|biogaia|pediakid|pédiakid|forlax junior|movicol enfant|microlax bébé|eludril junior|fluor.*enfant|gaviscon nourrisson|gaviscon enfant|smecta enfant|tiorfast enfant|ergyphilus.*enfant|liniment oléo-calcaire|eau thermale bébé|bioderma ABCDerm|mosquito.*bébé|mouche-bébé)';

-- Pédiatrique large (sirops, gouttes enfant)
UPDATE public.produits_complementaires SET cible_age = ARRAY['enfant','adulte']::TEXT[]
WHERE cible_age = ARRAY['tous']::TEXT[]
  AND produit ~* '(doliprane.*sirop|doliprane 2,?4|doliprane 100|advil.*enfant|nurofen.*enfant|efferalgan.*sirop|efferalgan.*susp|zymad|vitamine d.*sirop|propolis.*enfant|miel.*thym|thermomètre|sérum physiologique|sérum.*nasal)';

-- Adulte strict (blacklist pédiatrique)
UPDATE public.produits_complementaires SET cible_age = ARRAY['adulte']::TEXT[]
WHERE cible_age = ARRAY['tous']::TEXT[]
  AND produit ~* '(aspirine|aspégic|kardégic|ibuprofène ?400|ibuprofen ?400|nurofen ?400|paracétamol ?1000|doliprane ?1000|efferalgan ?1000|mopralpro|inexium|oméprazole|esoméprazole|pantoprazole|baume du tigre|harpagophyt|curcuma|huile essentielle|magnésium ?(200|300|400|450)|spasfon lyoc|imodium adulte|smecta adulte|nicopatch|nicorette|champix|cialis|viagra)';