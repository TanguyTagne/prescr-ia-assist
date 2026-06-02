-- Apply pre-staged migration file 20260602100000_pc_pricing_real.sql
-- Creates pc_pricing + pc_category_pricing with seed data

CREATE TABLE IF NOT EXISTS public.pc_pricing (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_nom          TEXT        NOT NULL,
  pc_nom_normalise TEXT       NOT NULL,
  cip13           TEXT,
  prix_unitaire_ttc NUMERIC(8,2) NOT NULL,
  prix_min_ttc    NUMERIC(8,2),
  prix_max_ttc    NUMERIC(8,2),
  categorie       TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  volume_pondere  INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  UNIQUE (pc_nom_normalise)
);

CREATE INDEX IF NOT EXISTS pc_pricing_cip_idx     ON public.pc_pricing (cip13);
CREATE INDEX IF NOT EXISTS pc_pricing_categorie_idx ON public.pc_pricing (categorie);

GRANT SELECT ON public.pc_pricing TO authenticated;
GRANT ALL ON public.pc_pricing TO service_role;

ALTER TABLE public.pc_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pc_pricing"
  ON public.pc_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pc_pricing"
  ON public.pc_pricing FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage pc_pricing"
  ON public.pc_pricing FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pc_category_pricing (
  categorie         TEXT PRIMARY KEY,
  prix_moyen_pondere NUMERIC(8,2) NOT NULL,
  nb_pcs_referenced INTEGER DEFAULT 0,
  volume_total      INTEGER DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  method            TEXT NOT NULL DEFAULT 'volume_weighted'
);

GRANT SELECT ON public.pc_category_pricing TO authenticated;
GRANT ALL ON public.pc_category_pricing TO service_role;

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

-- Seed ~50 common PCs
INSERT INTO public.pc_pricing
  (pc_nom, pc_nom_normalise, prix_unitaire_ttc, categorie, source, volume_pondere)
VALUES
  ('Magnésium bisglycinate 300mg', 'magnesium bisglycinate 300', 12.50, 'Complément alimentaire', 'manual', 5736),
  ('Magnésium bisglycinate 400mg', 'magnesium bisglycinate 400', 14.00, 'Complément alimentaire', 'manual', 1200),
  ('Vitamine D3 1000UI',           'vitamine d3 1000ui',          9.00, 'Complément alimentaire', 'manual', 787),
  ('Coenzyme Q10 100mg',           'coenzyme q10 100',           20.00, 'Complément alimentaire', 'manual', 1303),
  ('CoQ10 Ubiquinol 100mg',        'coq10 ubiquinol 100',        28.00, 'Complément alimentaire', 'manual', 800),
  ('Vitamine B12 sublinguale 1000µg', 'vitamine b12 sublinguale 1000', 11.00, 'Complément alimentaire', 'manual', 450),
  ('Oméga-3 EPA/DHA 1000mg',       'omega 3 epa dha 1000',       18.00, 'Complément alimentaire', 'manual', 766),
  ('Mélatonine 1mg LP',            'melatonine 1mg lp',           9.50, 'Complément alimentaire', 'manual', 933),
  ('Probiotiques Lactibiane Référence', 'probiotiques lactibiane reference', 22.00, 'Probiotique', 'manual', 1461),
  ('Ultra-Levure 200mg',           'ultra levure 200',            6.00, 'Probiotique', 'manual', 1100),
  ('Thermomètre digital',          'thermometre digital',        12.00, 'Dispositif médical', 'manual', 600),
  ('Patch chauffant ThermaCare',   'patch chauffant thermacare',  8.50, 'Dispositif médical', 'manual', 900),
  ('Tensiomètre Omron poignet',    'tensiometre omron poignet',  45.00, 'Dispositif médical', 'manual', 1377),
  ('Lecteur glycémie OneTouch',    'lecteur glycemie onetouch',  30.00, 'Dispositif médical', 'manual', 400),
  ('Bandelettes glycémie + lancettes', 'bandelettes glycemie lancettes', 25.00, 'Dispositif médical', 'manual', 500),
  ('Bas de contention 15-20 mmHg', 'bas de contention 15 20 mmhg', 28.00, 'Dispositif médical', 'manual', 810),
  ('Ceinture lombaire de soutien', 'ceinture lombaire de soutien', 22.00, 'Dispositif médical', 'manual', 350),
  ('Mouche-bébé Prorhinel',        'mouche bebe prorhinel',       7.00, 'Dispositif médical', 'manual', 250),
  ('Gaviscon suspension buvable',  'gaviscon suspension buvable', 12.00, 'Médicament OTC', 'manual', 1000),
  ('Smecta 3g sachets',            'smecta 3g sachets',           7.50, 'Médicament OTC', 'manual', 800),
  ('Forlax 10g sachets',           'forlax 10g sachets',          8.50, 'Médicament OTC', 'manual', 400),
  ('Charbon de Belloc',            'charbon de belloc',           9.00, 'Médicament OTC', 'manual', 200),
  ('Dompéridone 10mg',             'domperidone 10',              5.50, 'Médicament OTC', 'manual', 300),
  ('Spray nasal eau de mer hypertonique', 'spray nasal eau de mer hypertonique', 8.50, 'ORL', 'manual', 1200),
  ('Spray nasal eau de mer isotonique',   'spray nasal eau de mer isotonique',   7.50, 'ORL', 'manual', 1000),
  ('Physiomer spray nasal adulte', 'physiomer spray nasal adulte', 8.50, 'ORL', 'manual', 700),
  ('Sterimar eau de mer spray nasal', 'sterimar eau de mer spray nasal', 8.00, 'ORL', 'manual', 600),
  ('Pastilles miel-citron Activox','pastilles miel citron activox', 6.50, 'ORL', 'manual', 1377),
  ('Sérum physiologique unidose',  'serum physiologique unidose', 4.00, 'ORL', 'manual', 800),
  ('Cicaplast Baume B5',           'cicaplast baume b5',         11.00, 'Dermocosmétique', 'manual', 600),
  ('Dexeryl crème tube 250g',      'dexeryl creme tube 250g',     6.50, 'Dermocosmétique', 'manual', 700),
  ('Biafine émulsion',             'biafine emulsion',            7.00, 'Dermocosmétique', 'manual', 500),
  ('Bepanthen 5% crème',           'bepanthen 5 creme',           8.00, 'Dermocosmétique', 'manual', 400),
  ('Larmes artificielles Hyabak',  'larmes artificielles hyabak', 14.00, 'Ophtalmologie', 'manual', 600),
  ('Théalose collyre',             'thealose collyre',           13.00, 'Ophtalmologie', 'manual', 350),
  ('Crème solaire SPF50+',         'creme solaire spf50',        18.00, 'Dermocosmétique', 'manual', 400),
  ('Spray SPF50+',                 'spray spf50',                16.00, 'Dermocosmétique', 'manual', 300),
  ('Brosse à dents souple ultra-douce', 'brosse a dents souple ultra douce', 4.50, 'Hygiène buccale', 'manual', 200),
  ('Pansements hémostatiques Urgo Coupures', 'pansements hemostatiques urgo coupures', 6.00, 'Premiers soins', 'manual', 250),
  ('Bain de bouche Hextril',       'bain de bouche hextril',      7.00, 'Hygiène buccale', 'manual', 300),
  ('Gel buccal Pansoral',          'gel buccal pansoral',         9.50, 'Hygiène buccale', 'manual', 250),
  ('Glucosamine chondroïtine',     'glucosamine chondroitine',   22.00, 'Phytothérapie', 'manual', 200),
  ('Stick menthe poivrée',         'stick menthe poivree',        5.50, 'Phytothérapie', 'manual', 150),
  ('Doliprane 1000mg boîte 8',     'doliprane 1000 8',            2.20, 'Médicament OTC', 'manual', 3000),
  ('Spasfon Lyoc',                 'spasfon lyoc',                4.50, 'Médicament OTC', 'manual', 600),
  ('Imodium 2mg',                  'imodium 2',                   5.00, 'Médicament OTC', 'manual', 500),
  ('Strepsils miel-citron',        'strepsils miel citron',       5.50, 'ORL', 'manual', 700),
  ('Humex rhume',                  'humex rhume',                 6.50, 'ORL', 'manual', 500),
  ('Maalox suspension',            'maalox suspension',           7.50, 'Médicament OTC', 'manual', 300),
  ('Fer Tardyferon 80mg',          'fer tardyferon 80',           5.00, 'Complément alimentaire', 'manual', 400),
  ('Zinc 15mg',                    'zinc 15',                     8.00, 'Complément alimentaire', 'manual', 350)
ON CONFLICT (pc_nom_normalise) DO NOTHING;

-- Compute weighted average per category from seed
INSERT INTO public.pc_category_pricing (categorie, prix_moyen_pondere, nb_pcs_referenced, volume_total, method)
SELECT
  categorie,
  ROUND((SUM(prix_unitaire_ttc * GREATEST(volume_pondere,1)) / SUM(GREATEST(volume_pondere,1)))::numeric, 2),
  COUNT(*),
  SUM(GREATEST(volume_pondere,1)),
  'volume_weighted'
FROM public.pc_pricing
WHERE categorie IS NOT NULL
GROUP BY categorie
ON CONFLICT (categorie) DO UPDATE SET
  prix_moyen_pondere = EXCLUDED.prix_moyen_pondere,
  nb_pcs_referenced = EXCLUDED.nb_pcs_referenced,
  volume_total = EXCLUDED.volume_total,
  computed_at = now(),
  method = EXCLUDED.method;