-- ================================================================
-- Migration round 2 : nettoyage GLOBAL final de toute la base
--
-- Audit complet sur 78 155 PCs a révélé :
--   • 771 phrases citant un médicament autre que le leur
--   • 192 combos médicalement faux (laxatif/anti-nausées sur antalgiques
--     non-opioïdes — le paracétamol ne constipe pas, l'ibuprofène non plus)
--   • Placeholders "Labo X" dans certaines lignes
--   • Cross-sells de la même molécule (Doliprane → Doliprane)
--   • Médicaments sans PC (anticoagulants type Xarelto, Eliquis…)
--
-- Cette migration nettoie tout en 5 passes.
-- ================================================================

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 1 — Suppression robuste des placeholders                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝
DELETE FROM public.produits_complementaires
WHERE produit ILIKE 'labo x%'
   OR produit ILIKE 'labo y%'
   OR produit ILIKE 'labo z%'
   OR produit ILIKE 'product x%'
   OR produit ILIKE 'placeholder%'
   OR produit ILIKE 'todo%'
   OR produit ILIKE 'tbd%'
   OR produit ~* '^xxx+'
   OR produit ~* '^\?\?+'
   OR produit IS NULL
   OR LENGTH(TRIM(produit)) < 3;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 2 — Supprimer combos médicalement FAUX par classe ATC           ║
-- ║   (utilise ILIKE pour fiabilité — l'audit a montré que regex POSIX    ║
-- ║   ne supprimait pas correctement)                                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- 2.1 — Laxatifs sur antalgiques non-opioïdes (paracétamol, AINS, aspirine)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (
    pc.produit ILIKE '%macrogol%'
    OR pc.produit ILIKE '%forlax%'
    OR pc.produit ILIKE '%movicol%'
    OR pc.produit ILIKE '%transipeg%'
    OR pc.produit ILIKE '%dulcolax%'
    OR pc.produit ILIKE '%importal%'
    OR pc.produit ILIKE '%laxatif%'
    OR pc.produit ILIKE '%lansoyl%'
    OR pc.produit ILIKE '%microlax%'
  )
  AND (
    m.atc_code LIKE 'N02BE%'   -- paracétamol
    OR m.atc_code LIKE 'M01AE%'  -- ibuprofène
    OR m.atc_code LIKE 'M01AB%'  -- diclofénac, indométacine
    OR m.atc_code LIKE 'M01AC%'  -- piroxicam, méloxicam
    OR m.atc_code LIKE 'M01AH%'  -- coxibs
    OR m.atc_code LIKE 'N02BA%'  -- aspirine antalgique
    OR m.atc_code LIKE 'N02BB%'  -- métamizole
    OR m.atc_code LIKE 'J01%'    -- antibiotiques (provoquent diarrhée)
  );

-- 2.2 — Anti-nausées opioïdes sur antalgiques non-opioïdes
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (
    pc.produit ILIKE '%dompéridone%'
    OR pc.produit ILIKE '%domperidone%'
    OR pc.produit ILIKE '%métoclopramide%'
    OR pc.produit ILIKE '%metoclopramide%'
    OR pc.produit ILIKE '%motilium%'
    OR pc.produit ILIKE '%primperan%'
    OR pc.produit ILIKE '%vogalène%'
    OR pc.produit ILIKE '%antiémétique%'
  )
  AND (
    m.atc_code LIKE 'N02BE%'
    OR m.atc_code LIKE 'M01AE%'
    OR m.atc_code LIKE 'M01AB%'
    OR m.atc_code LIKE 'M01AC%'
    OR m.atc_code LIKE 'N02BA%'
  );

-- 2.3 — Anticoagulant + aspirine (DANGER : interaction grave, risque hémorragique)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (
    pc.produit ILIKE '%aspirine%'
    OR pc.produit ILIKE '%aspegic%'
    OR pc.produit ILIKE '%kardegic%'
    OR pc.produit ILIKE '%catalgine%'
  )
  AND m.atc_code LIKE 'B01A%';

-- 2.4 — Antidépresseurs ISRS + millepertuis (interaction grave : syndrome sérotoninergique)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.produit ILIKE '%millepertuis%'
  AND (
    m.atc_code LIKE 'N06AB%'  -- ISRS
    OR m.atc_code LIKE 'N06AX%'  -- autres antidépresseurs
  );

-- 2.5 — Lévothyroxine + calcium/fer (interaction d'absorption majeure)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (
    pc.produit ILIKE '%calcium%'
    OR pc.produit ILIKE '%fer %'
    OR pc.produit ILIKE 'fer'
    OR pc.produit ILIKE '%fumafer%'
    OR pc.produit ILIKE '%tardyferon%'
  )
  AND m.atc_code LIKE 'H03AA%';  -- Lévothyroxine

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 3 — Cross-sells de la même molécule                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- 3.1 — Paracétamol → paracétamol
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'N02BE%'
  AND (
    pc.produit ILIKE '%doliprane%'
    OR pc.produit ILIKE '%efferalgan%'
    OR pc.produit ILIKE '%dafalgan%'
    OR pc.produit ILIKE '%paracetamol%'
    OR pc.produit ILIKE '%paracétamol%'
    OR pc.produit ILIKE '%paralyoc%'
  );

-- 3.2 — Ibuprofène → ibuprofène
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'M01AE%'
  AND (
    pc.produit ILIKE '%ibuprof%'
    OR pc.produit ILIKE '%nurofen%'
    OR pc.produit ILIKE '%advil%'
    OR pc.produit ILIKE '%spedifen%'
    OR pc.produit ILIKE '%antarene%'
    OR pc.produit ILIKE '%nureflex%'
  );

-- 3.3 — Aspirine → aspirine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (m.atc_code LIKE 'N02BA%' OR m.atc_code LIKE 'B01AC06%')
  AND (
    pc.produit ILIKE '%aspirine%'
    OR pc.produit ILIKE '%aspegic%'
    OR pc.produit ILIKE '%kardegic%'
  );

-- 3.4 — Statines → statines
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'C10AA%'
  AND (
    pc.produit ILIKE '%statine%'
    OR pc.produit ILIKE '%atorvastatine%'
    OR pc.produit ILIKE '%rosuvastatine%'
    OR pc.produit ILIKE '%simvastatine%'
    OR pc.produit ILIKE '%pravastatine%'
    OR pc.produit ILIKE '%tahor%'
    OR pc.produit ILIKE '%crestor%'
    OR pc.produit ILIKE '%zocor%'
  );

-- 3.5 — IPP → IPP
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'A02BC%'
  AND (
    pc.produit ILIKE '%oméprazole%'
    OR pc.produit ILIKE '%omeprazole%'
    OR pc.produit ILIKE '%pantoprazole%'
    OR pc.produit ILIKE '%esoméprazole%'
    OR pc.produit ILIKE '%esomeprazole%'
    OR pc.produit ILIKE '%lansoprazole%'
    OR pc.produit ILIKE '%inexium%'
    OR pc.produit ILIKE '%mopral%'
  );

-- 3.6 — Metformine → metformine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'A10BA%'
  AND (
    pc.produit ILIKE '%metformine%'
    OR pc.produit ILIKE '%glucophage%'
    OR pc.produit ILIKE '%stagid%'
  );

-- 3.7 — Lévothyroxine → lévothyroxine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'H03AA%'
  AND (
    pc.produit ILIKE '%lévothyrox%'
    OR pc.produit ILIKE '%levothyrox%'
    OR pc.produit ILIKE '%euthyrox%'
    OR pc.produit ILIKE '%tcaps%'
  );

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 4 — Phrases conseil contaminées (citent un autre médicament)    ║
-- ║   → mises à NULL, régénérées au runtime par generatePhraseConseil     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- Phrases mentionnant TRAMADOL sur médicament ≠ tramadol
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%tramadol%'
  AND m.nom_commercial NOT ILIKE '%tramadol%'
  AND m.nom_commercial NOT ILIKE '%topalgic%'
  AND m.nom_commercial NOT ILIKE '%contramal%'
  AND m.nom_commercial NOT ILIKE '%ixprim%'
  AND COALESCE(m.atc_code, '') NOT LIKE 'N02AX02%';

-- Phrases mentionnant CODÉINE sur médicament ≠ codéine
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND (pc.phrase_conseil ILIKE '%codéine%' OR pc.phrase_conseil ILIKE '%codeine%')
  AND m.nom_commercial NOT ILIKE '%codein%'
  AND m.nom_commercial NOT ILIKE '%codoliprane%'
  AND m.nom_commercial NOT ILIKE '%klipal%'
  AND m.nom_commercial NOT ILIKE '%dafalgan codein%'
  AND m.nom_commercial NOT ILIKE '%efferalgan codein%';

-- Phrases mentionnant MORPHINE sur médicament ≠ morphine
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%morphine%'
  AND m.nom_commercial NOT ILIKE '%morphine%'
  AND m.nom_commercial NOT ILIKE '%skenan%'
  AND m.nom_commercial NOT ILIKE '%moscontin%'
  AND m.nom_commercial NOT ILIKE '%actiskenan%'
  AND m.nom_commercial NOT ILIKE '%sevredol%';

-- Phrases mentionnant OXYCODONE sur médicament ≠ oxycodone
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%oxycodone%'
  AND m.nom_commercial NOT ILIKE '%oxycodone%'
  AND m.nom_commercial NOT ILIKE '%oxycontin%'
  AND m.nom_commercial NOT ILIKE '%oxynorm%';

-- Phrases mentionnant IBUPROFÈNE sur médicament ≠ AINS
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND (pc.phrase_conseil ILIKE '%ibuprofène%' OR pc.phrase_conseil ILIKE '%ibuprofene%')
  AND m.nom_commercial NOT ILIKE '%ibuprof%'
  AND m.nom_commercial NOT ILIKE '%nurofen%'
  AND m.nom_commercial NOT ILIKE '%advil%'
  AND m.nom_commercial NOT ILIKE '%spedifen%'
  AND COALESCE(m.atc_code, '') NOT LIKE 'M01AE%';

-- Phrases mentionnant MÉTHOTREXATE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND (pc.phrase_conseil ILIKE '%méthotrexate%' OR pc.phrase_conseil ILIKE '%methotrexate%')
  AND m.nom_commercial NOT ILIKE '%methotrexate%'
  AND m.nom_commercial NOT ILIKE '%metoject%'
  AND m.nom_commercial NOT ILIKE '%imeth%';

-- Phrases mentionnant FUROSÉMIDE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND (pc.phrase_conseil ILIKE '%furosémide%' OR pc.phrase_conseil ILIKE '%furosemide%')
  AND m.nom_commercial NOT ILIKE '%furosemide%'
  AND m.nom_commercial NOT ILIKE '%lasilix%'
  AND COALESCE(m.atc_code, '') NOT LIKE 'C03CA%';

-- Phrases mentionnant LITHIUM
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%lithium%'
  AND m.nom_commercial NOT ILIKE '%lithium%'
  AND m.nom_commercial NOT ILIKE '%teralithe%';

-- Phrases mentionnant VALPROATE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%valproate%'
  AND m.nom_commercial NOT ILIKE '%valproate%'
  AND m.nom_commercial NOT ILIKE '%depakine%'
  AND m.nom_commercial NOT ILIKE '%depakote%';

-- Phrases mentionnant DULOXÉTINE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND (pc.phrase_conseil ILIKE '%duloxétine%' OR pc.phrase_conseil ILIKE '%duloxetine%')
  AND m.nom_commercial NOT ILIKE '%duloxetine%'
  AND m.nom_commercial NOT ILIKE '%cymbalta%';

-- Phrases mentionnant MIRTAZAPINE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%mirtazapine%'
  AND m.nom_commercial NOT ILIKE '%mirtazapine%'
  AND m.nom_commercial NOT ILIKE '%norset%';

-- Phrases mentionnant ASPIRINE sur médicament ≠ aspirine
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%aspirine%'
  AND m.nom_commercial NOT ILIKE '%aspirin%'
  AND m.nom_commercial NOT ILIKE '%aspegic%'
  AND m.nom_commercial NOT ILIKE '%kardegic%'
  AND m.nom_commercial NOT ILIKE '%catalgine%'
  AND COALESCE(m.atc_code, '') NOT LIKE 'B01AC06%'
  AND COALESCE(m.atc_code, '') NOT LIKE 'N02BA01%';

-- Phrases mentionnant METFORMINE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%metformine%'
  AND m.nom_commercial NOT ILIKE '%metformine%'
  AND m.nom_commercial NOT ILIKE '%glucophage%'
  AND m.nom_commercial NOT ILIKE '%stagid%';

-- Phrases mentionnant AMOXICILLINE
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil ILIKE '%amoxicilline%'
  AND m.nom_commercial NOT ILIKE '%amoxicilline%'
  AND m.nom_commercial NOT ILIKE '%clamoxyl%'
  AND m.nom_commercial NOT ILIKE '%augmentin%';

-- Phrases avec FAUSSES INFOS médicales (paracétamol qui constipe, etc.)
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil IS NOT NULL
  AND (
    pc.phrase_conseil ILIKE '%peut ralentir le transit%'
    OR pc.phrase_conseil ILIKE '%constipe%'
  )
  AND (
    m.atc_code LIKE 'N02BE%'   -- paracétamol
    OR m.atc_code LIKE 'M01AE%'  -- ibuprofène
    OR m.atc_code LIKE 'M01AB%'
    OR m.atc_code LIKE 'M01AC%'
    OR m.atc_code LIKE 'N02BA%'  -- aspirine
    OR m.atc_code LIKE 'J01%'    -- antibiotiques (provoquent diarrhée)
  );

-- Phrases avec fautes d'élision "Le Amoxicilline", "Le Augmentin", "Le Aspirine"...
UPDATE public.produits_complementaires
SET phrase_conseil = NULL
WHERE phrase_conseil IS NOT NULL
  AND (
    phrase_conseil ~ 'Le (Amoxicilline|Augmentin|Aspirine|Ibuprofène|Ibuprofene|Aspégic|Efferalgan|Aciclovir|Insuline|Esoméprazole|Esomeprazole|Oméprazole|Omeprazole|Optrex|Augmentin)'
    OR phrase_conseil ~ 'La (Doliprane|Nurofen|Xarelto|L[ée]vothyrox|Tahor|Plavix|Kardégic|Kardegic|Tramadol|Imodium|Inexium|Mopral|Lasilix|Lyrica|Imodium|Augmentin|Voltarene|Voltarène)'
  );

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 5 — Ajout de PCs essentiels pour classes sans PC                ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- 5.1 — ANTICOAGULANTS (B01A) — Xarelto, Eliquis, Pradaxa, Sintrom, AVK
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Brosse à dents souple ultra-douce',
  'Hygiène buccale',
  'Brosse à dents extra-souple pour éviter les saignements gingivaux sous anticoagulant',
  'Sous anticoagulant, les gencives saignent plus facilement. Cette brosse douce protège vos gencives sans agresser au brossage.',
  98,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'B01A%'
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Brosse à dents souple ultra-douce'
  );

INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Pansements hémostatiques Urgo Coupures',
  'Premiers soins',
  'Pansements qui stoppent les saignements cutanés rapidement',
  'Les petites coupures saignent plus longtemps sous anticoagulant. Ces pansements stoppent rapidement le saignement.',
  95,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'B01A%'
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Pansements hémostatiques Urgo Coupures'
  );

-- 5.2 — Gaviscon pour TOUS les AINS (M01AE et M01AB)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Gaviscon suspension buvable',
  'Médicament OTC',
  'Pansement gastrique pour protéger l''estomac des AINS',
  'Les anti-inflammatoires peuvent irriter l''estomac. Ce gel forme une barrière protectrice contre les brûlures.',
  97,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (m.atc_code LIKE 'M01AE%' OR m.atc_code LIKE 'M01AB%' OR m.atc_code LIKE 'M01AC%')
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Gaviscon suspension buvable'
  );

-- 5.3 — Probiotiques pour TOUS les antibiotiques (J01)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Ultra-Levure 200mg',
  'Probiotique',
  'Probiotique Saccharomyces boulardii pour protéger la flore intestinale',
  'Les antibiotiques détruisent aussi les bonnes bactéries de l''intestin. Ce probiotique protège votre ventre et évite la diarrhée.',
  97,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'J01%'
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Ultra-Levure 200mg'
  );

-- 5.4 — Larmes artificielles pour antidépresseurs (sécheresse oculaire fréquente)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Larmes artificielles Hyabak',
  'Ophtalmologie',
  'Collyre hydratant à l''acide hyaluronique pour la sécheresse oculaire',
  'Les antidépresseurs peuvent provoquer une sécheresse des yeux. Ces larmes artificielles hydratent et soulagent l''inconfort.',
  90,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE (m.atc_code LIKE 'N06AB%' OR m.atc_code LIKE 'N06AX%' OR m.atc_code LIKE 'N06AA%')
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Larmes artificielles Hyabak'
  );

-- 5.5 — Magnésium pour IPP au long cours (déficit magnésien fréquent)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Magnésium bisglycinate 300mg',
  'Complément alimentaire',
  'Magnésium hautement assimilable pour compenser le déficit lié aux IPP',
  'Les IPP au long cours peuvent faire baisser le magnésium dans le sang. Ce complément prévient les crampes et la fatigue.',
  95,
  'complement',
  true,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'A02BC%'
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Magnésium bisglycinate 300mg'
  );

-- 5.6 — Vitamine B12 pour metformine (carence fréquente)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Vitamine B12 sublinguale 1000µg',
  'Complément alimentaire',
  'Vitamine B12 sublinguale pour compenser la carence liée à la metformine',
  'La metformine peut faire baisser la vitamine B12 sur la durée. Ce complément prévient la fatigue et les fourmillements.',
  90,
  'complement',
  true,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'A10BA%'
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Vitamine B12 sublinguale 1000µg'
  );

-- 5.7 — Vitamine D pour corticoïdes au long cours
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Vitamine D3 1000UI',
  'Complément alimentaire',
  'Vitamine D pour protéger les os pendant la corticothérapie',
  'La cortisone fragilise les os avec le temps. Cette vitamine D aide à les protéger et prévenir l''ostéoporose.',
  92,
  'complement',
  true,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'H02%'  -- corticoïdes systémiques
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Vitamine D3 1000UI'
  );

-- 5.8 — Bain de bouche pour corticoïdes inhalés (mycoses buccales)
INSERT INTO public.produits_complementaires
  (medicament_id, produit, categorie, description, phrase_conseil, priorite, type_produit, est_complement, est_otc)
SELECT
  m.id,
  'Bain de bouche Hextril',
  'Hygiène buccale',
  'Bain de bouche pour prévenir les mycoses buccales',
  'Les corticoïdes inhalés peuvent laisser des dépôts dans la bouche et favoriser les infections. Ce bain de bouche les prévient.',
  93,
  'produit_conseil',
  false,
  true
FROM public.medicaments m
WHERE m.atc_code LIKE 'R03BA%'  -- corticoïdes inhalés
  AND NOT EXISTS (
    SELECT 1 FROM public.produits_complementaires pc2
    WHERE pc2.medicament_id = m.id AND pc2.produit = 'Bain de bouche Hextril'
  );
