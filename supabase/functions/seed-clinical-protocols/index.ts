import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// DONNÉES CLINIQUES OFFICINALES COMPLÈTES
// ============================================

const SYMPTOMES = [
  { nom: "fièvre", desc: "Élévation de la température corporelle au-dessus de 38°C" },
  { nom: "toux sèche", desc: "Toux non productive, irritative" },
  { nom: "toux grasse", desc: "Toux productive avec expectorations" },
  { nom: "rhume", desc: "Infection virale des voies respiratoires supérieures" },
  { nom: "nez bouché", desc: "Congestion nasale" },
  { nom: "gorge irritée", desc: "Douleur ou gêne pharyngée" },
  { nom: "douleur légère", desc: "Douleur d'intensité faible à modérée" },
  { nom: "douleurs musculaires", desc: "Myalgies, courbatures" },
  { nom: "diarrhée", desc: "Selles liquides fréquentes" },
  { nom: "constipation", desc: "Difficulté à évacuer les selles" },
  { nom: "brûlures d'estomac", desc: "Pyrosis, sensation de brûlure épigastrique" },
  { nom: "allergies saisonnières", desc: "Rhinite allergique, pollinose" },
  { nom: "yeux irrités", desc: "Irritation oculaire, conjonctivite" },
  { nom: "jambes lourdes", desc: "Sensation de pesanteur dans les membres inférieurs" },
  { nom: "nausées", desc: "Envie de vomir sans cause grave identifiée" },
  { nom: "cystite légère", desc: "Infection urinaire basse non compliquée" },
  { nom: "fatigue passagère", desc: "Asthénie transitoire sans cause pathologique grave" },
  { nom: "maux de tête", desc: "Céphalées d'intensité légère à modérée" },
  { nom: "digestion difficile", desc: "Dyspepsie fonctionnelle" },
  { nom: "irritation cutanée", desc: "Rougeur, démangeaison cutanée légère" },
  { nom: "mycose superficielle", desc: "Infection fongique cutanée ou unguéale bénigne" },
  { nom: "sécheresse oculaire", desc: "Insuffisance de film lacrymal" },
  { nom: "insomnie légère", desc: "Difficultés d'endormissement passagères" },
  { nom: "stress léger", desc: "Anxiété légère, nervosité passagère" },
];

// Pathologies cibles avec leurs protocoles complets
const PATHOLOGIES_PROTOCOLES = [
  {
    pathologie: "fièvre",
    categorie: "infectiologie",
    description: "Élévation de la température corporelle nécessitant une surveillance",
    niveau_gravite: 2,
    orientation_urgence: false,
    symptomes: ["fièvre", "douleur légère", "maux de tête"],
    conseils: [
      { code: "FIEV_01", label: "Surveiller la température", desc: "Prendre la température toutes les 4h et consulter si >39°C persistant" },
      { code: "FIEV_02", label: "Rester hydraté", desc: "Boire au moins 1,5L d'eau par jour, fractionner les prises" },
    ],
    produits: [
      { nom: "Thermomètre digital", type: "dispositif_medical", cat: "mesure", est_dm: true, just: "Indispensable pour surveiller l'évolution de la température", prio: 95 },
      { nom: "Compresses froides", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Soulagement rapide par voie externe, sans effet secondaire", prio: 75 },
      { nom: "Solution de réhydratation orale", type: "produit_conseil", cat: "réhydratation", est_otc: true, just: "Prévient la déshydratation liée à la fièvre", prio: 60 },
    ],
  },
  {
    pathologie: "rhume",
    categorie: "ORL",
    description: "Rhinopharyngite virale aiguë bénigne",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["rhume", "nez bouché", "gorge irritée"],
    conseils: [
      { code: "RHUM_01", label: "Lavage nasal régulier", desc: "Effectuer 3 à 4 lavages nasaux par jour avec une solution saline" },
      { code: "RHUM_02", label: "Bien s'hydrater", desc: "Boire des boissons chaudes et au moins 1,5L d'eau par jour" },
    ],
    produits: [
      { nom: "Spray eau de mer hypertonique", type: "dispositif_medical", cat: "hygiène nasale", est_dm: true, just: "Décongestionne naturellement sans accoutumance", prio: 90 },
      { nom: "Pastilles gorge antiseptiques", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Soulage l'irritation pharyngée associée", prio: 70 },
      { nom: "Sérum physiologique unidose", type: "dispositif_medical", cat: "hygiène nasale", est_dm: true, just: "Hygiène nasale douce, adapté à toute la famille", prio: 55 },
    ],
  },
  {
    pathologie: "toux sèche",
    categorie: "pneumologie",
    description: "Toux non productive irritative d'origine virale ou allergique",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["toux sèche", "gorge irritée"],
    conseils: [
      { code: "TSEC_01", label: "Hydrater la gorge", desc: "Boire régulièrement des boissons tièdes, éviter l'air sec" },
      { code: "TSEC_02", label: "Éviter les irritants", desc: "Ne pas fumer, éviter les atmosphères enfumées ou poussiéreuses" },
    ],
    produits: [
      { nom: "Pastilles adoucissantes gorge", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Action locale apaisante sur la muqueuse irritée", prio: 90 },
      { nom: "Spray gorge protecteur", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Forme un film protecteur sur la muqueuse pharyngée", prio: 75 },
      { nom: "Sirop antitussif naturel", type: "produit_conseil", cat: "toux", est_otc: true, just: "Calme la toux sèche sans effet sédatif excessif", prio: 55 },
    ],
  },
  {
    pathologie: "toux grasse",
    categorie: "pneumologie",
    description: "Toux productive avec sécrétions bronchiques",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["toux grasse", "nez bouché"],
    conseils: [
      { code: "TGRA_01", label: "Favoriser l'hydratation", desc: "Boire abondamment pour fluidifier les sécrétions" },
      { code: "TGRA_02", label: "Fluidifier les sécrétions", desc: "Humidifier l'air ambiant, position semi-assise la nuit" },
    ],
    produits: [
      { nom: "Sirop expectorant", type: "produit_conseil", cat: "toux", est_otc: true, just: "Facilite l'expectoration et le drainage bronchique", prio: 90 },
      { nom: "Spray nasal décongestionnant", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Libère les voies respiratoires si contexte ORL associé", prio: 70 },
      { nom: "Pastilles adoucissantes gorge", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Soulage l'irritation pharyngée liée à la toux répétée", prio: 50 },
    ],
  },
  {
    pathologie: "allergie saisonnière",
    categorie: "allergologie",
    description: "Rhinite allergique saisonnière (pollinose)",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["allergies saisonnières", "nez bouché", "yeux irrités"],
    conseils: [
      { code: "ALLE_01", label: "Limiter l'exposition aux allergènes", desc: "Éviter les sorties aux heures de forte pollinisation, fermer les fenêtres" },
      { code: "ALLE_02", label: "Rincer nez et yeux", desc: "Lavage nasal et oculaire matin et soir pour éliminer les allergènes" },
    ],
    produits: [
      { nom: "Collyre antiallergique", type: "produit_conseil", cat: "ophtalmologie", est_otc: true, just: "Soulage le prurit et le larmoiement oculaire allergique", prio: 90 },
      { nom: "Spray nasal antiallergique", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Action locale rapide sur la congestion nasale allergique", prio: 75 },
      { nom: "Sérum physiologique unidose", type: "dispositif_medical", cat: "hygiène", est_dm: true, just: "Rinçage nasal et oculaire doux pour éliminer les allergènes", prio: 55 },
    ],
  },
  {
    pathologie: "diarrhée aiguë simple",
    categorie: "gastro-entérologie",
    description: "Épisode diarrhéique aigu sans signe de gravité",
    niveau_gravite: 2,
    orientation_urgence: false,
    symptomes: ["diarrhée", "nausées"],
    conseils: [
      { code: "DIAR_01", label: "Boire régulièrement", desc: "Boire par petites gorgées fréquentes pour compenser les pertes hydriques" },
      { code: "DIAR_02", label: "Surveiller la déshydratation", desc: "Consulter si signes de déshydratation, fièvre >39°C ou sang dans les selles" },
    ],
    produits: [
      { nom: "Solution de réhydratation orale", type: "produit_conseil", cat: "réhydratation", est_otc: true, just: "Compense les pertes hydro-électrolytiques", prio: 95 },
      { nom: "Probiotiques", type: "complement", cat: "microbiote", est_compl: true, just: "Restaure l'équilibre de la flore intestinale", prio: 75 },
      { nom: "Pansement intestinal", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Protège la muqueuse intestinale et absorbe les toxines", prio: 60 },
    ],
  },
  {
    pathologie: "brûlures d'estomac",
    categorie: "gastro-entérologie",
    description: "Pyrosis et reflux gastro-œsophagien léger",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["brûlures d'estomac", "digestion difficile"],
    conseils: [
      { code: "BRUL_01", label: "Éviter les aliments irritants", desc: "Limiter café, alcool, épices, agrumes et aliments gras" },
      { code: "BRUL_02", label: "Fractionner les repas", desc: "Manger léger le soir, ne pas se coucher juste après le repas" },
    ],
    produits: [
      { nom: "Pansement gastrique", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Protège la muqueuse gastrique et soulage rapidement", prio: 90 },
      { nom: "Complément digestion", type: "complement", cat: "digestion", est_compl: true, just: "Facilite la digestion et réduit les ballonnements", prio: 70 },
      { nom: "Eau bicarbonatée", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Neutralise l'acidité gastrique de façon naturelle", prio: 50 },
    ],
  },
  {
    pathologie: "douleurs musculaires",
    categorie: "rhumatologie",
    description: "Myalgies, courbatures, douleurs musculo-squelettiques légères",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["douleurs musculaires", "douleur légère"],
    conseils: [
      { code: "DOUL_01", label: "Repos relatif", desc: "Limiter les efforts physiques intenses pendant quelques jours" },
      { code: "DOUL_02", label: "Traitement local complémentaire", desc: "Appliquer du chaud ou du froid selon le type de douleur" },
    ],
    produits: [
      { nom: "Gel anti-inflammatoire local", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Action anti-inflammatoire ciblée sans effet systémique", prio: 90 },
      { nom: "Patch chauffant", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Détend les muscles contracturés par la chaleur", prio: 70 },
      { nom: "Crème de massage récupération", type: "produit_conseil", cat: "confort", est_otc: true, just: "Favorise la récupération musculaire", prio: 50 },
    ],
  },
  {
    pathologie: "constipation occasionnelle",
    categorie: "gastro-entérologie",
    description: "Ralentissement du transit sans cause organique",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["constipation"],
    conseils: [
      { code: "CONS_01", label: "Augmenter les fibres", desc: "Enrichir l'alimentation en fruits, légumes et céréales complètes" },
      { code: "CONS_02", label: "Boire suffisamment", desc: "Au moins 1,5L d'eau par jour, dont de l'eau riche en magnésium" },
    ],
    produits: [
      { nom: "Laxatif osmotique doux", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Régule le transit en douceur sans irritation", prio: 90 },
      { nom: "Complément fibres", type: "complement", cat: "transit", est_compl: true, just: "Apport en fibres solubles pour améliorer le transit", prio: 70 },
      { nom: "Probiotiques transit", type: "complement", cat: "microbiote", est_compl: true, just: "Soutient l'équilibre de la flore intestinale", prio: 55 },
    ],
  },
  {
    pathologie: "maux de gorge",
    categorie: "ORL",
    description: "Pharyngite ou angine virale bénigne",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["gorge irritée", "fièvre"],
    conseils: [
      { code: "GORG_01", label: "Gargarismes et boissons tièdes", desc: "Faire des gargarismes au sérum physiologique, boire du thé au miel" },
      { code: "GORG_02", label: "Surveiller l'évolution", desc: "Consulter si douleur intense >3 jours ou fièvre >39°C" },
    ],
    produits: [
      { nom: "Pastilles gorge antiseptiques", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Action antiseptique locale sur la muqueuse pharyngée", prio: 90 },
      { nom: "Spray gorge anesthésiant", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Soulagement rapide de la douleur pharyngée", prio: 75 },
      { nom: "Miel de manuka", type: "complement", cat: "ORL", est_compl: true, just: "Propriétés apaisantes et antibactériennes naturelles", prio: 50 },
    ],
  },
  {
    pathologie: "jambes lourdes",
    categorie: "phlébologie",
    description: "Insuffisance veineuse légère des membres inférieurs",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["jambes lourdes"],
    conseils: [
      { code: "JAMB_01", label: "Surélever les jambes", desc: "Surélever les jambes au repos, marcher régulièrement" },
      { code: "JAMB_02", label: "Éviter la chaleur", desc: "Finir la douche par un jet d'eau froide sur les jambes" },
    ],
    produits: [
      { nom: "Veinotonique oral", type: "produit_conseil", cat: "phlébologie", est_otc: true, just: "Améliore le tonus veineux et réduit les symptômes", prio: 90 },
      { nom: "Gel jambes légères", type: "produit_conseil", cat: "confort", est_otc: true, just: "Effet fraîcheur immédiat et sensation de légèreté", prio: 70 },
      { nom: "Bas de contention classe 1", type: "dispositif_medical", cat: "phlébologie", est_dm: true, just: "Compression graduée pour soutenir le retour veineux", prio: 55 },
    ],
  },
  {
    pathologie: "fatigue passagère",
    categorie: "médecine générale",
    description: "Asthénie fonctionnelle sans cause organique",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["fatigue passagère", "stress léger"],
    conseils: [
      { code: "FATI_01", label: "Hygiène de vie", desc: "Respecter des horaires de sommeil réguliers, limiter les excitants" },
      { code: "FATI_02", label: "Alimentation équilibrée", desc: "Favoriser les aliments riches en fer, magnésium et vitamines B" },
    ],
    produits: [
      { nom: "Complément magnésium + vitamine B6", type: "complement", cat: "vitalité", est_compl: true, just: "Réduit la fatigue et soutient le métabolisme énergétique", prio: 90 },
      { nom: "Gelée royale", type: "complement", cat: "vitalité", est_compl: true, just: "Stimulant naturel pour les périodes de fatigue", prio: 70 },
      { nom: "Complément fer + vitamine C", type: "complement", cat: "vitalité", est_compl: true, just: "Corrige un déficit en fer fréquent en cas de fatigue", prio: 55 },
    ],
  },
  {
    pathologie: "nausées simples",
    categorie: "gastro-entérologie",
    description: "Nausées fonctionnelles sans vomissements sévères",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["nausées", "digestion difficile"],
    conseils: [
      { code: "NAUS_01", label: "Fractionner les repas", desc: "Manger léger et fréquemment, éviter les odeurs fortes" },
      { code: "NAUS_02", label: "Gingembre et menthe", desc: "Infusion de gingembre ou menthe poivrée pour calmer les nausées" },
    ],
    produits: [
      { nom: "Antiémétique OTC", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Soulage les nausées fonctionnelles rapidement", prio: 90 },
      { nom: "Gélules de gingembre", type: "complement", cat: "digestion", est_compl: true, just: "Anti-nauséeux naturel bien toléré", prio: 70 },
      { nom: "Eau gazeuse citronnée", type: "produit_conseil", cat: "confort", est_otc: true, just: "Soulagement simple et accessible des nausées légères", prio: 45 },
    ],
  },
  {
    pathologie: "sécheresse oculaire",
    categorie: "ophtalmologie",
    description: "Insuffisance du film lacrymal, yeux secs",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["yeux irrités", "sécheresse oculaire"],
    conseils: [
      { code: "SECO_01", label: "Réduire le temps d'écran", desc: "Faire des pauses visuelles toutes les 20 minutes (règle 20-20-20)" },
      { code: "SECO_02", label: "Protéger les yeux", desc: "Éviter la climatisation directe, porter des lunettes de soleil" },
    ],
    produits: [
      { nom: "Larmes artificielles", type: "dispositif_medical", cat: "ophtalmologie", est_dm: true, just: "Hydratation et protection du film lacrymal", prio: 95 },
      { nom: "Compresses oculaires apaisantes", type: "dispositif_medical", cat: "ophtalmologie", est_dm: true, just: "Décongestionne et apaise les yeux fatigués", prio: 65 },
      { nom: "Complément oméga-3", type: "complement", cat: "ophtalmologie", est_compl: true, just: "Soutient la qualité du film lacrymal par voie orale", prio: 50 },
    ],
  },
  {
    pathologie: "cystite légère",
    categorie: "urologie",
    description: "Infection urinaire basse non compliquée chez la femme",
    niveau_gravite: 2,
    orientation_urgence: false,
    symptomes: ["cystite légère"],
    conseils: [
      { code: "CYST_01", label: "Boire abondamment", desc: "Au moins 2L d'eau par jour pour favoriser l'élimination urinaire" },
      { code: "CYST_02", label: "Hygiène intime adaptée", desc: "Utiliser un produit d'hygiène intime à pH physiologique" },
    ],
    produits: [
      { nom: "Cranberry concentré", type: "complement", cat: "urologie", est_compl: true, just: "Prévient l'adhésion des bactéries sur les parois urinaires", prio: 90 },
      { nom: "D-Mannose", type: "complement", cat: "urologie", est_compl: true, just: "Anti-adhésion bactérienne naturel pour les voies urinaires", prio: 75 },
      { nom: "Gel hygiène intime", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Maintient le pH vaginal et prévient les récidives", prio: 55 },
    ],
  },
  {
    pathologie: "irritation cutanée légère",
    categorie: "dermatologie",
    description: "Rougeur, démangeaison ou sécheresse cutanée bénigne",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["irritation cutanée"],
    conseils: [
      { code: "IRRI_01", label: "Hydrater la peau", desc: "Appliquer un émollient matin et soir sur la zone concernée" },
      { code: "IRRI_02", label: "Éviter les irritants", desc: "Préférer les vêtements en coton, éviter les savons agressifs" },
    ],
    produits: [
      { nom: "Crème émolliente réparatrice", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Restaure la barrière cutanée et apaise les irritations", prio: 90 },
      { nom: "Eau thermale en spray", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Apaise et rafraîchit la peau irritée", prio: 70 },
      { nom: "Savon surgras sans savon", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Nettoie en douceur sans aggraver l'irritation", prio: 50 },
    ],
  },
  {
    pathologie: "mycose superficielle",
    categorie: "dermatologie",
    description: "Infection fongique cutanée ou unguéale bénigne",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["mycose superficielle", "irritation cutanée"],
    conseils: [
      { code: "MYCO_01", label: "Garder la zone sèche", desc: "Bien sécher après la toilette, porter des chaussettes en coton" },
      { code: "MYCO_02", label: "Traiter suffisamment longtemps", desc: "Poursuivre le traitement antifongique même après disparition des symptômes" },
    ],
    produits: [
      { nom: "Antifongique local crème", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Traitement de première intention des mycoses cutanées", prio: 95 },
      { nom: "Poudre antifongique", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Maintient la zone sèche et poursuit l'action antifongique", prio: 70 },
      { nom: "Spray désinfectant chaussures", type: "dispositif_medical", cat: "hygiène", est_dm: true, just: "Prévient la recontamination via les chaussures", prio: 50 },
    ],
  },
  {
    pathologie: "insomnie légère",
    categorie: "neurologie",
    description: "Difficultés d'endormissement passagères",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["insomnie légère", "stress léger"],
    conseils: [
      { code: "INSO_01", label: "Hygiène du sommeil", desc: "Horaires réguliers, éviter les écrans 1h avant le coucher" },
      { code: "INSO_02", label: "Rituel de relaxation", desc: "Tisane, lecture, exercices de respiration avant le coucher" },
    ],
    produits: [
      { nom: "Mélatonine 1mg", type: "complement", cat: "sommeil", est_compl: true, just: "Réduit le temps d'endormissement de façon physiologique", prio: 90 },
      { nom: "Tisane relaxante", type: "produit_conseil", cat: "phytothérapie", est_otc: true, just: "Favorise la détente avant le coucher", prio: 70 },
      { nom: "Spray oreiller lavande", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Environnement olfactif propice à l'endormissement", prio: 50 },
    ],
  },
  {
    pathologie: "maux de tête légers",
    categorie: "neurologie",
    description: "Céphalées de tension d'intensité légère à modérée",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["maux de tête", "stress léger"],
    conseils: [
      { code: "CEPH_01", label: "Repos dans un endroit calme", desc: "S'allonger dans une pièce sombre et silencieuse" },
      { code: "CEPH_02", label: "Hydratation", desc: "La déshydratation est une cause fréquente de céphalées" },
    ],
    produits: [
      { nom: "Stick menthe poivrée tempes", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Soulagement rapide par application locale rafraîchissante", prio: 85 },
      { nom: "Complément magnésium", type: "complement", cat: "vitalité", est_compl: true, just: "Le magnésium aide à prévenir les céphalées de tension", prio: 70 },
      { nom: "Masque relaxant yeux", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Détente musculaire et visuelle pour apaiser les tensions", prio: 50 },
    ],
  },
  {
    pathologie: "reflux gastro-œsophagien léger",
    categorie: "gastro-entérologie",
    description: "Remontées acides occasionnelles sans complication",
    niveau_gravite: 1,
    orientation_urgence: false,
    symptomes: ["brûlures d'estomac", "digestion difficile", "nausées"],
    conseils: [
      { code: "REFL_01", label: "Surélever la tête du lit", desc: "Surélever de 15cm pour limiter le reflux nocturne" },
      { code: "REFL_02", label: "Éviter les repas tardifs", desc: "Dîner léger au moins 3h avant le coucher" },
    ],
    produits: [
      { nom: "Antiacide local", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Neutralise l'acidité gastrique rapidement", prio: 90 },
      { nom: "Alginate protecteur", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Forme un radeau anti-reflux sur le contenu gastrique", prio: 75 },
      { nom: "Probiotiques digestion", type: "complement", cat: "digestion", est_compl: true, just: "Soutient l'équilibre du microbiote gastro-intestinal", prio: 50 },
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stats: Record<string, number> = {};

    // ============================================
    // ÉTAPE 1: Seed symptômes officinaux
    // ============================================
    const symptomesData = SYMPTOMES.map(s => ({
      nom_symptome: s.nom,
      description: s.desc,
    }));

    for (const s of symptomesData) {
      await supabase.from("symptomes_officine").upsert(s, { onConflict: "nom_symptome" });
    }
    stats.symptomes = symptomesData.length;

    // Fetch all symptomes for linking
    const { data: allSymptomes } = await supabase.from("symptomes_officine").select("id, nom_symptome");
    const symptomeMap = new Map((allSymptomes || []).map((s: any) => [s.nom_symptome, s.id]));

    // ============================================
    // ÉTAPE 2: Upsert pathologies enrichies
    // ============================================
    for (const pp of PATHOLOGIES_PROTOCOLES) {
      // Check if pathology exists
      const { data: existing } = await supabase
        .from("pathologies")
        .select("id")
        .ilike("nom_pathologie", pp.pathologie)
        .maybeSingle();

      let pathologieId: string;

      if (existing) {
        pathologieId = existing.id;
        await supabase.from("pathologies").update({
          categorie: pp.categorie,
          description: pp.description,
          niveau_gravite: pp.niveau_gravite,
          orientation_urgence: pp.orientation_urgence,
        }).eq("id", pathologieId);
      } else {
        const { data: newP } = await supabase.from("pathologies").insert({
          nom_pathologie: pp.pathologie,
          categorie: pp.categorie,
          description: pp.description,
          niveau_gravite: pp.niveau_gravite,
          orientation_urgence: pp.orientation_urgence,
        }).select("id").single();
        pathologieId = newP!.id;
      }

      // ============================================
      // ÉTAPE 3: Lier symptômes → pathologie
      // ============================================
      for (const symNom of pp.symptomes) {
        const symId = symptomeMap.get(symNom);
        if (symId) {
          await supabase.from("symptome_pathologie").upsert({
            symptome_id: symId,
            pathologie_id: pathologieId,
            score_pertinence: 80,
          }, { onConflict: "symptome_id,pathologie_id" });
        }
      }

      // ============================================
      // ÉTAPE 4: Créer les conseils associés
      // ============================================
      const conseilIds: string[] = [];
      for (const conseil of pp.conseils) {
        // Check existing
        const { data: existingC } = await supabase
          .from("conseils_associes")
          .select("id")
          .eq("pathologie_id", pathologieId)
          .eq("conseil_code", conseil.code)
          .maybeSingle();

        if (existingC) {
          conseilIds.push(existingC.id);
          await supabase.from("conseils_associes").update({
            conseil: conseil.label,
            description: conseil.desc,
          }).eq("id", existingC.id);
        } else {
          const { data: newC } = await supabase.from("conseils_associes").insert({
            pathologie_id: pathologieId,
            conseil_code: conseil.code,
            conseil: conseil.label,
            description: conseil.desc,
            priorite: 80,
          }).select("id").single();
          conseilIds.push(newC!.id);
        }
      }

      // ============================================
      // ÉTAPE 5: Créer les produits complémentaires
      // ============================================
      const produitIds: string[] = [];
      for (const prod of pp.produits) {
        // Check existing by name + pathologie
        const { data: existingP } = await supabase
          .from("produits_complementaires")
          .select("id")
          .eq("pathologie_id", pathologieId)
          .ilike("produit", prod.nom)
          .maybeSingle();

        if (existingP) {
          produitIds.push(existingP.id);
          await supabase.from("produits_complementaires").update({
            nom_produit: prod.nom,
            type_produit: prod.type,
            categorie: prod.cat,
            est_dispositif_medical: prod.est_dm || false,
            est_complement: prod.est_compl || false,
            est_otc: prod.est_otc || false,
            est_eligible_cross_sell: true,
          }).eq("id", existingP.id);
        } else {
          const { data: newP } = await supabase.from("produits_complementaires").insert({
            pathologie_id: pathologieId,
            produit: prod.nom,
            nom_produit: prod.nom,
            type_produit: prod.type,
            categorie: prod.cat,
            priorite: prod.prio,
            description: prod.just,
            est_dispositif_medical: prod.est_dm || false,
            est_complement: prod.est_compl || false,
            est_otc: prod.est_otc || false,
            est_eligible_cross_sell: true,
          }).select("id").single();
          produitIds.push(newP!.id);
        }
      }

      // ============================================
      // ÉTAPE 6: Créer le protocole pathologie
      // ============================================
      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        // Delete existing protocole for this pathologie
        await supabase.from("protocole_pathologie").delete().eq("pathologie_id", pathologieId);

        await supabase.from("protocole_pathologie").insert({
          pathologie_id: pathologieId,
          conseil_1_id: conseilIds[0],
          conseil_2_id: conseilIds[1],
          produit_complementaire_1_id: produitIds[0],
          produit_complementaire_2_id: produitIds[1],
          produit_complementaire_3_id: produitIds[2],
          justification_1: pp.produits[0].just,
          justification_2: pp.produits[1].just,
          justification_3: pp.produits[2].just,
          priorite_produit_1: pp.produits[0].prio,
          priorite_produit_2: pp.produits[1].prio,
          priorite_produit_3: pp.produits[2].prio,
          version_protocole: 1,
          actif: true,
        });
      }
    }

    stats.pathologies_avec_protocole = PATHOLOGIES_PROTOCOLES.length;

    // ============================================
    // ÉTAPE 7: Marquer médicaments OTC existants
    // ============================================
    // Mark common OTC molecules
    const otcMolecules = [
      "paracétamol", "ibuprofène", "aspirine", "dextrométhorphane",
      "loratadine", "cétirizine", "oméprazole", "lopéramide",
      "acétylcystéine", "carbocistéine", "diosmectite", "macrogol",
      "métopimazine", "phloroglucinol",
    ];

    for (const mol of otcMolecules) {
      const { data: molData } = await supabase
        .from("molecules")
        .select("id")
        .ilike("nom_molecule", `%${mol}%`)
        .limit(1)
        .maybeSingle();

      if (molData) {
        await supabase.from("medicaments")
          .update({ est_otc: true, est_produit_conseil: true, est_eligible_comme_complementaire: true })
          .eq("molecule_id", molData.id);
      }
    }
    stats.molecules_otc_marquees = otcMolecules.length;

    // ============================================
    // ÉTAPE 8: Exclure les médicaments hors scope
    // ============================================
    const excludeKeywords = [
      "chimiothérapie", "immunosuppresseur", "biothérapie", "anticancéreux",
      "antipsychotique", "neuroleptique", "hospitalier",
    ];
    for (const kw of excludeKeywords) {
      await supabase.from("medicaments")
        .update({ statut_officine: "exclu", est_eligible_comme_complementaire: false })
        .ilike("nom_commercial", `%${kw}%`);
    }
    // Also exclude by ATC class (L01 = antineoplastic, L04 = immunosuppressants)
    await supabase.from("medicaments")
      .update({ statut_officine: "exclu", est_eligible_comme_complementaire: false })
      .or("atc_code.like.L01%,atc_code.like.L04%,atc_code.like.N05A%");

    stats.exclusions_appliquees = true as any;

    // Final counts
    const { count: totalProtocoles } = await supabase
      .from("protocole_pathologie").select("*", { count: "exact", head: true });
    const { count: totalSymptomes } = await supabase
      .from("symptomes_officine").select("*", { count: "exact", head: true });
    const { count: totalSymPathLinks } = await supabase
      .from("symptome_pathologie").select("*", { count: "exact", head: true });

    stats.total_protocoles = totalProtocoles || 0;
    stats.total_symptomes = totalSymptomes || 0;
    stats.total_liens_symptome_pathologie = totalSymPathLinks || 0;

    return new Response(JSON.stringify({
      success: true,
      message: "Base clinique officinale peuplée avec succès",
      stats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
