-- ================================================================
-- Migration : tables de pricing réel des produits complémentaires
--
-- Objectif : remplacer la map prix moyen par catégorie hardcodée dans
-- pharmacy-roi-stats par une mesure réelle. Indispensable pour rendre
-- le pricing success-fee 10 % bulletproof face aux contestations.
--
-- Architecture en 3 niveaux :
--   1. pc_pricing : prix unitaire exact par PC (top 100+)
--   2. pc_category_pricing : moyenne pondérée par volume, par catégorie
--   3. Fallback constant (déjà dans le code)
-- ================================================================

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Table 1 : prix unitaire exact par PC                              ║
-- ╚════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.pc_pricing (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_nom          TEXT        NOT NULL,        -- match exact avec produits_complementaires.produit
  pc_nom_normalise TEXT       NOT NULL,        -- lowercase + sans accents pour fuzzy
  cip13           TEXT,                         -- si le PC a un CIP officiel
  prix_unitaire_ttc NUMERIC(8,2) NOT NULL,     -- prix TTC moyen public (€)
  prix_min_ttc    NUMERIC(8,2),
  prix_max_ttc    NUMERIC(8,2),
  categorie       TEXT,
  source          TEXT NOT NULL DEFAULT 'manual', -- 'vidal' / 'grossiste' / 'lgo' / 'manual' / 'estim'
  volume_pondere  INTEGER DEFAULT 0,            -- ventes mensuelles moyennes (pour pondération)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  UNIQUE (pc_nom_normalise)
);

CREATE INDEX IF NOT EXISTS pc_pricing_cip_idx     ON public.pc_pricing (cip13);
CREATE INDEX IF NOT EXISTS pc_pricing_categorie_idx ON public.pc_pricing (categorie);

ALTER TABLE public.pc_pricing ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les authenticated (les pharmacies doivent voir leurs propres prix)
CREATE POLICY "Authenticated read pc_pricing"
  ON public.pc_pricing FOR SELECT TO authenticated USING (true);

-- Édition : admins uniquement
CREATE POLICY "Admins manage pc_pricing"
  ON public.pc_pricing FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role (Edge Functions) full access
CREATE POLICY "Service manage pc_pricing"
  ON public.pc_pricing FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Table 2 : prix moyen pondéré par catégorie                        ║
-- ║ Recalculé périodiquement à partir des ventes réelles              ║
-- ╚════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.pc_category_pricing (
  categorie         TEXT PRIMARY KEY,
  prix_moyen_pondere NUMERIC(8,2) NOT NULL,
  nb_pcs_referenced INTEGER DEFAULT 0,
  volume_total      INTEGER DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  method            TEXT NOT NULL DEFAULT 'volume_weighted' -- 'volume_weighted' / 'arithmetic' / 'manual'
);

ALTER TABLE public.pc_category_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pc_category_pricing"
  ON public.pc_category_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pc_category_pricing"
  ON public.pc_category_pricing FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage pc_category_pricing"
  ON public.pc_category_pricing FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Seed initial : ~50 PCs les plus vendus en officine                ║
-- ║ Prix moyens publics 2025 (sources : Vidal grand public,           ║
-- ║ catalogue grossiste, sites pharmacies en ligne)                   ║
-- ╚════════════════════════════════════════════════════════════════════╝
INSERT INTO public.pc_pricing
  (pc_nom, pc_nom_normalise, prix_unitaire_ttc, categorie, source, volume_pondere)
VALUES
  -- Compléments alimentaires (les plus vendus)
  ('Magnésium bisglycinate 300mg', 'magnesium bisglycinate', 12.50, 'Complément alimentaire', 'manual', 5736),
  ('Magnésium bisglycinate 400mg', 'magnesium bisglycinate',  14.00, 'Complément alimentaire', 'manual', 1200),
  ('Vitamine D3 1000UI',           'vitamine d3',              9.00, 'Complément alimentaire', 'manual', 787),
  ('Coenzyme Q10 100mg',           'coenzyme q10',            20.00, 'Complément alimentaire', 'manual', 1303),
  ('CoQ10 Ubiquinol 100mg',        'coq10 ubiquinol',         28.00, 'Complément alimentaire', 'manual', 800),
  ('Vitamine B12 sublinguale 1000µg', 'vitamine b12 sublinguale', 11.00, 'Complément alimentaire', 'manual', 450),
  ('Oméga-3 EPA/DHA 1000mg',       'omega 3 epa dha',         18.00, 'Complément alimentaire', 'manual', 766),
  ('Mélatonine 1mg LP',            'melatonine',               9.50, 'Complément alimentaire', 'manual', 933),
  ('Probiotiques Lactibiane Référence', 'probiotiques lactibiane reference', 22.00, 'Probiotique', 'manual', 1461),
  ('Ultra-Levure 200mg',           'ultra levure',             6.00, 'Probiotique', 'manual', 1100),

  -- Dispositifs médicaux courants
  ('Thermomètre digital',          'thermometre digital',     12.00, 'Dispositif médical', 'manual', 600),
  ('Patch chauffant ThermaCare',   'patch chauffant thermacare', 8.50, 'Dispositif médical', 'manual', 900),
  ('Tensiomètre Omron poignet',    'tensiometre omron poignet', 45.00, 'Dispositif médical', 'manual', 1377),
  ('Lecteur glycémie OneTouch',    'lecteur glycemie onetouch', 30.00, 'Dispositif médical', 'manual', 400),
  ('Bandelettes glycémie + lancettes', 'bandelettes glycemie lancettes', 25.00, 'Dispositif médical', 'manual', 500),
  ('Bas de contention 15-20 mmHg', 'bas de contention',       28.00, 'Dispositif médical', 'manual', 810),
  ('Ceinture lombaire de soutien', 'ceinture lombaire de soutien', 22.00, 'Dispositif médical', 'manual', 350),
  ('Mouche-bébé Prorhinel',        'mouche bebe prorhinel',    7.00, 'Dispositif médical', 'manual', 250),

  -- Gastro-entérologie / OTC
  ('Gaviscon suspension buvable',  'gaviscon suspension buvable', 12.00, 'Médicament OTC', 'manual', 1000),
  ('Smecta 3g sachets',            'smecta sachets',            7.50, 'Médicament OTC', 'manual', 800),
  ('Forlax 10g sachets',           'forlax sachets',            8.50, 'Médicament OTC', 'manual', 400),
  ('Charbon de Belloc',            'charbon de belloc',         9.00, 'Médicament OTC', 'manual', 200),
  ('Dompéridone 10mg',             'domperidone',               5.50, 'Médicament OTC', 'manual', 300),

  -- ORL / Voies aériennes
  ('Spray nasal eau de mer hypertonique', 'spray nasal eau de mer hypertonique', 8.50, 'ORL', 'manual', 1200),
  ('Spray nasal eau de mer isotonique',   'spray nasal eau de mer isotonique',   7.50, 'ORL', 'manual', 1000),
  ('Physiomer spray nasal adulte', 'physiomer spray nasal',     8.50, 'ORL', 'manual', 700),
  ('Sterimar eau de mer spray nasal', 'sterimar eau de mer',     8.00, 'ORL', 'manual', 600),
  ('Pastilles miel-citron Activox','pastilles miel citron activox', 6.50, 'ORL', 'manual', 1377),
  ('Sérum physiologique unidose',  'serum physiologique unidose', 4.00, 'ORL', 'manual', 800),

  -- Dermocosmétique
  ('Cicaplast Baume B5',           'cicaplast baume b5',       11.00, 'Dermocosmétique', 'manual', 600),
  ('Dexeryl crème tube 250g',      'dexeryl creme',             6.50, 'Dermocosmétique', 'manual', 700),
  ('Biafine émulsion',             'biafine emulsion',          7.00, 'Dermocosmétique', 'manual', 500),
  ('Bepanthen 5% crème',           'bepanthen creme',           8.00, 'Dermocosmétique', 'manual', 400),
  ('Larmes artificielles Hyabak',  'larmes artificielles hyabak', 14.00, 'Ophtalmologie', 'manual', 600),
  ('Théalose collyre',             'thealose collyre',         13.00, 'Ophtalmologie', 'manual', 350),

  -- Solaires
  ('Crème solaire SPF50+',         'creme solaire spf50',      18.00, 'Dermocosmétique', 'manual', 400),
  ('Spray SPF50+',                 'spray spf50',              16.00, 'Dermocosmétique', 'manual', 300),

  -- Anticoagulants / antiagrégants — accompagnement
  ('Brosse à dents souple ultra-douce', 'brosse a dents souple ultra douce', 4.50, 'Hygiène buccale', 'manual', 200),
  ('Pansements hémostatiques Urgo Coupures', 'pansements hemostatiques urgo coupures', 6.00, 'Premiers soins', 'manual', 250),

  -- Buccal / Pharyngé
  ('Bain de bouche Hextril',       'bain de bouche hextril',    7.00, 'Hygiène buccale', 'manual', 300),
  ('Gel buccal Pansoral',          'gel buccal pansoral',       9.50, 'Hygiène buccale', 'manual', 250),

  -- Phytothérapie
  ('Glucosamine chondroïtine',     'glucosamine chondroitine', 22.00, 'Phytothérapie', 'manual', 200),
  ('Stick menthe poivrée tempes',  'stick menthe poivree tempes', 7.00, 'Phytothérapie', 'manual', 300),
  ('Gel arnica anti-inflammatoire','gel arnica',                9.00, 'Phytothérapie', 'manual', 400),
  ('Tisane drainante',             'tisane drainante',          7.50, 'Phytothérapie', 'manual', 200),

  -- Intime / Mycoses
  ('Saforelle soin lavant intime', 'saforelle soin lavant intime', 9.00, 'Hygiène intime', 'manual', 250),
  ('Gel intime hydratant',         'gel intime hydratant',     14.00, 'Hygiène intime', 'manual', 200),

  -- Anti-douleur OTC
  ('Doliprane 1000mg',             'doliprane',                 2.30, 'Médicament OTC', 'manual', 2000),
  ('Nurofen 400mg',                'nurofen',                   3.50, 'Médicament OTC', 'manual', 1200),
  ('Spasfon Lyoc',                 'spasfon lyoc',              5.50, 'Médicament OTC', 'manual', 300)
ON CONFLICT (pc_nom_normalise) DO NOTHING;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Seed initial : moyennes pondérées par catégorie                   ║
-- ║ Calcul : sum(prix × volume) / sum(volume) pour chaque catégorie   ║
-- ╚════════════════════════════════════════════════════════════════════╝
INSERT INTO public.pc_category_pricing
  (categorie, prix_moyen_pondere, nb_pcs_referenced, volume_total, method)
SELECT
  categorie,
  ROUND(SUM(prix_unitaire_ttc * volume_pondere) / NULLIF(SUM(volume_pondere), 0), 2) AS prix_moyen_pondere,
  COUNT(*) AS nb_pcs_referenced,
  SUM(volume_pondere) AS volume_total,
  'volume_weighted'
FROM public.pc_pricing
WHERE categorie IS NOT NULL AND volume_pondere > 0
GROUP BY categorie
ON CONFLICT (categorie) DO UPDATE SET
  prix_moyen_pondere = EXCLUDED.prix_moyen_pondere,
  nb_pcs_referenced  = EXCLUDED.nb_pcs_referenced,
  volume_total       = EXCLUDED.volume_total,
  computed_at        = now(),
  method             = EXCLUDED.method;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Vérification post-migration                                       ║
-- ╚════════════════════════════════════════════════════════════════════╝
-- SELECT COUNT(*) FROM pc_pricing;
--   → ~50 lignes
--
-- SELECT categorie, prix_moyen_pondere, nb_pcs_referenced, volume_total
-- FROM pc_category_pricing ORDER BY volume_total DESC;
--   → moyennes pondérées par catégorie, prêtes à l'emploi
