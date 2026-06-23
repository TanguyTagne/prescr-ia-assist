-- ================================================================
-- Migration : PCs génériques pour les médicaments courants
--
-- Contexte : pour les médicaments très génériques (paracétamol,
-- ibuprofène, aspirine), Widget.tsx privilégie maintenant les PCs
-- liés directement au médicament (par medicament_id) plutôt que les
-- PCs liés à des pathologies multiples (qui produisaient des
-- suggestions absurdes — ex: Cytelium varicelle pour Doliprane).
--
-- Cette migration insère 2 PCs pertinents par médicament générique.
-- Idempotente : NOT EXISTS évite les doublons.
-- ================================================================

-- ── PARACÉTAMOL (Doliprane, Efferalgan, Dafalgan…) ──────────────────────
-- Antalgique/antipyrétique générique → PCs pour les douleurs en général
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Magnésium bisglycinate 300mg',
  'Complément alimentaire',
  'Magnésium hautement assimilable pour douleurs musculaires et tensions',
  'Le magnésium aide à détendre les muscles et soulager les douleurs courantes du quotidien.',
  95,
  'complement',
  true,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'doliprane%'
  OR m.nom_commercial ILIKE 'efferalgan%'
  OR m.nom_commercial ILIKE 'dafalgan%'
  OR m.nom_commercial ILIKE 'paracetamol%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Magnésium bisglycinate 300mg'
);

INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Patch chauffant ThermaCare',
  'Dispositif médical',
  'Patch chauffant longue durée pour douleurs localisées',
  'La chaleur localisée apaise efficacement les douleurs musculaires, articulaires et menstruelles.',
  90,
  'dispositif_medical',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'doliprane%'
  OR m.nom_commercial ILIKE 'efferalgan%'
  OR m.nom_commercial ILIKE 'dafalgan%'
  OR m.nom_commercial ILIKE 'paracetamol%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Patch chauffant ThermaCare'
);

-- ── IBUPROFÈNE (Nurofen, Advil, Spedifen, Ibuprofène EG…) ────────────────
-- AINS → protection gastrique + soulagement local
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gaviscon suspension buvable',
  'Médicament OTC',
  'Pansement gastrique pour protéger l''estomac des AINS',
  'L''ibuprofène peut irriter l''estomac. Ce gel forme une barrière protectrice contre les brûlures.',
  95,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'nurofen%'
  OR m.nom_commercial ILIKE 'advil%'
  OR m.nom_commercial ILIKE 'spedifen%'
  OR m.nom_commercial ILIKE 'ibuprofene%'
  OR m.nom_commercial ILIKE 'antarene%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Gaviscon suspension buvable'
);

INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gel arnica anti-inflammatoire',
  'Dermocosmétique',
  'Gel apaisant à base d''arnica pour douleurs musculaires localisées',
  'Pour les douleurs musculaires localisées, ce gel complète l''effet antalgique en agissant directement sur la zone douloureuse.',
  90,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'nurofen%'
  OR m.nom_commercial ILIKE 'advil%'
  OR m.nom_commercial ILIKE 'spedifen%'
  OR m.nom_commercial ILIKE 'ibuprofene%'
  OR m.nom_commercial ILIKE 'antarene%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Gel arnica anti-inflammatoire'
);

-- ── ASPIRINE (Aspégic, Aspirine, Kardégic à dose antalgique) ──────────────
-- Note : on cible uniquement les dosages antalgiques (500mg, 1000mg),
-- pas les doses cardio (75mg, 100mg, 160mg, 300mg) qui ont leur propre logique.
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gaviscon suspension buvable',
  'Médicament OTC',
  'Pansement gastrique pour protéger l''estomac',
  'L''aspirine irrite la muqueuse de l''estomac. Ce gel protecteur réduit les brûlures et l''inconfort digestif.',
  95,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'aspegic 500%'
  OR m.nom_commercial ILIKE 'aspegic 1000%'
  OR m.nom_commercial ILIKE 'aspirine upsa%'
  OR m.nom_commercial ILIKE 'aspirine du rhone%'
  OR m.nom_commercial ILIKE 'catalgine%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Gaviscon suspension buvable'
);

-- ── DICLOFÉNAC (Voltarène) ────────────────────────────────────────────────
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gaviscon suspension buvable',
  'Médicament OTC',
  'Pansement gastrique pour AINS au long cours',
  'Le diclofénac peut irriter l''estomac surtout en cure longue. Ce gel protège la muqueuse digestive.',
  95,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'voltarene%'
  OR m.nom_commercial ILIKE 'diclofenac%'
  OR m.nom_commercial ILIKE 'flector%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Gaviscon suspension buvable'
);

-- ── KÉTOPROFÈNE (Profénid, Ketum, Toprec) ─────────────────────────────────
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gaviscon suspension buvable',
  'Médicament OTC',
  'Pansement gastrique pour AINS',
  'Le kétoprofène peut provoquer des brûlures d''estomac. Ce gel forme une barrière protectrice.',
  95,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (
  m.nom_commercial ILIKE 'profenid%'
  OR m.nom_commercial ILIKE 'ketum%'
  OR m.nom_commercial ILIKE 'ketoprofene%'
  OR m.nom_commercial ILIKE 'toprec%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.produits_complementaires pc
  WHERE pc.medicament_id = m.id AND pc.produit = 'Gaviscon suspension buvable'
);

-- ── Bilan ────────────────────────────────────────────────────────────────
-- Vérifier avec :
--   SELECT m.nom_commercial, pc.produit, pc.phrase_conseil
--   FROM produits_complementaires pc
--   JOIN medicaments m ON m.id = pc.medicament_id
--   WHERE m.nom_commercial ILIKE 'doliprane%'
--   ORDER BY pc.priorite DESC;
