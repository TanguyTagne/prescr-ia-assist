-- ================================================================
-- Migration : nettoyage GLOBAL des PCs sur toute la base
--
-- Problèmes identifiés par audit :
--   • 651 phrases conseil mentionnant un médicament autre que le leur
--     (ex: "Le tramadol constipe" sur Doliprane)
--   • 348 cross-sells de la même molécule (ex: paracétamol → paracétamol)
--   • 124 PCs "laxatif" sur des antalgiques non-opioïdes (faux)
--   • 23 PCs "anti-nausées opioïdes" sur paracétamol (faux)
--   • Magnésium bisglycinate proposé 5736 fois (copy-paste massif)
--
-- Stratégie en 3 passes :
--   PASSE 1 — Mettre à NULL les phrases contaminées (régénérées au runtime)
--   PASSE 2 — Supprimer les combos médicalement faux
--   PASSE 3 — Supprimer les cross-sells de molécule
-- ================================================================

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 1 — Phrases conseil contaminées par mauvais médicament           ║
-- ║ Les passe à NULL → analyze-prescription les régénère via              ║
-- ║ generatePhraseConseil() avec le bon contexte médicament.              ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- Pattern : la phrase mentionne un médicament X mais le PC est lié à un
-- médicament/molécule différent. On vide la phrase plutôt que de la supprimer.
UPDATE public.produits_complementaires pc
SET phrase_conseil = NULL
FROM public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.phrase_conseil IS NOT NULL
  AND (
    -- TRAMADOL mentionné mais médicament ≠ tramadol
    (pc.phrase_conseil ~* '\mtramadol\M'
     AND m.nom_commercial !~* 'tramadol|topalgic|contramal|ixprim|izalgi'
     AND COALESCE(m.atc_code, '') !~ '^N02AX02|^N02AJ06')
    OR
    -- CODÉINE mentionné mais médicament ≠ codéine
    (pc.phrase_conseil ~* '\mcod[ée]ine\M'
     AND m.nom_commercial !~* 'codein|codoliprane|klipal|dafalgan codein|efferalgan codein|nealgyl|prontalgine')
    OR
    -- MORPHINE mentionné mais médicament ≠ morphine
    (pc.phrase_conseil ~* '\mmorphine\M'
     AND m.nom_commercial !~* 'morphine|skenan|moscontin|actiskenan|sevredol|oramorph')
    OR
    -- OXYCODONE mentionné mais médicament ≠ oxycodone
    (pc.phrase_conseil ~* '\moxycodone\M'
     AND m.nom_commercial !~* 'oxycodone|oxycontin|oxynorm')
    OR
    -- IBUPROFÈNE mentionné mais médicament ≠ ibuprofène/AINS
    (pc.phrase_conseil ~* '\mibuprof[èe]ne\M'
     AND m.nom_commercial !~* 'ibuprof|nurofen|advil|spedifen|antaren|upfen|nureflex'
     AND COALESCE(m.atc_code, '') !~ '^M01AE')
    OR
    -- MÉTHOTREXATE mentionné mais médicament ≠ méthotrexate
    (pc.phrase_conseil ~* '\mm[ée]thotrexate\M'
     AND m.nom_commercial !~* 'methotrexate|metoject|imeth|nordimet|novatrex')
    OR
    -- FUROSÉMIDE mentionné mais médicament ≠ furosémide/diurétique
    (pc.phrase_conseil ~* '\mfuros[ée]mide\M'
     AND m.nom_commercial !~* 'furosemide|lasilix'
     AND COALESCE(m.atc_code, '') !~ '^C03CA')
    OR
    -- LITHIUM mentionné mais médicament ≠ lithium
    (pc.phrase_conseil ~* '\mlithium\M'
     AND m.nom_commercial !~* 'lithium|teralithe')
    OR
    -- VALPROATE mentionné mais médicament ≠ valproate
    (pc.phrase_conseil ~* '\mvalproate\M'
     AND m.nom_commercial !~* 'valproate|depakine|depakote|depamide|micropakine')
    OR
    -- DULOXÉTINE mentionné mais médicament ≠ duloxétine
    (pc.phrase_conseil ~* '\mdulox[ée]tine\M'
     AND m.nom_commercial !~* 'duloxetine|cymbalta')
    OR
    -- MIRTAZAPINE mentionné mais médicament ≠ mirtazapine
    (pc.phrase_conseil ~* '\mmirtazapine\M'
     AND m.nom_commercial !~* 'mirtazapine|norset')
    OR
    -- ASPIRINE mentionné mais médicament ≠ aspirine
    (pc.phrase_conseil ~* '\maspirine\M'
     AND m.nom_commercial !~* 'aspirin|aspegic|aspegyl|kardegic|catalgine|resitune'
     AND COALESCE(m.atc_code, '') !~ '^B01AC06|^N02BA01')
    OR
    -- TAMOXIFÈNE mentionné mais médicament ≠ tamoxifène
    (pc.phrase_conseil ~* '\mtamox[ie]f[èe]ne\M'
     AND m.nom_commercial !~* 'tamoxifene|nolvadex')
    OR
    -- METFORMINE mentionné mais médicament ≠ metformine
    (pc.phrase_conseil ~* '\mmetformine\M'
     AND m.nom_commercial !~* 'metformine|glucophage|stagid')
  );

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 2 — PCs médicalement faux par classe                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- 2.1 — Anti-nausées opioïdes (Dompéridone, Métoclopramide) sur ANTALGIQUES
--       NON-OPIOÏDES (paracétamol, AINS). Effet secondaire spécifique aux opioïdes.
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.produit ~* '\m(dompéridone|métoclopramide|motilium|primperan|vogalène|antiémétique)\M'
  AND (m.atc_code LIKE 'N02BE%'  -- paracétamol
       OR m.atc_code LIKE 'M01AE%'  -- ibuprofène
       OR m.atc_code LIKE 'M01AB%'  -- diclofénac
       OR m.atc_code LIKE 'M01AC%'  -- piroxicam
       OR m.atc_code LIKE 'N02BA%'  -- aspirine antalgique
       OR m.atc_code LIKE 'N02BB%') -- métamizole
  AND (m.atc_code NOT LIKE 'N02A%'); -- exclure opioïdes

-- 2.2 — Laxatifs sur ANTALGIQUES NON-OPIOÏDES (le paracétamol ne constipe pas)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.produit ~* '\m(macrogol|forlax|movicol|transipeg|laxatif osmotique|dulcolax|importal|lansoyl|microlax)\M'
  AND (m.atc_code LIKE 'N02BE%'  -- paracétamol
       OR m.atc_code LIKE 'M01AE%'  -- ibuprofène
       OR m.atc_code LIKE 'M01AB%'  -- diclofénac
       OR m.atc_code LIKE 'M01AC%'  -- piroxicam
       OR m.atc_code LIKE 'N02BA%'  -- aspirine
       OR m.atc_code LIKE 'N02BB%'); -- métamizole

-- 2.3 — Produits varicelle (Cytelium, Poxclin) hors traitement varicelle
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.produit ~* '\m(cytelium|poxclin)\M'
  AND m.nom_commercial !~* 'aciclovir|valaciclovir|zelitrex|zovirax'
  AND (pc.pathologie_id IS NULL
       OR pc.pathologie_id NOT IN (
         SELECT id FROM public.pathologies WHERE nom_pathologie ILIKE '%varicelle%' OR nom_pathologie ILIKE '%pied-main-bouche%' OR nom_pathologie ILIKE '%zona%'
       ));

-- 2.4 — Antibiotiques avec laxatif (les ATB provoquent des diarrhées,
--       pas de la constipation — c'est l'inverse qu'il faut)
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND pc.produit ~* '\m(macrogol|forlax|movicol|dulcolax|laxatif)\M'
  AND m.atc_code LIKE 'J01%';

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ PASSE 3 — Cross-sell de la même molécule (absurde)                    ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- 3.1 — Paracétamol → paracétamol
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'N02BE%'
  AND pc.produit ~* '\m(doliprane|efferalgan|dafalgan|paracetamol|paracétamol|paralyoc|geluprane)\M';

-- 3.2 — Ibuprofène → ibuprofène
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'M01AE%'
  AND pc.produit ~* '\m(ibuprof[èe]ne|nurofen|advil|spedifen|antarene|nureflex|upfen)\M';

-- 3.3 — Aspirine → aspirine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND (m.atc_code LIKE 'N02BA%' OR m.atc_code LIKE 'B01AC06%')
  AND pc.produit ~* '\m(aspirine|aspegic|kardegic|catalgine|resitune)\M';

-- 3.4 — Statine → statine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'C10AA%'
  AND pc.produit ~* '\m(statine|atorvastatine|rosuvastatine|simvastatine|pravastatine|fluvastatine|tahor|crestor|zocor)\M';

-- 3.5 — IPP → IPP
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'A02BC%'
  AND pc.produit ~* '\m(om[ée]prazole|pantoprazole|esom[ée]prazole|lansoprazole|rabeprazole|inexium|mopral|inipomp)\M';

-- 3.6 — Metformine → metformine
DELETE FROM public.produits_complementaires pc
USING public.medicaments m
WHERE pc.medicament_id = m.id
  AND m.atc_code LIKE 'A10BA%'
  AND pc.produit ~* '\m(metformine|glucophage|stagid)\M';

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ VÉRIFICATION post-migration                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- SELECT COUNT(*) FROM produits_complementaires WHERE phrase_conseil IS NULL;
--   → doit avoir augmenté de ~651
--
-- SELECT m.nom_commercial, pc.produit FROM produits_complementaires pc
-- JOIN medicaments m ON m.id = pc.medicament_id
-- WHERE m.nom_commercial ILIKE 'amoxicilline%' AND pc.produit ILIKE '%amoxicilline%';
--   → doit retourner 0 ligne (plus de cross-sell)
