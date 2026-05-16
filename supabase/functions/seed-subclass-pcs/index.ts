// Seed PCs différenciés par sous-classe pharmacologique
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Subclass = {
  key: string;
  pathologie: string;
  patterns: string[]; // ILIKE patterns on nom_commercial
  posologie?: string;
  voie?: string;
  pcs: { produit: string; categorie: string; description: string }[];
};

const SUBCLASSES: Subclass[] = [
  // === DIABÈTE ===
  {
    key: "glp1",
    pathologie: "Diabète type 2",
    patterns: ["ozempic%", "trulicity%", "victoza%", "xultophy%", "rybelsus%", "saxenda%", "byetta%", "bydureon%", "mounjaro%"],
    posologie: "1 injection/semaine ou selon prescription",
    voie: "sous-cutanée",
    pcs: [
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Réduit les nausées digestives induites par GLP-1" },
      { produit: "Gingembre 500mg", categorie: "Phytothérapie", description: "Anti-nauséeux naturel, soulage les troubles digestifs des GLP-1" },
      { produit: "Hydralin Apaisa gel", categorie: "Hydratation", description: "Compense la sécheresse buccale liée au ralentissement digestif" },
    ],
  },
  {
    key: "metformine",
    pathologie: "Diabète type 2",
    patterns: ["metformine%", "stagid%", "glucophage%"],
    posologie: "1 cp 2 à 3x/jour aux repas",
    voie: "orale",
    pcs: [
      { produit: "Vitamine B12 sublinguale 1000µg", categorie: "Vitamine", description: "Compense la carence en B12 induite par la metformine (>30% des patients)" },
      { produit: "Bion 3 Défense", categorie: "Probiotique", description: "Réduit les troubles digestifs (diarrhée, ballonnements) liés à la metformine" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Soulage les crampes musculaires associées au diabète" },
    ],
  },
  {
    key: "insuline_lente",
    pathologie: "Diabète type 2",
    patterns: ["lantus%", "toujeo%", "tresiba%", "abasaglar%", "levemir%", "semglee%"],
    posologie: "1 injection/jour à heure fixe",
    voie: "sous-cutanée",
    pcs: [
      { produit: "Bandelettes glycémie + lancettes", categorie: "Dispositif médical", description: "Autosurveillance glycémique quotidienne indispensable sous insuline" },
      { produit: "Akildia crème pieds diabétiques", categorie: "Soin", description: "Prévention des plaies du pied diabétique" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Améliore la sensibilité à l'insuline" },
    ],
  },
  {
    key: "insuline_rapide",
    pathologie: "Diabète type 1",
    patterns: ["novorapid%", "humalog%", "apidra%", "fiasp%", "novomix%", "humalogmix%", "actrapid%", "insuman%"],
    posologie: "1 injection avant chaque repas",
    voie: "sous-cutanée",
    pcs: [
      { produit: "Bandelettes glycémie + lancettes", categorie: "Dispositif médical", description: "Surveillance pré et post-prandiale obligatoire" },
      { produit: "Sucre rapide poche (Glucose 15g)", categorie: "Urgence", description: "Resucrage immédiat en cas d'hypoglycémie" },
      { produit: "Compresses alcoolisées", categorie: "Hygiène", description: "Désinfection des sites d'injection" },
    ],
  },
  {
    key: "dpp4",
    pathologie: "Diabète type 2",
    patterns: ["januvia%", "janumet%", "galvus%", "velmetia%", "komboglyze%", "sitagliptine%", "vildagliptine%", "saxagliptine%", "onglyza%", "jentadueto%"],
    posologie: "1 cp 1 à 2x/jour",
    voie: "orale",
    pcs: [
      { produit: "Vitamine D3 1000UI", categorie: "Vitamine", description: "Déficit fréquent chez le diabétique de type 2" },
      { produit: "Oméga-3 EPA/DHA 1000mg", categorie: "Complément", description: "Cardioprotection chez le diabétique" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Soutien microbiote intestinal" },
    ],
  },
  {
    key: "sglt2",
    pathologie: "Diabète type 2",
    patterns: ["forxiga%", "jardiance%", "invokana%", "xigduo%", "synjardy%", "vokanamet%", "steglatro%", "dapagliflozine%", "empagliflozine%"],
    posologie: "1 cp/jour le matin",
    voie: "orale",
    pcs: [
      { produit: "Saforelle soin lavant intime", categorie: "Hygiène intime", description: "Prévention des mycoses génitales fréquentes sous SGLT2" },
      { produit: "Hydralin gel hydratation orale", categorie: "Hydratation", description: "Compense la déshydratation induite par effet diurétique" },
      { produit: "Lactibiane Cnd probiotique", categorie: "Probiotique", description: "Probiotique gynécologique pour prévenir candidoses récidivantes" },
    ],
  },
  {
    key: "sulfamides",
    pathologie: "Diabète type 2",
    patterns: ["gliclazide%", "diamicron%", "glimepiride%", "amarel%", "repaglinide%", "novonorm%"],
    posologie: "1 cp/jour avant le petit-déjeuner",
    voie: "orale",
    pcs: [
      { produit: "Sucre rapide poche (Glucose 15g)", categorie: "Urgence", description: "Resucrage rapide en cas d'hypoglycémie (risque élevé sous sulfamides)" },
      { produit: "Bandelettes glycémie + lancettes", categorie: "Dispositif médical", description: "Détection précoce des hypoglycémies" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Soutien neuromusculaire" },
    ],
  },

  // === CARDIO ===
  {
    key: "statines",
    pathologie: "Hypercholestérolémie",
    patterns: ["atorvastatine%", "rosuvastatine%", "simvastatine%", "pravastatine%", "tahor%", "crestor%", "zocor%", "elisor%", "fluvastatine%"],
    posologie: "1 cp/jour le soir",
    voie: "orale",
    pcs: [
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Compense la déplétion en coenzyme Q10 induite par les statines" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Soulage les crampes et myalgies sous statines" },
      { produit: "Vitamine D3 1000UI", categorie: "Vitamine", description: "Cofacteur du métabolisme lipidique" },
    ],
  },
  {
    key: "ezetimibe_combo",
    pathologie: "Hypercholestérolémie",
    patterns: ["ezetimibe%", "liptruzet%", "twicor%", "suvreza%", "liporosa%", "reselip%", "inegy%"],
    posologie: "1 cp/jour le soir",
    voie: "orale",
    pcs: [
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Protection musculaire sous bithérapie hypolipémiante" },
      { produit: "Oméga-3 EPA/DHA 1000mg", categorie: "Complément", description: "Effet synergique sur les triglycérides" },
      { produit: "Vitamines liposolubles ADEK", categorie: "Vitamine", description: "Compense la malabsorption induite par l'ézétimibe" },
    ],
  },
  {
    key: "pcsk9",
    pathologie: "Hypercholestérolémie",
    patterns: ["repatha%", "praluent%", "leqvio%"],
    posologie: "1 injection toutes les 2 à 4 semaines",
    voie: "sous-cutanée",
    pcs: [
      { produit: "Oméga-3 haute concentration 2000mg", categorie: "Complément", description: "Cardioprotection complémentaire en prévention secondaire" },
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Soutien énergétique cardiaque" },
      { produit: "Compresses alcoolisées", categorie: "Hygiène", description: "Désinfection sites d'injection mensuels" },
    ],
  },
  {
    key: "iec_ara2",
    pathologie: "Hypertension artérielle",
    patterns: ["ramipril%", "perindopril%", "lisinopril%", "enalapril%", "candesartan%", "irbesartan%", "valsartan%", "losartan%", "olmesartan%", "telmisartan%", "coveram%", "bipreterax%", "cotriatec%", "kardegic%", "exforge%", "coversyl%"],
    posologie: "1 cp/jour",
    voie: "orale",
    pcs: [
      { produit: "Pastilles miel-citron Activox", categorie: "ORL", description: "Soulage la toux sèche fréquente sous IEC" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Soutien du rythme cardiaque" },
      { produit: "Tensiomètre Omron poignet", categorie: "Dispositif médical", description: "Automesure tensionnelle hebdomadaire" },
    ],
  },
  {
    key: "betabloquants",
    pathologie: "Hypertension artérielle",
    patterns: ["bisoprolol%", "nebivolol%", "atenolol%", "metoprolol%", "carvedilol%", "sotalol%", "propranolol%", "detensiel%", "temerit%", "kredex%"],
    posologie: "1 cp/jour le matin",
    voie: "orale",
    pcs: [
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Compense la déplétion énergétique induite par bêtabloquants" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Réduit la fatigue et soutient la fonction cardiaque" },
      { produit: "Mélatonine 1mg LP", categorie: "Sommeil", description: "Aide à corriger les troubles du sommeil sous bêtabloquants" },
    ],
  },
  {
    key: "calciques",
    pathologie: "Hypertension artérielle",
    patterns: ["amlodipine%", "lercanidipine%", "verapamil%", "diltiazem%", "loxen%", "eupressyl%", "amlor%", "lercan%", "isoptine%", "nifedipine%", "felodipine%"],
    posologie: "1 cp/jour",
    voie: "orale",
    pcs: [
      { produit: "Bas de contention 15-20 mmHg", categorie: "Dispositif médical", description: "Réduit les œdèmes des chevilles fréquents sous inhibiteurs calciques" },
      { produit: "Cyclo 3 fort crème", categorie: "Veinotonique", description: "Améliore la circulation et soulage les jambes lourdes" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Cofacteur du métabolisme calcique" },
    ],
  },
  {
    key: "diuretiques_anse",
    pathologie: "Hypertension artérielle",
    patterns: ["furosemide%", "lasilix%", "bumetanide%", "burinex%"],
    posologie: "1 cp/jour le matin",
    voie: "orale",
    pcs: [
      { produit: "Diffu-K potassium", categorie: "Minéral", description: "Compense les pertes potassiques induites par les diurétiques de l'anse" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Compense les pertes en magnésium" },
      { produit: "Bandelettes contrôle hydratation", categorie: "Dispositif médical", description: "Surveillance de l'équilibre hydroélectrolytique" },
    ],
  },
  {
    key: "diuretiques_thiazidiques",
    pathologie: "Hypertension artérielle",
    patterns: ["indapamide%", "hydrochlorothiazide%", "fludex%", "esidrex%", "natrilix%"],
    posologie: "1 cp/jour le matin",
    voie: "orale",
    pcs: [
      { produit: "Bananes/fruits riches en potassium (conseil)", categorie: "Diététique", description: "Apport potassique alimentaire pour compenser pertes urinaires" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Compense les pertes magnésiennes" },
      { produit: "Vitamine B1 100mg", categorie: "Vitamine", description: "Compense la déplétion en thiamine sous thiazidiques" },
    ],
  },
  {
    key: "antialdosterone",
    pathologie: "Hypertension artérielle",
    patterns: ["spironolactone%", "aldactone%", "eplerenone%", "inspra%"],
    posologie: "1 cp/jour",
    voie: "orale",
    pcs: [
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Équilibre minéral sous diurétique épargneur de potassium" },
      { produit: "Carte surveillance kaliémie", categorie: "Éducation", description: "Rappel des aliments à limiter (risque hyperkaliémie)" },
      { produit: "Hydratation eau minéralisée", categorie: "Hydratation", description: "Maintien de l'équilibre hydrique" },
    ],
  },
  {
    key: "antiarythmiques",
    pathologie: "Arythmie cardiaque",
    patterns: ["amiodarone%", "cordarone%", "flecaine%", "flecainide%", "dronedarone%", "multaq%"],
    posologie: "Selon prescription cardiologique",
    voie: "orale",
    pcs: [
      { produit: "Sélénium 100µg + Vitamine D3", categorie: "Complément", description: "Soutien thyroïdien sous amiodarone (risque dysthyroïdie)" },
      { produit: "SPF50 mineral visage et corps", categorie: "Photoprotection", description: "Protection indispensable (photosensibilité majeure sous amiodarone)" },
      { produit: "Larmes artificielles sans conservateur", categorie: "Ophtalmologie", description: "Prévention des dépôts cornéens et sécheresse oculaire" },
    ],
  },
  {
    key: "entresto",
    pathologie: "Insuffisance cardiaque",
    patterns: ["entresto%", "sacubitril%"],
    posologie: "1 cp 2x/jour",
    voie: "orale",
    pcs: [
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Soutien énergétique du myocarde" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Soutien de la fonction cardiaque" },
      { produit: "Vitamine D3 1000UI", categorie: "Vitamine", description: "Déficit fréquent en insuffisance cardiaque" },
    ],
  },

  // === ANTICOAG ===
  {
    key: "aod",
    pathologie: "Anticoagulation",
    patterns: ["eliquis%", "xarelto%", "pradaxa%", "lixiana%", "apixaban%", "rivaroxaban%", "dabigatran%", "edoxaban%"],
    posologie: "1 cp 1 à 2x/jour selon prescription",
    voie: "orale",
    pcs: [
      { produit: "Brosse à dents souple Inava", categorie: "Hygiène buccale", description: "Limite les saignements gingivaux sous anticoagulant" },
      { produit: "Bain de bouche sans alcool", categorie: "Hygiène buccale", description: "Hygiène douce, prévient les saignements" },
      { produit: "Carte anticoagulant à porter sur soi", categorie: "Éducation", description: "Information médicale d'urgence" },
    ],
  },
  {
    key: "hbpm",
    pathologie: "Anticoagulation",
    patterns: ["enoxaparine%", "lovenox%", "innohep%", "inhixa%", "arixtra%", "fragmine%", "tinzaparine%", "fondaparinux%"],
    posologie: "1 injection/jour",
    voie: "sous-cutanée",
    pcs: [
      { produit: "Container DASRI 0,6L", categorie: "Dispositif médical", description: "Élimination sécurisée des aiguilles usagées (obligatoire)" },
      { produit: "Biseptine désinfectant cutané", categorie: "Hygiène", description: "Antisepsie des sites d'injection" },
      { produit: "Hirudoid pommade hématomes", categorie: "Soin", description: "Résorption des hématomes aux sites d'injection" },
    ],
  },
  {
    key: "antiplaquettaires",
    pathologie: "Anticoagulation",
    patterns: ["kardegic%", "aspirine protect%", "clopidogrel%", "plavix%", "brilique%", "ticagrelor%", "prasugrel%", "efient%", "aspegic%"],
    posologie: "1 cp/jour",
    voie: "orale",
    pcs: [
      { produit: "Gaviscon menthe suspension", categorie: "Antiacide", description: "Protection gastrique contre l'irritation de l'aspirine" },
      { produit: "Oméga-3 EPA/DHA 1000mg", categorie: "Complément", description: "Cardioprotection complémentaire en prévention secondaire" },
      { produit: "Brosse à dents souple Inava", categorie: "Hygiène buccale", description: "Limite les saignements gingivaux" },
    ],
  },
  {
    key: "avk",
    pathologie: "Anticoagulation",
    patterns: ["coumadine%", "warfarine%", "previscan%", "fluindione%", "sintrom%", "acenocoumarol%"],
    posologie: "1 cp/jour le soir, dose adaptée selon INR",
    voie: "orale",
    pcs: [
      { produit: "Carnet de suivi INR", categorie: "Éducation", description: "Suivi obligatoire de l'INR (cible 2-3 ou 2,5-3,5)" },
      { produit: "Guide alimentaire vitamine K", categorie: "Éducation", description: "Stabilité de l'apport en vitamine K pour INR stable" },
      { produit: "Brosse à dents souple Inava", categorie: "Hygiène buccale", description: "Limite les saignements gingivaux" },
    ],
  },

  // === IPP ===
  {
    key: "ipp",
    pathologie: "brûlures d'estomac",
    patterns: ["omeprazole%", "esomeprazole%", "inexium%", "mopral%", "pantoprazole%", "inipomp%", "lansoprazole%", "lanzor%", "rabeprazole%", "pariet%", "eupantol%"],
    posologie: "1 cp/jour le matin à jeun",
    voie: "orale",
    pcs: [
      { produit: "Lactibiane Référence probiotique", categorie: "Probiotique", description: "Compense la dysbiose intestinale induite par les IPP" },
      { produit: "Vitamine B12 sublinguale 1000µg", categorie: "Vitamine", description: "Compense la malabsorption de B12 sous IPP long terme" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Compense la déplétion magnésienne sous IPP prolongé" },
    ],
  },

  // === MICI ===
  {
    key: "mici",
    pathologie: "Maladies inflammatoires intestinales",
    patterns: ["pentasa%", "fivasa%", "mesalazine%", "rowasa%", "salazopyrine%", "sulfasalazine%"],
    posologie: "Selon prescription gastro-entérologique",
    voie: "orale",
    pcs: [
      { produit: "Mutaflor E.coli Nissle", categorie: "Probiotique", description: "Probiotique spécifique MICI en rémission" },
      { produit: "Vitamine D3 2000UI", categorie: "Vitamine", description: "Carence fréquente en MICI, effet immunomodulateur" },
      { produit: "Oméga-3 EPA haut dosage", categorie: "Complément", description: "Effet anti-inflammatoire complémentaire" },
    ],
  },

  // === PANCRÉATIQUE ===
  {
    key: "pancreatique",
    pathologie: "Insuffisance pancréatique",
    patterns: ["creon%", "eurobiol%", "pancrelipase%"],
    posologie: "Gélules à prendre au début de chaque repas",
    voie: "orale",
    pcs: [
      { produit: "Vitamines ADEK liposolubles", categorie: "Vitamine", description: "Compense la malabsorption des vitamines liposolubles" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Soutien digestif en insuffisance pancréatique exocrine" },
      { produit: "Huile MCT alimentaire", categorie: "Complément", description: "Lipides facilement absorbés, indépendants de la lipase" },
    ],
  },

  // === VIT D / CALCIUM ===
  {
    key: "vitd_calcium",
    pathologie: "Carence en vitamine D",
    patterns: ["uvedose%", "zymad%", "cholecalciferol%", "vitamine d3%", "orocal%", "cacit%", "caltrate%", "ideos%", "calcidose%", "calcium vit%"],
    posologie: "1 ampoule trimestrielle ou 1 sachet/jour selon forme",
    voie: "orale",
    pcs: [
      { produit: "Vitamine K2 MK7 100µg", categorie: "Vitamine", description: "Oriente le calcium vers les os et non les artères" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Cofacteur de l'activation de la vitamine D" },
      { produit: "Oméga-3 EPA/DHA 1000mg", categorie: "Complément", description: "Synergie sur la santé osseuse et cardiovasculaire" },
    ],
  },

  // === FER ===
  {
    key: "fer",
    pathologie: "Anémie ferriprive",
    patterns: ["tardyferon%", "fumafer%", "ferograd%", "venofer%", "ferrum%", "timoferol%"],
    posologie: "1 cp/jour à jeun avec vitamine C",
    voie: "orale",
    pcs: [
      { produit: "Vitamine C 500mg", categorie: "Vitamine", description: "Multiplie par 3 l'absorption du fer" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Compense la constipation fréquente sous fer" },
      { produit: "Lactoferrine 100mg", categorie: "Complément", description: "Forme de fer mieux tolérée digestivement" },
    ],
  },

  // === ANTIÉMÉTIQUES CHIMIO ===
  {
    key: "antiemetiques_chimio",
    pathologie: "Nausées et vomissements",
    patterns: ["akynzeo%", "aprepitant%", "emend%", "rolapitant%", "varuby%"],
    posologie: "1h avant chimiothérapie",
    voie: "orale",
    pcs: [
      { produit: "Gingembre 500mg", categorie: "Phytothérapie", description: "Anti-nauséeux naturel adjuvant à la chimiothérapie" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Protection du microbiote pendant la chimiothérapie" },
      { produit: "Smecta + soluté de réhydratation", categorie: "Digestif", description: "Prise en charge des troubles digestifs post-chimio" },
    ],
  },

  // === LAXATIFS ===
  {
    key: "laxatifs",
    pathologie: "Constipation",
    patterns: ["macrogol%", "transipeg%", "forlax%", "lactulose%", "duphalac%", "eductyl%", "normacol%", "melaxose%", "movicol%", "importal%"],
    posologie: "1 sachet/jour dans un verre d'eau",
    voie: "orale",
    pcs: [
      { produit: "Psyllium blond Plantago", categorie: "Fibre", description: "Fibre douce améliorant le transit en synergie avec les laxatifs" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Régule le microbiote intestinal" },
      { produit: "Bouteille eau 1,5L Hépar", categorie: "Hydratation", description: "Eau magnésienne favorisant le transit" },
    ],
  },

  // === ANTISPASMODIQUES ===
  {
    key: "antispasmodiques",
    pathologie: "Côlon irritable",
    patterns: ["spasfon%", "phloroglucinol%", "meteospasmyl%", "duspatalin%", "mebeverine%", "debridat%", "trimebutine%"],
    posologie: "1 cp ou lyoc 3x/jour",
    voie: "orale",
    pcs: [
      { produit: "Patch chauffant abdominal ThermaCare", categorie: "Soin", description: "Chaleur localisée pour soulager les spasmes" },
      { produit: "Tisane menthe poivrée bio", categorie: "Phytothérapie", description: "Antispasmodique naturel digestif" },
      { produit: "Lactibiane IBS probiotique", categorie: "Probiotique", description: "Souche spécifique côlon irritable" },
    ],
  },

  // === ANTIACIDES ===
  {
    key: "antiacides",
    pathologie: "brûlures d'estomac",
    patterns: ["gaviscon%", "maalox%", "rennie%", "gaviscell%", "phosphalugel%", "polysilane%", "rocgel%", "neutralca%"],
    posologie: "1 sachet ou 2 cp après les repas et au coucher",
    voie: "orale",
    pcs: [
      { produit: "Oreiller anti-reflux inclinable", categorie: "Dispositif médical", description: "Position semi-assise pour limiter le reflux nocturne" },
      { produit: "Tisane camomille bio", categorie: "Phytothérapie", description: "Apaise la muqueuse gastrique" },
      { produit: "Lactibiane Référence", categorie: "Probiotique", description: "Soutien du microbiote gastrique" },
    ],
  },

  // === URGENCE ===
  {
    key: "urgence",
    pathologie: "Choc anaphylactique",
    patterns: ["epipen%", "anapen%", "jext%", "emerade%"],
    posologie: "1 injection IM face latérale cuisse en urgence",
    voie: "intramusculaire",
    pcs: [
      { produit: "Carte allergie plastifiée", categorie: "Éducation", description: "Information médicale d'urgence à porter sur soi" },
      { produit: "2e auto-injecteur de secours", categorie: "Urgence", description: "Backup obligatoire (15% nécessitent 2 doses)" },
      { produit: "Trousse de premiers secours", categorie: "Urgence", description: "Kit complet pour réaction allergique" },
    ],
  },
  {
    key: "trinitrine",
    pathologie: "Angor",
    patterns: ["natispray%", "trinitrine%", "isocard%", "lenitral%"],
    posologie: "1 à 2 pulvérisations sublinguales lors de la crise",
    voie: "sublinguale",
    pcs: [
      { produit: "Carte coronarien plastifiée", categorie: "Éducation", description: "Info médicale d'urgence" },
      { produit: "CoQ10 Ubiquinol 100mg", categorie: "Complément", description: "Soutien énergétique du myocarde" },
      { produit: "Magnésium bisglycinate 300mg", categorie: "Minéral", description: "Vasodilatation et soutien cardiaque" },
    ],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const report: any[] = [];
  let totalMeds = 0;
  let totalPcs = 0;

  for (const sc of SUBCLASSES) {
    // 1. Get or create pathology
    let { data: patho } = await supabase
      .from("pathologies")
      .select("id")
      .ilike("nom_pathologie", sc.pathologie)
      .maybeSingle();

    if (!patho) {
      const { data: newPatho } = await supabase
        .from("pathologies")
        .insert({ nom_pathologie: sc.pathologie })
        .select("id")
        .single();
      patho = newPatho;
    }
    if (!patho) {
      report.push({ subclass: sc.key, error: "pathology_failed" });
      continue;
    }

    // 2. Find matching medications
    const orQuery = sc.patterns.map((p) => `nom_commercial.ilike.${p}`).join(",");
    const { data: meds } = await supabase
      .from("medicaments")
      .select("id, nom_commercial")
      .or(orQuery)
      .limit(500);

    const medList = meds ?? [];
    totalMeds += medList.length;

    // 3. Update posologie/voie on found meds
    if (medList.length > 0 && (sc.posologie || sc.voie)) {
      const updateData: any = {};
      if (sc.posologie) updateData.posologie = sc.posologie;
      if (sc.voie) updateData.voie_administration = sc.voie;
      await supabase
        .from("medicaments")
        .update(updateData)
        .in("id", medList.map((m) => m.id));
    }

    // 4. Link medications to pathology
    if (medList.length > 0) {
      const links = medList.map((m) => ({
        medicament_id: m.id,
        pathologie_id: patho!.id,
        score_pertinence: 80,
        source_mapping: "seed_subclass_pcs",
      }));
      await supabase.from("medicament_pathologie").upsert(links, {
        onConflict: "medicament_id,pathologie_id",
        ignoreDuplicates: true,
      });
    }

    // 5. Replace PCs for each medication (delete old seed PCs, insert new subclass-specific)
    let pcCount = 0;
    for (const med of medList) {
      // Delete previous seed PCs (keep manually-validated ones)
      await supabase
        .from("produits_complementaires")
        .delete()
        .eq("medicament_id", med.id)
        .in("source_code", ["seed_top100_2024", "seed_top1000_2025", "seed_subclass_pcs"]);

      const pcRows = sc.pcs.map((pc, idx) => ({
        pathologie_id: patho!.id,
        medicament_id: med.id,
        produit: pc.produit,
        nom_produit: pc.produit,
        categorie: pc.categorie,
        description: pc.description,
        priorite: 90 - idx * 5,
        est_eligible_cross_sell: true,
        source_code: "seed_subclass_pcs",
      }));
      const { error } = await supabase.from("produits_complementaires").insert(pcRows);
      if (error) {
        console.error("INSERT_ERR", med.nom_commercial, error.message);
      } else {
        pcCount += pcRows.length;
        totalPcs += pcRows.length;
      }
    }

    report.push({
      subclass: sc.key,
      pathologie: sc.pathologie,
      meds_matched: medList.length,
      pcs_inserted: pcCount,
    });
  }

  return new Response(
    JSON.stringify({ success: true, total_meds: totalMeds, total_pcs: totalPcs, report }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
