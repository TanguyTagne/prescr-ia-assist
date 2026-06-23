import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Top 100 médicaments France 2024 (Observatoire du Médicament)
// Consolidés par entité clinique (princeps + génériques regroupés via matchNames)
type PC = { produit: string; categorie: string; type: "produit_conseil" | "complement" | "dispositif_medical"; description: string };
type Entry = {
  matchNames: string[];     // ILIKE patterns to find existing meds in DB
  canonicalName: string;    // Used if no match found (creates a new med)
  dosage?: string;
  forme: string;
  voie: string;             // orale, cutanée, nasale, inhalée, ophtalmique, etc.
  posologie: string;
  atc: string;
  molecule: string;
  classe: string;
  otc: boolean;
  pathologies: string[];    // nom_pathologie
  pcs: PC[];                // 3 PCs spécifiques
};

const TOP100: Entry[] = [
  // 1-2-8-14-17-43-44-46-58-64-69-73-80-122 — Paracétamol
  {
    matchNames: ["doliprane%", "dafalgan%", "efferalganmed%", "paracetamol biogaran%", "paracetamol viatris%", "paracétamol biogaran%"],
    canonicalName: "Doliprane 1000mg", dosage: "1000mg", forme: "Comprimé", voie: "orale",
    posologie: "1 cp toutes les 6h, max 3g/j (4g/j si >50kg). Espacer de 4h min.",
    atc: "N02BE01", molecule: "Paracétamol", classe: "Antalgiques antipyrétiques", otc: true,
    pathologies: ["Douleur modérée", "Fièvre", "Céphalée"],
    pcs: [
      { produit: "Magnésium marin B6", categorie: "Détente", type: "complement", description: "Réduit tension nerveuse pouvant aggraver céphalées" },
      { produit: "Thermomètre digital frontal", categorie: "Surveillance", type: "dispositif_medical", description: "Suivi précis de la fièvre" },
      { produit: "Tisane verveine-tilleul", categorie: "Confort", type: "produit_conseil", description: "Effet apaisant en cas de fièvre/céphalée" },
    ],
  },
  // 3-4-23-30-33-34-40-62-68-98-101-106-123 — Cholécalciférol (Vit D)
  {
    matchNames: ["cholecalciferol%", "cholécalciférol%", "zymad%", "uvedose%"],
    canonicalName: "Cholécalciférol 100 000 UI", dosage: "100 000 UI", forme: "Solution buvable", voie: "orale",
    posologie: "1 ampoule en prise unique, à renouveler selon avis médical (souvent /3 mois).",
    atc: "A11CC05", molecule: "Cholécalciférol", classe: "Vitamine D", otc: false,
    pathologies: ["Carence en vitamine D", "Ostéoporose"],
    pcs: [
      { produit: "Calcium + Vitamine K2", categorie: "Os & immunité", type: "complement", description: "Synergie pour fixation osseuse" },
      { produit: "Magnésium bisglycinate", categorie: "Cofacteur", type: "complement", description: "Cofacteur d'activation de la vitamine D" },
      { produit: "Oméga-3 EPA/DHA", categorie: "Anti-inflammatoire", type: "complement", description: "Synergie vitamine D liposoluble" },
    ],
  },
  // 5 — Hélicidine
  {
    matchNames: ["helicidine%", "hélicidine%"],
    canonicalName: "Helicidine sirop", dosage: "10%", forme: "Sirop", voie: "orale",
    posologie: "Adulte: 15 mL 3x/jour. Enfant: selon âge/poids. Cure 3 à 5 jours.",
    atc: "R05DB", molecule: "Hélicidine", classe: "Antitussif périphérique", otc: true,
    pathologies: ["Toux sèche"],
    pcs: [
      { produit: "Miel de thym bio", categorie: "Adoucissant gorge", type: "produit_conseil", description: "Apaise les voies respiratoires" },
      { produit: "Pastilles propolis-eucalyptus", categorie: "Gorge", type: "produit_conseil", description: "Calme l'irritation" },
      { produit: "Humidificateur d'air", categorie: "Confort", type: "dispositif_medical", description: "Réduit la toux d'irritation nocturne" },
    ],
  },
  // 6 — Ventoline
  {
    matchNames: ["ventoline%", "salbutamol%"],
    canonicalName: "Ventoline 100µg", dosage: "100µg/dose", forme: "Aérosol", voie: "inhalée",
    posologie: "1 à 2 bouffées en cas de crise, à renouveler si nécessaire (max 8/j).",
    atc: "R03AC02", molecule: "Salbutamol", classe: "Bronchodilatateurs β2-mimétiques", otc: false,
    pathologies: ["Asthme", "BPCO"],
    pcs: [
      { produit: "Chambre d'inhalation", categorie: "Dispositif", type: "dispositif_medical", description: "Améliore l'efficacité de l'aérosol (essentiel chez enfant)" },
      { produit: "Peak flow mètre", categorie: "Surveillance", type: "dispositif_medical", description: "Mesure du débit expiratoire de pointe" },
      { produit: "Spray nasal eau de mer", categorie: "Hygiène nasale", type: "dispositif_medical", description: "Hygiène voies respiratoires hautes" },
    ],
  },
  // 7-10-18-76-79-84-94-95-96-117-141-149 — Vaccins (groupés)
  {
    matchNames: ["influvac%", "vaxigriptetra%", "fluarixtetra%"],
    canonicalName: "VaxigripTetra", forme: "Suspension injectable", voie: "intramusculaire",
    posologie: "1 dose IM/sous-cutanée. Annuel en période grippale (octobre-décembre).",
    atc: "J07BB02", molecule: "Vaccin grippal tétravalent", classe: "Vaccins viraux", otc: false,
    pathologies: ["Prévention grippe"],
    pcs: [
      { produit: "Pansement post-injection", categorie: "Soin", type: "dispositif_medical", description: "Protection point d'injection" },
      { produit: "Vitamine C 1000mg", categorie: "Immunité", type: "complement", description: "Soutien immunitaire post-vaccin" },
      { produit: "Probiotiques immunité", categorie: "Microbiote", type: "complement", description: "Renforce réponse immunitaire muqueuse" },
    ],
  },
  // 9-13-86-110-130-131-153-159-160-167-168 — Amoxicilline / Augmentin
  {
    matchNames: ["amoxicilline%", "amoxicillin%"],
    canonicalName: "Amoxicilline 1g", dosage: "1g", forme: "Comprimé dispersible", voie: "orale",
    posologie: "1g matin et soir pendant 6 à 10 jours. À prendre pendant les repas.",
    atc: "J01CA04", molecule: "Amoxicilline", classe: "Pénicillines à large spectre", otc: false,
    pathologies: ["Angine bactérienne", "Infection urinaire", "Otite", "Sinusite"],
    pcs: [
      { produit: "Probiotiques Lactibiane ATB", categorie: "Flore intestinale", type: "complement", description: "Prévient diarrhée sous antibiotique" },
      { produit: "Ultra-levure 200mg", categorie: "Microbiote", type: "complement", description: "Saccharomyces boulardii anti-diarrhée" },
      { produit: "Vitamine C 500mg", categorie: "Immunité", type: "complement", description: "Soutient récupération immunitaire" },
    ],
  },
  // 11-45-129 — Spasfon (phloroglucinol)
  {
    matchNames: ["spasfon%", "phloroglucinol%"],
    canonicalName: "Spasfon", dosage: "80mg", forme: "Comprimé enrobé", voie: "orale",
    posologie: "2 cp 3x/jour, à prendre au moment des spasmes ou en prévention.",
    atc: "A03AX12", molecule: "Phloroglucinol", classe: "Antispasmodiques", otc: true,
    pathologies: ["Spasmes intestinaux", "Dysménorrhée", "Colique néphrétique"],
    pcs: [
      { produit: "Tisane fenouil-camomille", categorie: "Confort digestif", type: "produit_conseil", description: "Apaise les spasmes digestifs" },
      { produit: "Bouillotte abdominale", categorie: "Confort", type: "dispositif_medical", description: "Chaleur antispasmodique" },
      { produit: "Magnésium marin B6", categorie: "Détente musculaire", type: "complement", description: "Relaxe la musculature lisse" },
    ],
  },
  // 15-37-92 — AINS topiques (Flector, Ibufetum, Diclofénac gel)
  {
    matchNames: ["flector%", "ibufetum%", "diclofenac%", "diclofénac%"],
    canonicalName: "Flector 1%", dosage: "1%", forme: "Gel", voie: "cutanée",
    posologie: "Appliquer 2 à 4 fois par jour en massage doux sur zone douloureuse, 7 jours max.",
    atc: "M02AA15", molecule: "Diclofénac", classe: "AINS topique", otc: true,
    pathologies: ["Douleur articulaire", "Entorse", "Tendinite"],
    pcs: [
      { produit: "Patch chauffant ThermaCare", categorie: "Antalgique topique", type: "dispositif_medical", description: "Chaleur thérapeutique 8h" },
      { produit: "Bande de contention", categorie: "Maintien", type: "dispositif_medical", description: "Stabilise l'articulation" },
      { produit: "Arnica gel", categorie: "Hématome", type: "produit_conseil", description: "Réduit ecchymoses associées" },
    ],
  },
  // 16-55 — Bétaméthasone (corticoïde)
  {
    matchNames: ["betamethasone%", "bétaméthasone%", "diprostene%", "diprostène%"],
    canonicalName: "Bétaméthasone 0,05%", dosage: "0,05%", forme: "Crème", voie: "cutanée",
    posologie: "1 application/jour sur lésion, 7 à 14 jours max. Éviter visage.",
    atc: "D07AC01", molecule: "Bétaméthasone", classe: "Corticoïdes topiques", otc: false,
    pathologies: ["Eczéma", "Dermatite", "Psoriasis"],
    pcs: [
      { produit: "Émollient Dexeryl/Avène", categorie: "Hydratation", type: "produit_conseil", description: "Restaure barrière cutanée entre applications" },
      { produit: "Savon surgras pH neutre", categorie: "Hygiène", type: "produit_conseil", description: "Évite l'irritation supplémentaire" },
      { produit: "Oméga-3 EPA/DHA", categorie: "Nutrition cutanée", type: "complement", description: "Soutient barrière lipidique" },
    ],
  },
  // 19-21-57-103 — Prednisolone
  {
    matchNames: ["prednisolone%", "solupred%"],
    canonicalName: "Prednisolone 20mg", dosage: "20mg", forme: "Comprimé orodispersible", voie: "orale",
    posologie: "Dose adaptée selon pathologie (souvent 0,5-1 mg/kg/j). À prendre le matin.",
    atc: "H02AB06", molecule: "Prednisolone", classe: "Corticoïdes systémiques", otc: false,
    pathologies: ["Inflammation", "Allergie saisonnière", "Asthme"],
    pcs: [
      { produit: "Calcium + Vitamine D3", categorie: "Os", type: "complement", description: "Prévient perte osseuse cortico-induite" },
      { produit: "Probiotiques Lactibiane", categorie: "Microbiote", type: "complement", description: "Soutient flore sous corticothérapie" },
      { produit: "Eau hydrogéno-sodée pauvre en sodium", categorie: "Régime", type: "produit_conseil", description: "Réduit rétention hydrosodée" },
    ],
  },
  // 20-24-49-52-58-72-156 — Antiseptiques (Chlorhexidine, Bétadine, Biseptine, Dakin, Eludril, Paroex)
  {
    matchNames: ["chlorhexidine%", "betadine%", "bétadine%", "biseptine%", "dakin%", "eludril%", "paroex%"],
    canonicalName: "Bétadine dermique 10%", dosage: "10%", forme: "Solution", voie: "cutanée",
    posologie: "Appliquer pur ou dilué sur plaie nettoyée, 1 à 2 fois par jour.",
    atc: "D08AG02", molecule: "Povidone iodée / Chlorhexidine", classe: "Antiseptiques", otc: true,
    pathologies: ["Plaie superficielle", "Désinfection"],
    pcs: [
      { produit: "Compresses stériles", categorie: "Pansement", type: "dispositif_medical", description: "Application propre sans contamination" },
      { produit: "Pansements hydrocolloïdes", categorie: "Cicatrisation", type: "dispositif_medical", description: "Favorise cicatrisation milieu humide" },
      { produit: "Sérum physiologique", categorie: "Lavage", type: "dispositif_medical", description: "Rinçage avant antiseptique" },
    ],
  },
  // 22-26-48-71-77-82-89-120-155 — Corticoïdes nasaux (Pivalone, Tixocortol, Rhinomaxil, Dymista, Rinoclenil, Mométasone)
  {
    matchNames: ["pivalone%", "tixocortol%", "rhinomaxil%", "dymista%", "rinoclenil%", "mometasone%", "mométasone%"],
    canonicalName: "Pivalone 1%", dosage: "1%", forme: "Suspension nasale", voie: "nasale",
    posologie: "1 pulvérisation dans chaque narine 2 à 3 fois par jour, 7 jours max.",
    atc: "R01AD07", molecule: "Tixocortol / Mométasone", classe: "Corticoïdes nasaux", otc: false,
    pathologies: ["Rhinite aiguë", "Allergie saisonnière", "Sinusite"],
    pcs: [
      { produit: "Spray nasal eau de mer hypertonique", categorie: "Lavage nasal", type: "dispositif_medical", description: "Décongestion mécanique avant corticoïde" },
      { produit: "Mouchoirs doux à l'aloe vera", categorie: "Confort", type: "produit_conseil", description: "Évite irritation du nez" },
      { produit: "Inhalateur aux huiles essentielles", categorie: "Décongestion", type: "produit_conseil", description: "Eucalyptus et menthe" },
    ],
  },
  // 25 — Kardégic (aspirine cardio)
  {
    matchNames: ["kardegic%", "kardégic%", "resitune%"],
    canonicalName: "Kardégic 75mg", dosage: "75mg", forme: "Poudre buvable", voie: "orale",
    posologie: "1 sachet/jour le matin, dans un verre d'eau. Traitement au long cours.",
    atc: "B01AC06", molecule: "Acide acétylsalicylique", classe: "Antiagrégants plaquettaires", otc: false,
    pathologies: ["Prévention cardiovasculaire", "Post-AVC", "Post-infarctus"],
    pcs: [
      { produit: "Oméga-3 EPA/DHA haute concentration", categorie: "Cardio", type: "complement", description: "Synergie cardio-protectrice" },
      { produit: "Coenzyme Q10 100mg", categorie: "Cardio", type: "complement", description: "Soutien énergétique myocardique" },
      { produit: "Tensiomètre brassard", categorie: "Surveillance", type: "dispositif_medical", description: "Auto-mesure tensionnelle" },
    ],
  },
  // 28-144 — Paracétamol/Codéine (Izalgi, Dafalgan codéine, Lamaline, Paracétamol/Codéine Viatris)
  {
    matchNames: ["izalgi%", "lamaline%", "dafalgan codeine%", "dafalgan codéine%", "paracetamol/codeine%", "paracétamol/codéine%"],
    canonicalName: "Lamaline", forme: "Gélule", voie: "orale",
    posologie: "1 à 2 gélules toutes les 4 à 6h, max 8/j. Pas plus de 3 jours sans avis.",
    atc: "N02AJ06", molecule: "Paracétamol + Codéine", classe: "Antalgiques palier 2", otc: false,
    pathologies: ["Douleur modérée à sévère", "Lombalgie"],
    pcs: [
      { produit: "Laxatif doux (lactulose)", categorie: "Transit", type: "produit_conseil", description: "Prévient constipation aux opioïdes" },
      { produit: "Tisane verveine-fenouil", categorie: "Confort digestif", type: "produit_conseil", description: "Stimule transit ralenti" },
      { produit: "Magnésium marin B6", categorie: "Détente", type: "complement", description: "Détend musculature douloureuse" },
    ],
  },
  // 29-56-111-132 — Desloratadine
  {
    matchNames: ["desloratadine%", "déloratadine%"],
    canonicalName: "Desloratadine 5mg", dosage: "5mg", forme: "Comprimé", voie: "orale",
    posologie: "1 cp/jour, indifféremment au cours ou hors repas.",
    atc: "R06AX27", molecule: "Desloratadine", classe: "Antihistaminiques H1 non sédatifs", otc: false,
    pathologies: ["Allergie saisonnière", "Urticaire", "Rhinite allergique"],
    pcs: [
      { produit: "Spray nasal eau de mer isotonique", categorie: "Hygiène nasale", type: "dispositif_medical", description: "Élimine allergènes des muqueuses" },
      { produit: "Quercétine 500mg", categorie: "Anti-allergique naturel", type: "complement", description: "Inhibe libération histamine" },
      { produit: "Collyre antiallergique", categorie: "Ophtalmique", type: "produit_conseil", description: "Soulage conjonctivite allergique" },
    ],
  },
  // 32-35 — Kétoprofène LP
  {
    matchNames: ["ketoprofene%", "kétoprofène%", "profenid%"],
    canonicalName: "Kétoprofène LP 100mg", dosage: "100mg LP", forme: "Comprimé LP", voie: "orale",
    posologie: "1 cp matin et soir au milieu d'un repas, durée la plus courte possible.",
    atc: "M01AE03", molecule: "Kétoprofène", classe: "AINS systémiques", otc: false,
    pathologies: ["Douleur articulaire", "Lombalgie", "Inflammation"],
    pcs: [
      { produit: "IPP (oméprazole 20mg)", categorie: "Protection gastrique", type: "produit_conseil", description: "Prévient ulcère AINS" },
      { produit: "Glucosamine + Chondroïtine", categorie: "Articulation", type: "complement", description: "Soutien cartilage long terme" },
      { produit: "Curcuma + Poivre noir", categorie: "Anti-inflammatoire naturel", type: "complement", description: "Effet anti-inflammatoire synergique" },
    ],
  },
  // 36-39-50-125-135-136 — IPP (Oméprazole, Esoméprazole, Pantoprazole)
  {
    matchNames: ["omeprazole%", "oméprazole%", "esomeprazole%", "ésoméprazole%", "pantoprazole%", "inexium%", "mopral%"],
    canonicalName: "Oméprazole 20mg", dosage: "20mg", forme: "Gélule gastro-résistante", voie: "orale",
    posologie: "1 gélule/jour le matin à jeun, 30 min avant le repas. 4 à 8 semaines.",
    atc: "A02BC01", molecule: "Oméprazole", classe: "Inhibiteurs de la pompe à protons", otc: false,
    pathologies: ["Reflux gastro-œsophagien", "Ulcère gastrique", "Brûlures d'estomac"],
    pcs: [
      { produit: "Vitamine B12 sublinguale", categorie: "Carence IPP", type: "complement", description: "Compense malabsorption B12 sous IPP" },
      { produit: "Magnésium bisglycinate", categorie: "Carence IPP", type: "complement", description: "Compense déperdition magnésium" },
      { produit: "Tisane mauve-réglisse", categorie: "Confort digestif", type: "produit_conseil", description: "Apaise muqueuse œsophagienne" },
    ],
  },
  // 38 — Pyostacine
  {
    matchNames: ["pyostacine%", "pristinamycine%"],
    canonicalName: "Pyostacine 500mg", dosage: "500mg", forme: "Comprimé", voie: "orale",
    posologie: "2 à 3g/j en 2 ou 3 prises au milieu des repas. 7 à 14 jours.",
    atc: "J01FG01", molecule: "Pristinamycine", classe: "Synergistines (antibiotique)", otc: false,
    pathologies: ["Infection cutanée", "Infection ORL", "Allergie pénicilline"],
    pcs: [
      { produit: "Probiotiques Lactibiane ATB", categorie: "Flore", type: "complement", description: "Prévient diarrhée antibiotique" },
      { produit: "Antiseptique cutané chlorhexidine", categorie: "Local", type: "produit_conseil", description: "Soin local en complément" },
      { produit: "Vitamine C 500mg", categorie: "Immunité", type: "complement", description: "Soutien récupération" },
    ],
  },
  // 42 — Diosmectite (Smecta)
  {
    matchNames: ["diosmectite%", "smecta%"],
    canonicalName: "Diosmectite 3g", dosage: "3g", forme: "Poudre suspension buvable", voie: "orale",
    posologie: "3 sachets/jour les 3 premiers jours, puis 1 à 2/j. Loin des autres médicaments.",
    atc: "A07BC05", molecule: "Diosmectite", classe: "Antidiarrhéique adsorbant", otc: true,
    pathologies: ["Diarrhée aiguë", "Gastro-entérite"],
    pcs: [
      { produit: "Soluté de réhydratation orale", categorie: "Réhydratation", type: "produit_conseil", description: "Compense pertes hydroélectrolytiques" },
      { produit: "Probiotiques Saccharomyces boulardii", categorie: "Microbiote", type: "complement", description: "Restaure flore intestinale" },
      { produit: "Tisane myrtille-cannelle", categorie: "Confort", type: "produit_conseil", description: "Effet astringent doux" },
    ],
  },
  // 54 — Optimizette (désogestrel pilule)
  {
    matchNames: ["optimizette%", "désogestrel%", "desogestrel%", "cerazette%"],
    canonicalName: "Optimizette 75µg", dosage: "75µg", forme: "Comprimé", voie: "orale",
    posologie: "1 cp/jour à la même heure, en continu sans interruption.",
    atc: "G03AC09", molecule: "Désogestrel", classe: "Contraceptif progestatif", otc: false,
    pathologies: ["Contraception"],
    pcs: [
      { produit: "Test de grossesse", categorie: "Suivi", type: "dispositif_medical", description: "À disposer en cas d'oubli" },
      { produit: "Vitamine B9 (folates)", categorie: "Réserve", type: "complement", description: "Réserves utiles si arrêt pilule" },
      { produit: "Application rappel pilule", categorie: "Observance", type: "produit_conseil", description: "Évite les oublis" },
    ],
  },
  // 51-102 — Glycérol/Vaseline/Paraffine (Dexeryl)
  {
    matchNames: ["glycerol%", "glycérol%", "dexeryl%"],
    canonicalName: "Glycérol/Vaseline/Paraffine 15%/8%/2%", forme: "Crème", voie: "cutanée",
    posologie: "1 à 2 applications/jour sur peau sèche, après la toilette.",
    atc: "D02AC", molecule: "Glycérol+Vaseline+Paraffine", classe: "Émollients", otc: true,
    pathologies: ["Sécheresse cutanée", "Eczéma"],
    pcs: [
      { produit: "Crème émolliente Avène XeraCalm", categorie: "Hydratation", type: "produit_conseil", description: "Hydratation intense peaux très sèches" },
      { produit: "Huile d'amande douce", categorie: "Soin corporel", type: "produit_conseil", description: "Nourrit et protège" },
      { produit: "Oméga-3 EPA/DHA", categorie: "Nutrition cutanée", type: "complement", description: "Soutient barrière lipidique" },
    ],
  },
  // 53-61-83-116 — Ibuprofène / Spifen / Naproxène
  {
    matchNames: ["ibuprofene%", "ibuprofène%", "spifen%", "naproxene%", "naproxène%", "advil%", "nurofen%"],
    canonicalName: "Ibuprofène 400mg", dosage: "400mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp toutes les 6h, max 1200mg/j en automédication. À prendre pendant les repas.",
    atc: "M01AE01", molecule: "Ibuprofène", classe: "AINS systémiques", otc: true,
    pathologies: ["Douleur modérée", "Fièvre", "Dysménorrhée"],
    pcs: [
      { produit: "Pansement gastrique (alginate)", categorie: "Protection digestive", type: "produit_conseil", description: "Limite épigastralgie" },
      { produit: "Tisane reine-des-prés", categorie: "Anti-inflammatoire naturel", type: "produit_conseil", description: "Salicylates naturels" },
      { produit: "Bouillotte abdominale", categorie: "Confort", type: "dispositif_medical", description: "Soulage dysménorrhée" },
    ],
  },
  // 59-91 — Métopimazine (Vogalène)
  {
    matchNames: ["metopimazine%", "métopimazine%", "vogalene%", "vogalène%"],
    canonicalName: "Métopimazine 7,5mg", dosage: "7,5mg", forme: "Comprimé orodispersible", voie: "orale",
    posologie: "1 cp 3 à 4 fois/jour. Max 5 jours sans avis médical.",
    atc: "A04AD05", molecule: "Métopimazine", classe: "Antiémétiques", otc: true,
    pathologies: ["Nausées", "Vomissements"],
    pcs: [
      { produit: "Soluté de réhydratation orale", categorie: "Réhydratation", type: "produit_conseil", description: "Compense pertes" },
      { produit: "Gingembre en gélules", categorie: "Antiémétique naturel", type: "complement", description: "Réduit nausées naturellement" },
      { produit: "Bracelet anti-nausée", categorie: "Acupression", type: "dispositif_medical", description: "Acupression P6" },
    ],
  },
  // 60 — Tardyferon (fer)
  {
    matchNames: ["tardyferon%", "tardyféron%", "fer%", "sulfate de fer%"],
    canonicalName: "Tardyferon 80mg", dosage: "80mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp/jour à jeun (le matin), 30 min avant le repas. Cure 1 à 3 mois.",
    atc: "B03AA07", molecule: "Sulfate ferreux", classe: "Antianémique martial", otc: false,
    pathologies: ["Anémie ferriprive", "Carence en fer"],
    pcs: [
      { produit: "Vitamine C 500mg", categorie: "Absorption fer", type: "complement", description: "Améliore absorption du fer" },
      { produit: "Complexe vitamines B (B9, B12)", categorie: "Anémie", type: "complement", description: "Synergie hématopoïétique" },
      { produit: "Probiotiques", categorie: "Tolérance digestive", type: "complement", description: "Réduit constipation du fer" },
    ],
  },
  // 63-74 — Gaviscon
  {
    matchNames: ["gaviscon%", "gavisconell%", "alginate de sodium%"],
    canonicalName: "Gaviscon", forme: "Suspension buvable", voie: "orale",
    posologie: "10 à 20 mL après les repas et au coucher. Max 4 prises/jour.",
    atc: "A02BX13", molecule: "Alginate de sodium + Bicarbonate", classe: "Antiacides protecteurs muqueux", otc: true,
    pathologies: ["Reflux gastro-œsophagien", "Brûlures d'estomac"],
    pcs: [
      { produit: "Coussin anti-reflux nuit", categorie: "Position", type: "dispositif_medical", description: "Surélève tête de lit" },
      { produit: "Tisane mauve-réglisse", categorie: "Confort", type: "produit_conseil", description: "Apaise muqueuse œsophagienne" },
      { produit: "Aloe vera buvable", categorie: "Naturel", type: "complement", description: "Effet protecteur muqueux" },
    ],
  },
  // 65 — Azyter (azithromycine collyre)
  {
    matchNames: ["azyter%"],
    canonicalName: "Azyter 15mg/g", dosage: "15mg/g", forme: "Collyre", voie: "ophtalmique",
    posologie: "1 goutte dans chaque œil matin et soir, pendant 3 jours.",
    atc: "S01AA26", molecule: "Azithromycine", classe: "Antibiotique ophtalmique", otc: false,
    pathologies: ["Conjonctivite bactérienne"],
    pcs: [
      { produit: "Sérum physiologique unidoses", categorie: "Lavage oculaire", type: "dispositif_medical", description: "Hygiène avant instillation" },
      { produit: "Compresses ophtalmiques stériles", categorie: "Soin", type: "dispositif_medical", description: "Essuyage propre" },
      { produit: "Larmes artificielles sans conservateur", categorie: "Confort", type: "dispositif_medical", description: "Apaise irritation" },
    ],
  },
  // 66-109-139 — Dextrométhorphane (Tussidane)
  {
    matchNames: ["dextromethorphane%", "dextrométhorphane%", "tussidane%"],
    canonicalName: "Dextrométhorphane 1,5mg/mL", dosage: "1,5mg/mL", forme: "Solution buvable", voie: "orale",
    posologie: "Adulte: 15 mL 3 à 4x/j. Max 5 jours.",
    atc: "R05DA09", molecule: "Dextrométhorphane", classe: "Antitussif central", otc: true,
    pathologies: ["Toux sèche"],
    pcs: [
      { produit: "Miel de thym bio", categorie: "Gorge", type: "produit_conseil", description: "Apaise voies respiratoires" },
      { produit: "Pastilles propolis", categorie: "Gorge", type: "produit_conseil", description: "Antiseptique naturel" },
      { produit: "Humidificateur d'air", categorie: "Confort", type: "dispositif_medical", description: "Réduit irritation nocturne" },
    ],
  },
  // 67-118 — Lidocaïne/Prilocaïne (Emla patch)
  {
    matchNames: ["lidocaine/prilocaine%", "lidocaïne/prilocaïne%", "emla%"],
    canonicalName: "Lidocaïne/Prilocaïne 5%", dosage: "5%", forme: "Pansement adhésif", voie: "cutanée",
    posologie: "Appliquer 1h avant l'acte douloureux. Retirer juste avant.",
    atc: "N01BB20", molecule: "Lidocaïne + Prilocaïne", classe: "Anesthésiques locaux", otc: true,
    pathologies: ["Anesthésie cutanée", "Préparation injection"],
    pcs: [
      { produit: "Pansement post-injection", categorie: "Soin", type: "dispositif_medical", description: "Protection point ponction" },
      { produit: "Crème cicatrisante", categorie: "Soin", type: "produit_conseil", description: "Cicatrisation rapide" },
      { produit: "Désinfectant alcoolique", categorie: "Hygiène", type: "produit_conseil", description: "Désinfecte avant acte" },
    ],
  },
  // 70-127 — Corticoïdes oculaires/cutanés moyens (Sterdex, Locoid)
  {
    matchNames: ["sterdex%", "locoid%", "hydrocortisone%"],
    canonicalName: "Hydrocortisone 1%", dosage: "0,1-1%", forme: "Crème/Pommade", voie: "cutanée",
    posologie: "1 à 2 applications/jour en couche fine, 7 jours max.",
    atc: "D07AA02", molecule: "Hydrocortisone", classe: "Corticoïdes d'activité faible", otc: false,
    pathologies: ["Eczéma léger", "Dermatite", "Piqûre d'insecte"],
    pcs: [
      { produit: "Émollient quotidien", categorie: "Hydratation", type: "produit_conseil", description: "Entretient barrière cutanée" },
      { produit: "Gel d'aloe vera", categorie: "Apaisant", type: "produit_conseil", description: "Calme l'inflammation entre applications" },
      { produit: "Savon surgras", categorie: "Hygiène", type: "produit_conseil", description: "Évite irritation" },
    ],
  },
  // 75 — Lovenox (énoxaparine)
  {
    matchNames: ["lovenox%", "enoxaparine%", "énoxaparine%"],
    canonicalName: "Lovenox 4000 UI/0,4mL", dosage: "4000 UI", forme: "Solution injectable", voie: "sous-cutanée",
    posologie: "1 injection SC/jour à heure fixe, dans le pli abdominal. Durée selon indication.",
    atc: "B01AB05", molecule: "Énoxaparine", classe: "Héparines de bas poids moléculaire", otc: false,
    pathologies: ["Prévention thrombose veineuse", "Embolie pulmonaire"],
    pcs: [
      { produit: "Container DASRI", categorie: "Élimination", type: "dispositif_medical", description: "Recyclage des aiguilles" },
      { produit: "Bas de contention classe 2", categorie: "Veineux", type: "dispositif_medical", description: "Synergie anti-stase" },
      { produit: "Coussinet refroidissant", categorie: "Confort injection", type: "dispositif_medical", description: "Réduit douleur injection" },
    ],
  },
  // 78 — Météospasmyl (alvérine+siméticone)
  {
    matchNames: ["meteospasmyl%", "météospasmyl%", "alverine%", "alvérine%"],
    canonicalName: "Météospasmyl", forme: "Capsule molle", voie: "orale",
    posologie: "1 capsule 2 à 3x/jour avant les repas.",
    atc: "A03AX58", molecule: "Alvérine + Siméticone", classe: "Antispasmodique + antigaz", otc: true,
    pathologies: ["Ballonnements", "Spasmes intestinaux", "Côlon irritable"],
    pcs: [
      { produit: "Probiotiques Lactibiane", categorie: "Microbiote", type: "complement", description: "Rééquilibre flore" },
      { produit: "Charbon végétal activé", categorie: "Antigaz", type: "complement", description: "Adsorbe gaz intestinaux" },
      { produit: "Tisane fenouil-anis-cumin", categorie: "Confort digestif", type: "produit_conseil", description: "Réduit ballonnements" },
    ],
  },
  // 81 — Antadys (flurbiprofène)
  {
    matchNames: ["antadys%", "flurbiprofene%", "flurbiprofène%"],
    canonicalName: "Antadys 100mg", dosage: "100mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp toutes les 6 à 8h dès les premières règles, max 3 jours.",
    atc: "M01AE09", molecule: "Flurbiprofène", classe: "AINS - dysménorrhée", otc: false,
    pathologies: ["Dysménorrhée"],
    pcs: [
      { produit: "Bouillotte abdominale", categorie: "Confort", type: "dispositif_medical", description: "Chaleur antispasmodique" },
      { produit: "Magnésium bisglycinate + B6", categorie: "Détente", type: "complement", description: "Réduit crampes menstruelles" },
      { produit: "Tisane achillée millefeuille", categorie: "Confort féminin", type: "produit_conseil", description: "Apaise spasmes utérins" },
    ],
  },
  // 90 — Eliquis (apixaban)
  {
    matchNames: ["eliquis%", "apixaban%"],
    canonicalName: "Eliquis 5mg", dosage: "5mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp matin et soir, à heure fixe. Au long cours.",
    atc: "B01AF02", molecule: "Apixaban", classe: "Anticoagulants oraux directs (AOD)", otc: false,
    pathologies: ["Fibrillation auriculaire", "Prévention thrombose"],
    pcs: [
      { produit: "Pilulier hebdomadaire", categorie: "Observance", type: "dispositif_medical", description: "Évite oublis dangereux" },
      { produit: "Carte porteur AOD", categorie: "Sécurité", type: "produit_conseil", description: "Information aux soignants" },
      { produit: "Tensiomètre", categorie: "Surveillance", type: "dispositif_medical", description: "Suivi cardiovasculaire" },
    ],
  },
  // 97-163 — Racécadotril (Tiorfan)
  {
    matchNames: ["racecadotril%", "racécadotril%", "tiorfan%"],
    canonicalName: "Racécadotril 100mg", dosage: "100mg", forme: "Gélule", voie: "orale",
    posologie: "1 gélule 3x/jour avant les repas. Max 7 jours.",
    atc: "A07XA04", molecule: "Racécadotril", classe: "Antidiarrhéique antisécrétoire", otc: true,
    pathologies: ["Diarrhée aiguë"],
    pcs: [
      { produit: "Soluté de réhydratation orale", categorie: "Réhydratation", type: "produit_conseil", description: "Compense pertes" },
      { produit: "Probiotiques Lactibiane", categorie: "Microbiote", type: "complement", description: "Restaure flore" },
      { produit: "Eau de riz cuite", categorie: "Régime", type: "produit_conseil", description: "Apport hydrique digestible" },
    ],
  },
  // 100-115-138 — Macrogol (Forlax / Movicol)
  {
    matchNames: ["macrogol%", "forlax%", "movicol%"],
    canonicalName: "Macrogol 4000 10g", dosage: "10g", forme: "Poudre buvable", voie: "orale",
    posologie: "1 à 2 sachets/jour, à diluer dans un grand verre d'eau.",
    atc: "A06AD15", molecule: "Macrogol 4000", classe: "Laxatif osmotique", otc: true,
    pathologies: ["Constipation"],
    pcs: [
      { produit: "Pruneaux séchés bio", categorie: "Fibres", type: "produit_conseil", description: "Fibres naturelles douces" },
      { produit: "Psyllium blond", categorie: "Fibres", type: "complement", description: "Régule transit en douceur" },
      { produit: "Probiotiques Lactibiane", categorie: "Microbiote", type: "complement", description: "Soutient régularité du transit" },
    ],
  },
  // 104 — Tridésonit (désonide)
  {
    matchNames: ["tridesonit%", "tridésonit%", "desonide%", "désonide%"],
    canonicalName: "Tridésonit 0,05%", dosage: "0,05%", forme: "Crème", voie: "cutanée",
    posologie: "1 application/jour le soir, 7 à 14 jours max. Adapté visage/enfant.",
    atc: "D07AB08", molecule: "Désonide", classe: "Corticoïdes d'activité modérée", otc: false,
    pathologies: ["Eczéma", "Dermatite"],
    pcs: [
      { produit: "Émollient Avène Tolérance", categorie: "Hydratation", type: "produit_conseil", description: "Visage et peaux sensibles" },
      { produit: "Eau thermale en spray", categorie: "Apaisant", type: "produit_conseil", description: "Calme l'inflammation" },
      { produit: "Probiotiques cutanés", categorie: "Microbiote", type: "complement", description: "Restaure microbiome cutané" },
    ],
  },
  // 105 — Azithromycine orale
  {
    matchNames: ["azithromycine bgr%", "azithromycine biogaran%", "azithromycine viatris%", "zithromax%"],
    canonicalName: "Azithromycine 250mg", dosage: "250mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "500 mg/j en 1 prise pendant 3 jours, à distance des repas.",
    atc: "J01FA10", molecule: "Azithromycine", classe: "Macrolides", otc: false,
    pathologies: ["Infection ORL", "Bronchite", "IST chlamydia"],
    pcs: [
      { produit: "Probiotiques Lactibiane ATB", categorie: "Flore", type: "complement", description: "Prévient diarrhée antibiotique" },
      { produit: "Vitamine C 500mg", categorie: "Immunité", type: "complement", description: "Soutien récupération" },
      { produit: "Tisane thym-romarin", categorie: "Respiratoire", type: "produit_conseil", description: "Complément antiseptique" },
    ],
  },
  // 107 — Normacol lavement
  {
    matchNames: ["normacol%"],
    canonicalName: "Normacol lavement adultes", forme: "Lavement", voie: "rectale",
    posologie: "1 lavement par voie rectale, action en 5 à 20 min. Usage ponctuel.",
    atc: "A06AG11", molecule: "Phosphate sodique", classe: "Laxatif par voie rectale", otc: true,
    pathologies: ["Constipation rapide", "Préparation examen"],
    pcs: [
      { produit: "Suppositoires Eductyl", categorie: "Alternative", type: "produit_conseil", description: "Stimulation gaz CO2" },
      { produit: "Psyllium blond", categorie: "Fond", type: "complement", description: "Régule transit au long cours" },
      { produit: "Pruneaux bio", categorie: "Fibres", type: "produit_conseil", description: "Effet laxatif doux quotidien" },
    ],
  },
  // 108 — Permixon (sérénoa)
  {
    matchNames: ["permixon%", "serenoa%", "sérénoa%"],
    canonicalName: "Permixon 160mg", dosage: "160mg", forme: "Gélule", voie: "orale",
    posologie: "1 gélule matin et soir au cours des repas. Cure 3 à 6 mois.",
    atc: "G04CX02", molecule: "Sérénoa repens", classe: "Phytothérapie urologique", otc: false,
    pathologies: ["Hypertrophie bénigne prostate"],
    pcs: [
      { produit: "Zinc + Sélénium", categorie: "Prostate", type: "complement", description: "Cofacteurs nutritionnels prostatiques" },
      { produit: "Pollen de seigle", categorie: "Phytothérapie", type: "complement", description: "Synergie sur troubles mictionnels" },
      { produit: "Application suivi mictions", categorie: "Suivi", type: "produit_conseil", description: "Mesure fréquence/volume" },
    ],
  },
  // 112-134 — Alprazolam (Xanax)
  {
    matchNames: ["alprazolam%", "xanax%"],
    canonicalName: "Alprazolam 0,25mg", dosage: "0,25mg", forme: "Comprimé sécable", voie: "orale",
    posologie: "0,25 à 0,5mg 3x/jour. Durée la plus courte (8 à 12 semaines max).",
    atc: "N05BA12", molecule: "Alprazolam", classe: "Benzodiazépines anxiolytiques", otc: false,
    pathologies: ["Anxiété", "Trouble panique"],
    pcs: [
      { produit: "Magnésium bisglycinate", categorie: "Détente nerveuse", type: "complement", description: "Soutien système nerveux" },
      { produit: "Tisane passiflore-valériane", categorie: "Sommeil", type: "produit_conseil", description: "Synergie naturelle relaxante" },
      { produit: "Cohérence cardiaque (app)", categorie: "Bien-être", type: "produit_conseil", description: "Réduit stress quotidien" },
    ],
  },
  // 113-154-166 — Acide folique
  {
    matchNames: ["acide folique%", "vitamine b9%"],
    canonicalName: "Acide folique 5mg", dosage: "5mg", forme: "Comprimé", voie: "orale",
    posologie: "1 cp/jour. Préconception et 1er trimestre grossesse à 0,4mg, 5mg si à risque.",
    atc: "B03BB01", molecule: "Acide folique", classe: "Vitamine B9", otc: true,
    pathologies: ["Carence vitamine B9", "Préconception"],
    pcs: [
      { produit: "Complexe vitamines B (B6, B12)", categorie: "Synergie", type: "complement", description: "Synergie hématopoïétique" },
      { produit: "Fer + Vitamine C", categorie: "Anémie", type: "complement", description: "Souvent associé en carences" },
      { produit: "Multivitamines grossesse", categorie: "Préconception", type: "complement", description: "Couverture nutritionnelle femme enceinte" },
    ],
  },
  // 114 — Forxiga (dapagliflozine)
  {
    matchNames: ["forxiga%", "dapagliflozine%"],
    canonicalName: "Forxiga 10mg", dosage: "10mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp/jour, indifféremment au cours ou hors repas.",
    atc: "A10BK01", molecule: "Dapagliflozine", classe: "Inhibiteurs SGLT2", otc: false,
    pathologies: ["Diabète type 2", "Insuffisance cardiaque"],
    pcs: [
      { produit: "Lecteur glycémie capillaire", categorie: "Surveillance", type: "dispositif_medical", description: "Suivi du diabète" },
      { produit: "Probiotique urinaire", categorie: "Prévention IU", type: "complement", description: "Réduit risque infection urinaire" },
      { produit: "Berlingot eau gel intime", categorie: "Hygiène", type: "produit_conseil", description: "Limite mycoses génitales" },
    ],
  },
  // 119-151 — Fosfomycine (Monuril)
  {
    matchNames: ["fosfomycine%", "monuril%"],
    canonicalName: "Fosfomycine 3g", dosage: "3g", forme: "Granulés solution buvable", voie: "orale",
    posologie: "1 sachet en prise unique, le soir au coucher, vessie vide.",
    atc: "J01XX01", molecule: "Fosfomycine trométamol", classe: "Antibiotique - infection urinaire", otc: false,
    pathologies: ["Infection urinaire basse"],
    pcs: [
      { produit: "Cranberry / canneberge 36mg PAC", categorie: "Prévention IU", type: "complement", description: "Anti-adhésion E. coli" },
      { produit: "D-mannose 2g", categorie: "Prévention IU", type: "complement", description: "Empêche fixation bactérienne" },
      { produit: "Probiotiques uro-vaginaux", categorie: "Microbiote", type: "complement", description: "Restaure flore protectrice" },
    ],
  },
  // 121-148-158-169 — Lévothyrox
  {
    matchNames: ["levothyrox%", "lévothyrox%", "levothyroxine%", "lévothyroxine%"],
    canonicalName: "Lévothyrox 75µg", dosage: "75µg", forme: "Comprimé sécable", voie: "orale",
    posologie: "1 cp/jour à jeun, 30 min avant petit-déjeuner. Dose adaptée par TSH.",
    atc: "H03AA01", molecule: "Lévothyroxine", classe: "Hormones thyroïdiennes", otc: false,
    pathologies: ["Hypothyroïdie"],
    pcs: [
      { produit: "Pilulier matin/soir", categorie: "Observance", type: "dispositif_medical", description: "Suivi prise à jeun" },
      { produit: "Sélénium 100µg", categorie: "Thyroïde", type: "complement", description: "Cofacteur conversion T4→T3" },
      { produit: "Carnet de suivi TSH", categorie: "Suivi", type: "produit_conseil", description: "Trace les évolutions" },
    ],
  },
  // 124 — Mydriaticum (tropicamide)
  {
    matchNames: ["mydriaticum%", "tropicamide%"],
    canonicalName: "Mydriaticum 2mg/0,4mL", forme: "Collyre", voie: "ophtalmique",
    posologie: "1 goutte 15 à 30 min avant fond d'œil. Usage médical ponctuel.",
    atc: "S01FA06", molecule: "Tropicamide", classe: "Mydriatique diagnostique", otc: false,
    pathologies: ["Examen fond d'œil"],
    pcs: [
      { produit: "Lunettes solaires polarisées", categorie: "Protection", type: "produit_conseil", description: "Sensibilité lumineuse post-examen" },
      { produit: "Larmes artificielles", categorie: "Confort", type: "dispositif_medical", description: "Hydratation post-dilatation" },
      { produit: "Compresses ophtalmiques", categorie: "Soin", type: "dispositif_medical", description: "Essuyage propre" },
    ],
  },
  // 126 — Diffu-K (potassium)
  {
    matchNames: ["diffu-k%", "potassium%", "chlorure de potassium%"],
    canonicalName: "Diffu-K 600mg", dosage: "600mg", forme: "Gélule", voie: "orale",
    posologie: "2 à 4 gélules/jour au cours des repas, avec un grand verre d'eau.",
    atc: "A12BA01", molecule: "Chlorure de potassium", classe: "Suppléments potassiques", otc: false,
    pathologies: ["Hypokaliémie"],
    pcs: [
      { produit: "Magnésium bisglycinate", categorie: "Électrolytes", type: "complement", description: "Synergie K+/Mg+ cardiaque" },
      { produit: "Eau riche en bicarbonates", categorie: "Régime", type: "produit_conseil", description: "Apport minéraux complémentaire" },
      { produit: "Banane / fruits secs", categorie: "Alimentation", type: "produit_conseil", description: "Sources naturelles de K+" },
    ],
  },
  // 128 — Econazole crème
  {
    matchNames: ["econazole%", "économazole%", "pevaryl%"],
    canonicalName: "Econazole 1%", dosage: "1%", forme: "Crème", voie: "cutanée",
    posologie: "1 à 2 applications/jour sur peau propre et sèche, 2 à 4 semaines.",
    atc: "D01AC03", molecule: "Econazole", classe: "Antifongiques imidazolés", otc: true,
    pathologies: ["Mycose cutanée", "Intertrigo", "Pied d'athlète"],
    pcs: [
      { produit: "Poudre antifongique chaussures", categorie: "Prévention", type: "produit_conseil", description: "Évite récidive plis et pieds" },
      { produit: "Savon antifongique pH neutre", categorie: "Hygiène", type: "produit_conseil", description: "Élimination quotidienne" },
      { produit: "Chaussettes coton respirantes", categorie: "Hygiène", type: "produit_conseil", description: "Limite humidité" },
    ],
  },
  // 133-150 — Atorvastatine
  {
    matchNames: ["atorvastatine%", "tahor%"],
    canonicalName: "Atorvastatine 10mg", dosage: "10mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp/jour le soir, indifféremment au cours ou hors repas.",
    atc: "C10AA05", molecule: "Atorvastatine", classe: "Statines", otc: false,
    pathologies: ["Hypercholestérolémie", "Prévention cardiovasculaire"],
    pcs: [
      { produit: "Coenzyme Q10 100mg", categorie: "Tolérance statine", type: "complement", description: "Compense déplétion CoQ10 musculaire" },
      { produit: "Oméga-3 EPA/DHA", categorie: "Cardio", type: "complement", description: "Réduit triglycérides" },
      { produit: "Levure de riz rouge (alternative)", categorie: "Naturel", type: "complement", description: "Pour patients intolérants statine" },
    ],
  },
  // 137 — Métronidazole
  {
    matchNames: ["metronidazole%", "métronidazole%", "flagyl%"],
    canonicalName: "Métronidazole 500mg", dosage: "500mg", forme: "Comprimé pelliculé", voie: "orale",
    posologie: "1 cp 3x/jour au cours des repas, 7 à 10 jours. Pas d'alcool.",
    atc: "J01XD01", molecule: "Métronidazole", classe: "Antibactériens nitro-imidazolés", otc: false,
    pathologies: ["Vaginite bactérienne", "Infection digestive", "Trichomonase"],
    pcs: [
      { produit: "Probiotiques uro-vaginaux", categorie: "Microbiote", type: "complement", description: "Restaure flore vaginale" },
      { produit: "Ovules probiotiques", categorie: "Local", type: "complement", description: "Soutien direct flore intime" },
      { produit: "Gel d'hygiène intime pH 7", categorie: "Hygiène", type: "produit_conseil", description: "Respecte muqueuses" },
    ],
  },
  // 140 — Monoprost (latanoprost)
  {
    matchNames: ["monoprost%", "latanoprost%", "xalatan%"],
    canonicalName: "Monoprost 50µg/mL", dosage: "50µg/mL", forme: "Collyre unidoses", voie: "ophtalmique",
    posologie: "1 goutte dans chaque œil le soir, à heure fixe. Traitement au long cours.",
    atc: "S01EE01", molecule: "Latanoprost", classe: "Analogues prostaglandines", otc: false,
    pathologies: ["Glaucome", "Hypertonie oculaire"],
    pcs: [
      { produit: "Larmes artificielles sans conservateur", categorie: "Confort", type: "dispositif_medical", description: "Compense sécheresse oculaire" },
      { produit: "Lutéine + Zéaxanthine", categorie: "Vision", type: "complement", description: "Protection rétinienne" },
      { produit: "Compresses ophtalmiques chauffantes", categorie: "Confort", type: "dispositif_medical", description: "Soulage gêne palpébrale" },
    ],
  },
  // 142-157 — Bilastine
  {
    matchNames: ["bilastine%", "inorial%"],
    canonicalName: "Bilastine 20mg", dosage: "20mg", forme: "Comprimé", voie: "orale",
    posologie: "1 cp/jour à jeun (1h avant ou 2h après repas).",
    atc: "R06AX29", molecule: "Bilastine", classe: "Antihistaminiques H1 non sédatifs", otc: false,
    pathologies: ["Allergie saisonnière", "Urticaire"],
    pcs: [
      { produit: "Spray nasal eau de mer isotonique", categorie: "Hygiène nasale", type: "dispositif_medical", description: "Élimine allergènes" },
      { produit: "Quercétine 500mg", categorie: "Anti-allergique naturel", type: "complement", description: "Module libération histamine" },
      { produit: "Collyre antiallergique", categorie: "Ophtalmique", type: "produit_conseil", description: "Soulage conjonctivite" },
    ],
  },
  // 143 — Clarelux (clobétasol)
  {
    matchNames: ["clarelux%", "clobetasol%", "clobétasol%", "dermoval%"],
    canonicalName: "Clarelux 500µg/g", dosage: "0,05%", forme: "Crème", voie: "cutanée",
    posologie: "1 application/jour en couche fine, 2 à 4 semaines max. Corticoïde très fort.",
    atc: "D07AD01", molecule: "Clobétasol", classe: "Corticoïdes très puissants", otc: false,
    pathologies: ["Psoriasis", "Eczéma sévère", "Lichen"],
    pcs: [
      { produit: "Émollient quotidien Avène/Dexeryl", categorie: "Hydratation", type: "produit_conseil", description: "Restaure barrière entre applications" },
      { produit: "Huile bain dermatologique", categorie: "Hygiène", type: "produit_conseil", description: "Protège lipides cutanés" },
      { produit: "Oméga-3 EPA/DHA", categorie: "Nutrition", type: "complement", description: "Anti-inflammatoire cutané" },
    ],
  },
  // 145 — Chlorure de sodium 0,9%
  {
    matchNames: ["chlorure de sodium 0%", "serum physiologique%", "sérum physiologique%"],
    canonicalName: "Chlorure de sodium 0,9%", dosage: "0,9%", forme: "Solution", voie: "topique/nasale/oculaire",
    posologie: "Usage local: lavage nasal/oculaire/plaie selon besoin.",
    atc: "B05XA03", molecule: "Chlorure de sodium", classe: "Solution isotonique", otc: true,
    pathologies: ["Lavage nasal", "Hygiène"],
    pcs: [
      { produit: "Mouchoirs doux aloe vera", categorie: "Confort", type: "produit_conseil", description: "Évite irritation après lavage" },
      { produit: "Seringue mouche-bébé", categorie: "Pédiatrie", type: "dispositif_medical", description: "Hygiène nasale nourrisson" },
      { produit: "Spray eau de mer hypertonique", categorie: "Alternative", type: "dispositif_medical", description: "Décongestion plus forte" },
    ],
  },
  // 146 — Tramadol
  {
    matchNames: ["tramadol%", "topalgic%", "contramal%"],
    canonicalName: "Tramadol 50mg", dosage: "50mg", forme: "Gélule", voie: "orale",
    posologie: "1 gélule toutes les 4 à 6h, max 8/jour. Durée la plus courte.",
    atc: "N02AX02", molecule: "Tramadol", classe: "Opioïdes faibles", otc: false,
    pathologies: ["Douleur modérée à sévère", "Lombalgie", "Douleur neuropathique"],
    pcs: [
      { produit: "Laxatif osmotique macrogol", categorie: "Transit", type: "produit_conseil", description: "Prévient constipation aux opioïdes" },
      { produit: "Magnésium marin B6", categorie: "Détente", type: "complement", description: "Détente musculaire" },
      { produit: "Patch chauffant ThermaCare", categorie: "Antalgique local", type: "dispositif_medical", description: "Synergie locale" },
    ],
  },
  // 147 — Ofloxacine collyre
  {
    matchNames: ["ofloxacine%", "exocine%", "quinofree%"],
    canonicalName: "Ofloxacine 1,5mg/0,5mL", dosage: "0,3%", forme: "Collyre", voie: "ophtalmique",
    posologie: "1 goutte 4 à 6x/jour pendant 5 à 7 jours.",
    atc: "S01AE01", molecule: "Ofloxacine", classe: "Antibiotique fluoroquinolone ophtalmique", otc: false,
    pathologies: ["Conjonctivite bactérienne", "Kératite"],
    pcs: [
      { produit: "Sérum physiologique unidoses", categorie: "Lavage", type: "dispositif_medical", description: "Hygiène avant instillation" },
      { produit: "Compresses ophtalmiques stériles", categorie: "Soin", type: "dispositif_medical", description: "Essuyage propre" },
      { produit: "Larmes artificielles", categorie: "Confort", type: "dispositif_medical", description: "Hydratation entre gouttes" },
    ],
  },
  // 152 — Tanganil (acétyl-leucine)
  {
    matchNames: ["tanganil%", "acetyl-leucine%", "acétyl-leucine%"],
    canonicalName: "Tanganil 500mg", dosage: "500mg", forme: "Comprimé", voie: "orale",
    posologie: "3 à 4 cp/jour en 2 à 3 prises pendant 10 jours à 3 semaines.",
    atc: "N07CA04", molecule: "Acétyl-leucine", classe: "Antivertigineux", otc: false,
    pathologies: ["Vertiges"],
    pcs: [
      { produit: "Ginkgo biloba 120mg", categorie: "Microcirculation", type: "complement", description: "Améliore circulation cérébrale" },
      { produit: "Magnésium marin B6", categorie: "Système nerveux", type: "complement", description: "Soutien équilibre nerveux" },
      { produit: "Bracelet anti-nausée P6", categorie: "Confort", type: "dispositif_medical", description: "Acupression nausées associées" },
    ],
  },
  // 161 — Néfopam (Acupan)
  {
    matchNames: ["nefopam%", "néfopam%", "acupan%"],
    canonicalName: "Néfopam 20mg/2mL", dosage: "20mg/2mL", forme: "Solution buvable/injectable", voie: "orale ou injectable",
    posologie: "20mg toutes les 4 à 6h, max 120mg/j. Par voie orale sur un sucre.",
    atc: "N02BG06", molecule: "Néfopam", classe: "Antalgiques non opioïdes", otc: false,
    pathologies: ["Douleur aiguë", "Douleur post-opératoire"],
    pcs: [
      { produit: "Magnésium bisglycinate", categorie: "Détente", type: "complement", description: "Détente musculaire associée" },
      { produit: "Coussinet thermique", categorie: "Confort", type: "dispositif_medical", description: "Soulage zones douloureuses" },
      { produit: "Pansement adhésif EMLA", categorie: "Local", type: "produit_conseil", description: "Anesthésie point ponction" },
    ],
  },
  // 162-164 — Gouttes auriculaires (Otipax, Panotile)
  {
    matchNames: ["otipax%", "panotile%"],
    canonicalName: "Otipax", forme: "Solution auriculaire", voie: "auriculaire",
    posologie: "4 gouttes dans l'oreille douloureuse 2 à 3x/jour, 7 jours max.",
    atc: "S02DA30", molecule: "Phénazone + Lidocaïne", classe: "Antalgique auriculaire local", otc: true,
    pathologies: ["Otite externe", "Otite moyenne congestive"],
    pcs: [
      { produit: "Spray auriculaire hygiène (eau de mer)", categorie: "Hygiène", type: "dispositif_medical", description: "Nettoie sans agresser" },
      { produit: "Bouchons d'oreilles silicone", categorie: "Protection", type: "dispositif_medical", description: "Protège lors douche/baignade" },
      { produit: "Tisane thym-eucalyptus", categorie: "ORL global", type: "produit_conseil", description: "Soutien ORL en cas de rhinopharyngite" },
    ],
  },
  // 165 — Mupirocine
  {
    matchNames: ["mupirocine%", "mupiderm%", "bactroban%"],
    canonicalName: "Mupirocine 2%", dosage: "2%", forme: "Pommade", voie: "cutanée",
    posologie: "3 applications/jour pendant 5 à 10 jours. Couvrir d'un pansement.",
    atc: "D06AX09", molecule: "Mupirocine", classe: "Antibactériens topiques", otc: false,
    pathologies: ["Impétigo", "Infection cutanée superficielle"],
    pcs: [
      { produit: "Compresses stériles", categorie: "Pansement", type: "dispositif_medical", description: "Couvre application" },
      { produit: "Antiseptique chlorhexidine", categorie: "Hygiène", type: "produit_conseil", description: "Désinfecte avant application" },
      { produit: "Savon doux pH neutre", categorie: "Hygiène", type: "produit_conseil", description: "Limite recontamination" },
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Admin auth guard
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: isAdmin } = await adminClient.rpc("has_role", {
    _user_id: userData.user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stats = {
    entries_processed: 0,
    medicaments_matched: 0,
    medicaments_created: 0,
    medicaments_updated_posology: 0,
    molecules_created: 0,
    pathologies_created: 0,
    pathology_links_created: 0,
    pcs_created: 0,
    errors: [] as string[],
  };

  try {
    // Preload existing molecules & pathologies caches
    const moleculeCache = new Map<string, string>();
    const { data: existingMols } = await adminClient.from("molecules").select("id, nom_molecule");
    (existingMols || []).forEach(m => moleculeCache.set(m.nom_molecule.toLowerCase(), m.id));

    const pathoCache = new Map<string, string>();
    const { data: existingPathos } = await adminClient.from("pathologies").select("id, nom_pathologie");
    (existingPathos || []).forEach(p => pathoCache.set(p.nom_pathologie.toLowerCase(), p.id));

    for (const entry of TOP100) {
      stats.entries_processed++;
      try {
        // 1) Find existing meds matching ANY of the matchNames
        const orFilter = entry.matchNames.map(p => `nom_commercial.ilike.${p}`).join(",");
        const { data: matched } = await adminClient
          .from("medicaments")
          .select("id, nom_commercial, posologie")
          .or(orFilter);

        let medIds: string[] = (matched || []).map(m => m.id);

        // 2) Ensure molecule exists
        let moleculeId = moleculeCache.get(entry.molecule.toLowerCase());
        if (!moleculeId) {
          const { data: newMol, error: molErr } = await adminClient
            .from("molecules")
            .insert({
              nom_molecule: entry.molecule,
              atc_code: entry.atc,
              classe_therapeutique: entry.classe,
            }).select("id").single();
          if (newMol) {
            moleculeId = newMol.id;
            moleculeCache.set(entry.molecule.toLowerCase(), moleculeId);
            stats.molecules_created++;
          } else if (molErr) {
            stats.errors.push(`Molecule ${entry.molecule}: ${molErr.message}`);
          }
        }

        // 3) If no med matched, create the canonical one
        if (medIds.length === 0) {
          const { data: newMed, error: medErr } = await adminClient
            .from("medicaments")
            .insert({
              nom_commercial: entry.canonicalName,
              molecule_id: moleculeId,
              atc_code: entry.atc,
              forme_galenique: entry.forme,
              dosage: entry.dosage,
              posologie: entry.posologie,
              voie_administration: entry.voie,
              est_otc: entry.otc,
              est_produit_conseil: entry.otc,
              statut_officine: "actif",
            }).select("id").single();
          if (newMed) {
            medIds = [newMed.id];
            stats.medicaments_created++;
          } else if (medErr) {
            stats.errors.push(`Med ${entry.canonicalName}: ${medErr.message}`);
            continue;
          }
        } else {
          stats.medicaments_matched += medIds.length;
          // 4) Update posology/voie on all matched if missing
          for (const m of matched || []) {
            if (!m.posologie) {
              const { error: upErr } = await adminClient
                .from("medicaments")
                .update({
                  posologie: entry.posologie,
                  voie_administration: entry.voie,
                  molecule_id: moleculeId,
                  atc_code: entry.atc,
                })
                .eq("id", m.id);
              if (!upErr) stats.medicaments_updated_posology++;
            }
          }
        }

        // 5) Ensure pathologies exist and create med↔patho links
        const pathologieIds: string[] = [];
        for (const pName of entry.pathologies) {
          let pId = pathoCache.get(pName.toLowerCase());
          if (!pId) {
            const { data: newP } = await adminClient
              .from("pathologies")
              .insert({ nom_pathologie: pName, categorie: "Général", niveau_gravite: 1 })
              .select("id").single();
            if (newP) {
              pId = newP.id;
              pathoCache.set(pName.toLowerCase(), pId);
              stats.pathologies_created++;
            }
          }
          if (pId) pathologieIds.push(pId);
        }

        for (const medId of medIds) {
          for (const pId of pathologieIds) {
            const { data: existingLink } = await adminClient
              .from("medicament_pathologie")
              .select("id")
              .eq("medicament_id", medId)
              .eq("pathologie_id", pId)
              .limit(1);
            if (!existingLink || existingLink.length === 0) {
              const { error } = await adminClient.from("medicament_pathologie").insert({
                medicament_id: medId,
                pathologie_id: pId,
                score_pertinence: 85,
                source_mapping: "top100_2024",
              });
              if (!error) stats.pathology_links_created++;
            }
          }
        }

        // 6) Insert med-specific PCs (linked to first matched/created med, per pathology context)
        const primaryMedId = medIds[0];
        const primaryPathoId = pathologieIds[0] || null;
        for (const pc of entry.pcs) {
          const { data: existingPc } = await adminClient
            .from("produits_complementaires")
            .select("id")
            .eq("medicament_id", primaryMedId)
            .eq("produit", pc.produit)
            .limit(1);
          if (existingPc && existingPc.length > 0) continue;
          const { error } = await adminClient.from("produits_complementaires").insert({
            medicament_id: primaryMedId,
            pathologie_id: primaryPathoId,
            produit: pc.produit,
            categorie: pc.categorie,
            description: pc.description,
            type_produit: pc.type,
            priorite: 85,
            est_otc: pc.type === "produit_conseil",
            est_complement: pc.type === "complement",
            est_dispositif_medical: pc.type === "dispositif_medical",
            est_eligible_cross_sell: true,
          });
          if (!error) stats.pcs_created++;
          else stats.errors.push(`PC ${pc.produit}: ${error.message}`);
        }
      } catch (e) {
        stats.errors.push(`Entry ${entry.canonicalName}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message, stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
