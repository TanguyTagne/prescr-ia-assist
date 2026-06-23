import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// PHASE 2: PROTOCOLES OFFICINAUX SUPPLÉMENTAIRES
// ============================================

const ADDITIONAL_SYMPTOMES = [
  { nom: "aphtes", desc: "Ulcérations buccales douloureuses" },
  { nom: "mal de dos", desc: "Lombalgie ou dorsalgie bénigne" },
  { nom: "piqûre d'insecte", desc: "Réaction locale à une piqûre" },
  { nom: "coup de soleil", desc: "Érythème solaire" },
  { nom: "ballonnements", desc: "Sensation de gonflement abdominal" },
  { nom: "crampes", desc: "Contractions musculaires involontaires douloureuses" },
  { nom: "règles douloureuses", desc: "Dysménorrhée primaire" },
  { nom: "herpès labial", desc: "Bouton de fièvre" },
  { nom: "verrues", desc: "Verrues vulgaires ou plantaires" },
  { nom: "eczéma", desc: "Dermatite atopique légère" },
  { nom: "poux", desc: "Pédiculose du cuir chevelu" },
  { nom: "otite externe", desc: "Inflammation du conduit auditif externe" },
  { nom: "saignement de nez", desc: "Épistaxis bénigne" },
  { nom: "hoquet", desc: "Contractions spasmodiques du diaphragme" },
  { nom: "mal des transports", desc: "Cinétose, nausées liées au mouvement" },
  { nom: "sécheresse cutanée", desc: "Xérose, peau sèche" },
  { nom: "chute de cheveux", desc: "Alopécie diffuse réactionnelle" },
  { nom: "ongle incarné", desc: "Onychocryptose légère" },
  { nom: "cors et durillons", desc: "Hyperkératose mécanique du pied" },
  { nom: "gerçures lèvres", desc: "Chéilite sèche, lèvres gercées" },
];

const ADDITIONAL_PROTOCOLES = [
  {
    pathologie: "Acné",
    categorie: "dermatologie",
    description: "Acné légère à modérée, comédons et pustules",
    niveau_gravite: 1,
    symptomes: ["irritation cutanée"],
    conseils: [
      { code: "ACNE_01", label: "Nettoyer sans agresser", desc: "Utiliser un nettoyant doux matin et soir, ne pas toucher les boutons" },
      { code: "ACNE_02", label: "Hydrater avec un soin adapté", desc: "Crème non comédogène, éviter les textures grasses" },
    ],
    produits: [
      { nom: "Gel nettoyant purifiant", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Nettoie en profondeur sans dessécher la peau acnéique", prio: 90 },
      { nom: "Crème anti-imperfections", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Traitement local des boutons et comédons", prio: 75 },
      { nom: "Complément zinc", type: "complement", cat: "dermatologie", est_compl: true, just: "Le zinc contribue au maintien d'une peau normale", prio: 55 },
    ],
  },
  {
    pathologie: "Aphtes",
    categorie: "ORL",
    description: "Ulcérations aphteuses buccales bénignes",
    niveau_gravite: 1,
    symptomes: ["aphtes", "gorge irritée"],
    conseils: [
      { code: "APHT_01", label: "Éviter les aliments irritants", desc: "Limiter noix, fromage, agrumes, épices et aliments acides" },
      { code: "APHT_02", label: "Bains de bouche doux", desc: "Rinçage à l'eau salée tiède 2 à 3 fois par jour" },
    ],
    produits: [
      { nom: "Gel buccal protecteur", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Forme un film protecteur sur l'aphte pour calmer la douleur", prio: 90 },
      { nom: "Bain de bouche antiseptique", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Désinfecte et favorise la cicatrisation", prio: 70 },
      { nom: "Complément vitamine B", type: "complement", cat: "vitalité", est_compl: true, just: "Les carences en B12 favorisent les aphtes récidivants", prio: 50 },
    ],
  },
  {
    pathologie: "Arthrose",
    categorie: "rhumatologie",
    description: "Douleurs articulaires dégénératives chroniques",
    niveau_gravite: 2,
    symptomes: ["douleurs musculaires", "douleur légère"],
    conseils: [
      { code: "ARTH_01", label: "Maintenir une activité physique douce", desc: "Marche, natation ou vélo pour préserver la mobilité articulaire" },
      { code: "ARTH_02", label: "Protéger les articulations", desc: "Éviter les efforts répétés, utiliser des aides techniques si besoin" },
    ],
    produits: [
      { nom: "Complément glucosamine-chondroïtine", type: "complement", cat: "rhumatologie", est_compl: true, just: "Contribue au maintien du cartilage articulaire", prio: 90 },
      { nom: "Gel anti-inflammatoire local", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Soulagement local ciblé des douleurs articulaires", prio: 75 },
      { nom: "Complément collagène marin", type: "complement", cat: "rhumatologie", est_compl: true, just: "Soutient la structure du cartilage et des tendons", prio: 55 },
    ],
  },
  {
    pathologie: "Ballonnements et gaz",
    categorie: "gastro-entérologie",
    description: "Météorisme abdominal fonctionnel",
    niveau_gravite: 1,
    symptomes: ["ballonnements", "digestion difficile"],
    conseils: [
      { code: "BALL_01", label: "Manger lentement", desc: "Mastiquer soigneusement, éviter de parler en mangeant" },
      { code: "BALL_02", label: "Limiter les aliments fermentescibles", desc: "Réduire choux, légumineuses, boissons gazeuses" },
    ],
    produits: [
      { nom: "Charbon végétal activé", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Absorbe les gaz intestinaux et réduit les ballonnements", prio: 90 },
      { nom: "Siméticone", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Anti-mousse qui fragmente les bulles de gaz", prio: 70 },
      { nom: "Probiotiques digestion", type: "complement", cat: "microbiote", est_compl: true, just: "Rééquilibre la flore intestinale et réduit la fermentation", prio: 55 },
    ],
  },
  {
    pathologie: "Bronchite aiguë",
    categorie: "pneumologie",
    description: "Inflammation aiguë des bronches d'origine virale",
    niveau_gravite: 2,
    symptomes: ["toux grasse", "fièvre"],
    conseils: [
      { code: "BRON_01", label: "Repos et hydratation", desc: "Se reposer et boire au moins 2L d'eau par jour" },
      { code: "BRON_02", label: "Humidifier l'air", desc: "Utiliser un humidificateur ou poser un bol d'eau près du radiateur" },
    ],
    produits: [
      { nom: "Sirop expectorant", type: "produit_conseil", cat: "toux", est_otc: true, just: "Facilite l'expectoration des sécrétions bronchiques", prio: 90 },
      { nom: "Pastilles miel-eucalyptus", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Apaise la gorge irritée par la toux", prio: 70 },
      { nom: "Inhalation huiles essentielles", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Dégage les voies respiratoires naturellement", prio: 50 },
    ],
  },
  {
    pathologie: "Brûlure légère",
    categorie: "dermatologie",
    description: "Brûlure du premier degré ou coup de soleil",
    niveau_gravite: 1,
    symptomes: ["coup de soleil", "irritation cutanée"],
    conseils: [
      { code: "BRUL_L01", label: "Refroidir sous l'eau", desc: "Passer la zone sous l'eau froide 10 à 15 minutes" },
      { code: "BRUL_L02", label: "Protéger la zone", desc: "Ne pas percer les cloques, couvrir d'un pansement stérile" },
    ],
    produits: [
      { nom: "Biafine ou émulsion apaisante", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Soulage la brûlure et favorise la cicatrisation", prio: 95 },
      { nom: "Spray apaisant après-soleil", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Hydrate et calme la peau brûlée par le soleil", prio: 70 },
      { nom: "Pansement hydrocolloïde", type: "dispositif_medical", cat: "pansements", est_dm: true, just: "Protection optimale en milieu humide pour la cicatrisation", prio: 50 },
    ],
  },
  {
    pathologie: "Candidose vaginale",
    categorie: "gynécologie",
    description: "Mycose vulvo-vaginale à Candida",
    niveau_gravite: 1,
    symptomes: ["mycose superficielle", "irritation cutanée"],
    conseils: [
      { code: "CAND_01", label: "Hygiène intime douce", desc: "Toilette externe uniquement avec un produit à pH adapté" },
      { code: "CAND_02", label: "Sous-vêtements en coton", desc: "Éviter les vêtements serrés et synthétiques" },
    ],
    produits: [
      { nom: "Ovule antifongique", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Traitement local de première intention de la mycose vaginale", prio: 95 },
      { nom: "Crème antifongique externe", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Traitement de la vulvite associée", prio: 70 },
      { nom: "Gel hygiène intime pH alcalin", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Restaure le pH vaginal et prévient les récidives", prio: 50 },
    ],
  },
  {
    pathologie: "Carence en vitamine D",
    categorie: "nutrition",
    description: "Déficit en vitamine D fréquent en hiver",
    niveau_gravite: 1,
    symptomes: ["fatigue passagère"],
    conseils: [
      { code: "VITD_01", label: "Exposition solaire modérée", desc: "15 à 20 minutes de soleil par jour sur les bras et le visage" },
      { code: "VITD_02", label: "Alimentation enrichie", desc: "Privilégier poissons gras, œufs, produits laitiers enrichis" },
    ],
    produits: [
      { nom: "Vitamine D3 gouttes", type: "complement", cat: "vitamines", est_compl: true, just: "Supplémentation quotidienne pratique et bien dosée", prio: 95 },
      { nom: "Vitamine D3 ampoule", type: "complement", cat: "vitamines", est_compl: true, just: "Dose de charge pour corriger un déficit avéré", prio: 70 },
      { nom: "Complément calcium + vitamine D", type: "complement", cat: "os", est_compl: true, just: "Association synergique pour la santé osseuse", prio: 50 },
    ],
  },
  {
    pathologie: "Céphalées",
    categorie: "neurologie",
    description: "Céphalées de tension ou migraines légères",
    niveau_gravite: 1,
    symptomes: ["maux de tête", "stress léger"],
    conseils: [
      { code: "CEPH_V2_01", label: "Identifier les facteurs déclenchants", desc: "Tenir un journal des céphalées pour repérer les déclencheurs" },
      { code: "CEPH_V2_02", label: "Repos et relaxation", desc: "S'allonger dans un endroit calme et sombre" },
    ],
    produits: [
      { nom: "Stick menthe poivrée tempes", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Soulagement rapide par application locale rafraîchissante", prio: 85 },
      { nom: "Complément magnésium", type: "complement", cat: "vitalité", est_compl: true, just: "Le magnésium aide à prévenir les céphalées de tension", prio: 70 },
      { nom: "Masque relaxant yeux", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Détente musculaire pour apaiser les tensions", prio: 50 },
    ],
  },
  {
    pathologie: "Congestion nasale",
    categorie: "ORL",
    description: "Nez bouché d'origine infectieuse ou allergique",
    niveau_gravite: 1,
    symptomes: ["nez bouché", "rhume"],
    conseils: [
      { code: "CONG_01", label: "Lavage nasal fréquent", desc: "3 à 4 lavages par jour pour désencombrer les fosses nasales" },
      { code: "CONG_02", label: "Surélever la tête la nuit", desc: "Dormir avec un oreiller supplémentaire pour faciliter le drainage" },
    ],
    produits: [
      { nom: "Spray nasal eau de mer hypertonique", type: "dispositif_medical", cat: "ORL", est_dm: true, just: "Décongestionne par effet osmotique naturel", prio: 90 },
      { nom: "Inhalateur aux huiles essentielles", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Libère les voies respiratoires par inhalation", prio: 70 },
      { nom: "Sérum physiologique unidose", type: "dispositif_medical", cat: "hygiène nasale", est_dm: true, just: "Lavage nasal doux adapté à toute la famille", prio: 55 },
    ],
  },
  {
    pathologie: "Conjonctivite allergique",
    categorie: "ophtalmologie",
    description: "Inflammation oculaire d'origine allergique",
    niveau_gravite: 1,
    symptomes: ["yeux irrités", "allergies saisonnières"],
    conseils: [
      { code: "CONJ_01", label: "Ne pas se frotter les yeux", desc: "Le frottement aggrave l'inflammation et le prurit" },
      { code: "CONJ_02", label: "Rincer les yeux régulièrement", desc: "Utiliser du sérum physiologique pour éliminer les allergènes" },
    ],
    produits: [
      { nom: "Collyre antiallergique", type: "produit_conseil", cat: "ophtalmologie", est_otc: true, just: "Soulage le prurit et le larmoiement allergique", prio: 95 },
      { nom: "Compresses oculaires apaisantes", type: "dispositif_medical", cat: "ophtalmologie", est_dm: true, just: "Décongestionne et apaise les paupières gonflées", prio: 70 },
      { nom: "Sérum physiologique unidose", type: "dispositif_medical", cat: "ophtalmologie", est_dm: true, just: "Rinçage oculaire pour éliminer les allergènes", prio: 50 },
    ],
  },
  {
    pathologie: "Constipation",
    categorie: "gastro-entérologie",
    description: "Transit intestinal ralenti",
    niveau_gravite: 1,
    symptomes: ["constipation"],
    conseils: [
      { code: "CONS_V2_01", label: "Enrichir l'alimentation en fibres", desc: "Fruits, légumes, céréales complètes, pruneaux" },
      { code: "CONS_V2_02", label: "Activité physique régulière", desc: "30 minutes de marche par jour stimulent le transit" },
    ],
    produits: [
      { nom: "Laxatif osmotique doux", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Régule le transit sans irritation intestinale", prio: 90 },
      { nom: "Complément fibres psyllium", type: "complement", cat: "transit", est_compl: true, just: "Fibres solubles qui augmentent le volume des selles", prio: 70 },
      { nom: "Eau riche en magnésium", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Le magnésium a un effet laxatif osmotique naturel", prio: 50 },
    ],
  },
  {
    pathologie: "Coup de soleil",
    categorie: "dermatologie",
    description: "Érythème actinique, brûlure solaire du 1er degré",
    niveau_gravite: 1,
    symptomes: ["coup de soleil", "irritation cutanée"],
    conseils: [
      { code: "SOLE_01", label: "Cesser l'exposition", desc: "Rester à l'ombre et ne plus s'exposer tant que la peau est rouge" },
      { code: "SOLE_02", label: "Bien s'hydrater", desc: "Boire abondamment et hydrater la peau plusieurs fois par jour" },
    ],
    produits: [
      { nom: "Lait après-soleil apaisant", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Hydrate, apaise et répare la peau brûlée par le soleil", prio: 90 },
      { nom: "Biafine émulsion", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Référence pour le traitement des brûlures cutanées légères", prio: 75 },
      { nom: "Brumisateur eau thermale", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Rafraîchit et apaise instantanément la peau", prio: 55 },
    ],
  },
  {
    pathologie: "Crampes musculaires",
    categorie: "rhumatologie",
    description: "Contractions musculaires involontaires douloureuses",
    niveau_gravite: 1,
    symptomes: ["crampes", "douleurs musculaires"],
    conseils: [
      { code: "CRAM_01", label: "Étirer le muscle", desc: "Étirement doux et prolongé du muscle contracté" },
      { code: "CRAM_02", label: "S'hydrater correctement", desc: "La déshydratation est une cause fréquente de crampes" },
    ],
    produits: [
      { nom: "Complément magnésium marin", type: "complement", cat: "vitalité", est_compl: true, just: "Le magnésium contribue à la fonction musculaire normale", prio: 95 },
      { nom: "Gel décontracturant", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Soulage les tensions musculaires par application locale", prio: 70 },
      { nom: "Eau riche en magnésium", type: "produit_conseil", cat: "hydratation", est_otc: true, just: "Apport hydrique + minéral pour prévenir les récidives", prio: 50 },
    ],
  },
  {
    pathologie: "Cystite",
    categorie: "urologie",
    description: "Infection urinaire basse non compliquée",
    niveau_gravite: 2,
    symptomes: ["cystite légère"],
    conseils: [
      { code: "CYST_V2_01", label: "Boire abondamment", desc: "Au moins 2L par jour pour favoriser l'élimination bactérienne" },
      { code: "CYST_V2_02", label: "Uriner régulièrement", desc: "Ne pas se retenir, uriner après les rapports sexuels" },
    ],
    produits: [
      { nom: "Cranberry concentré", type: "complement", cat: "urologie", est_compl: true, just: "Prévient l'adhésion des bactéries sur les parois urinaires", prio: 90 },
      { nom: "D-Mannose", type: "complement", cat: "urologie", est_compl: true, just: "Anti-adhésion bactérienne naturel urinaire", prio: 75 },
      { nom: "Probiotiques flore intime", type: "complement", cat: "gynécologie", est_compl: true, just: "Rééquilibre la flore vaginale pour prévenir les récidives", prio: 55 },
    ],
  },
  {
    pathologie: "Diarrhée aiguë",
    categorie: "gastro-entérologie",
    description: "Épisode de selles liquides fréquentes",
    niveau_gravite: 2,
    symptomes: ["diarrhée", "nausées"],
    conseils: [
      { code: "DIAR_V2_01", label: "Réhydratation orale", desc: "Boire par petites gorgées fréquentes, solutions de réhydratation" },
      { code: "DIAR_V2_02", label: "Alimentation adaptée", desc: "Riz, carottes cuites, bananes, éviter laitages" },
    ],
    produits: [
      { nom: "Solution de réhydratation orale", type: "produit_conseil", cat: "réhydratation", est_otc: true, just: "Compense les pertes en eau et électrolytes", prio: 95 },
      { nom: "Probiotiques Saccharomyces", type: "complement", cat: "microbiote", est_compl: true, just: "Souche spécifiquement efficace dans la diarrhée aiguë", prio: 75 },
      { nom: "Racécadotril", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Antisécrétoire intestinal sans ralentir le transit", prio: 55 },
    ],
  },
  {
    pathologie: "Douleur articulaire",
    categorie: "rhumatologie",
    description: "Douleur articulaire mécanique ou inflammatoire légère",
    niveau_gravite: 1,
    symptomes: ["douleurs musculaires", "douleur légère"],
    conseils: [
      { code: "DART_01", label: "Alterner chaud et froid", desc: "Froid en cas d'inflammation aiguë, chaud pour les douleurs chroniques" },
      { code: "DART_02", label: "Maintenir le mouvement", desc: "Activité physique douce pour préserver la mobilité" },
    ],
    produits: [
      { nom: "Gel anti-inflammatoire local", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Action anti-inflammatoire ciblée sur l'articulation", prio: 90 },
      { nom: "Complément curcuma", type: "complement", cat: "rhumatologie", est_compl: true, just: "Anti-inflammatoire naturel pour le confort articulaire", prio: 70 },
      { nom: "Genouillère ou orthèse légère", type: "dispositif_medical", cat: "orthopédie", est_dm: true, just: "Soutien articulaire et réduction de la douleur au mouvement", prio: 50 },
    ],
  },
  {
    pathologie: "Douleur légère",
    categorie: "douleur",
    description: "Douleur d'intensité faible à modérée",
    niveau_gravite: 1,
    symptomes: ["douleur légère", "maux de tête"],
    conseils: [
      { code: "DLEG_01", label: "Repos et position antalgique", desc: "Trouver la position qui soulage, appliquer du froid si gonflement" },
      { code: "DLEG_02", label: "Respecter les doses d'antalgiques", desc: "Ne pas dépasser les doses recommandées, espacer les prises" },
    ],
    produits: [
      { nom: "Paracétamol 1g", type: "produit_conseil", cat: "antalgique", est_otc: true, just: "Antalgique de première intention, bien toléré", prio: 90 },
      { nom: "Poche de froid réutilisable", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Anti-inflammatoire naturel par cryothérapie locale", prio: 70 },
      { nom: "Baume du tigre", type: "produit_conseil", cat: "confort", est_otc: true, just: "Soulagement local par effet chaud-froid", prio: 50 },
    ],
  },
  {
    pathologie: "Eczéma léger",
    categorie: "dermatologie",
    description: "Dermatite atopique ou de contact légère",
    niveau_gravite: 1,
    symptomes: ["eczéma", "irritation cutanée", "sécheresse cutanée"],
    conseils: [
      { code: "ECZE_01", label: "Hydrater intensément", desc: "Appliquer un émollient 1 à 2 fois par jour, même hors poussée" },
      { code: "ECZE_02", label: "Éviter les irritants", desc: "Savons doux, lessives hypoallergéniques, vêtements en coton" },
    ],
    produits: [
      { nom: "Crème émolliente relipidante", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Restaure la barrière cutanée et prévient les poussées", prio: 95 },
      { nom: "Huile de bain émolliente", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Protège la peau pendant le bain sans la dessécher", prio: 70 },
      { nom: "Syndet sans savon", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Nettoyant doux qui respecte la barrière cutanée", prio: 50 },
    ],
  },
  {
    pathologie: "Herpès labial",
    categorie: "dermatologie",
    description: "Bouton de fièvre à HSV-1",
    niveau_gravite: 1,
    symptomes: ["herpès labial"],
    conseils: [
      { code: "HERP_01", label: "Appliquer dès les picotements", desc: "Le traitement est d'autant plus efficace qu'il est précoce" },
      { code: "HERP_02", label: "Éviter la contagion", desc: "Ne pas toucher le bouton, ne pas partager verre ou serviette" },
    ],
    produits: [
      { nom: "Crème antivirale aciclovir", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Raccourcit la durée et l'intensité de la poussée herpétique", prio: 95 },
      { nom: "Patch invisible herpès", type: "dispositif_medical", cat: "dermatologie", est_dm: true, just: "Protège, masque et crée un environnement de cicatrisation", prio: 70 },
      { nom: "Stick lèvres cicatrisant SPF", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Protection solaire et cicatrisation de la lèvre", prio: 50 },
    ],
  },
  {
    pathologie: "Mal des transports",
    categorie: "neurologie",
    description: "Cinétose liée aux déplacements",
    niveau_gravite: 1,
    symptomes: ["mal des transports", "nausées"],
    conseils: [
      { code: "TRAN_01", label: "Fixer l'horizon", desc: "Regarder au loin dans le sens de la marche, éviter la lecture" },
      { code: "TRAN_02", label: "Anticiper le trajet", desc: "Prendre le traitement 30 min avant le départ, manger léger" },
    ],
    produits: [
      { nom: "Antinaupathique diménhydrinate", type: "produit_conseil", cat: "neurologie", est_otc: true, just: "Prévention efficace du mal des transports", prio: 90 },
      { nom: "Bracelet anti-nausées", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Acupression du point P6, sans effet secondaire", prio: 70 },
      { nom: "Gingembre gélules", type: "complement", cat: "digestion", est_compl: true, just: "Anti-nauséeux naturel bien toléré", prio: 50 },
    ],
  },
  {
    pathologie: "Pédiculose",
    categorie: "parasitologie",
    description: "Infestation par les poux du cuir chevelu",
    niveau_gravite: 1,
    symptomes: ["poux"],
    conseils: [
      { code: "POUX_01", label: "Traiter toute la famille", desc: "Vérifier et traiter tous les membres du foyer simultanément" },
      { code: "POUX_02", label: "Laver le linge à 60°C", desc: "Draps, bonnets, écharpes. Congeler ce qui ne se lave pas" },
    ],
    produits: [
      { nom: "Lotion anti-poux à base de diméticone", type: "produit_conseil", cat: "parasitologie", est_otc: true, just: "Étouffe les poux et les lentes par action mécanique", prio: 95 },
      { nom: "Peigne anti-poux métallique", type: "dispositif_medical", cat: "parasitologie", est_dm: true, just: "Indispensable pour retirer les lentes après traitement", prio: 80 },
      { nom: "Spray répulsif préventif", type: "produit_conseil", cat: "parasitologie", est_otc: true, just: "Prévient la réinfestation en milieu scolaire", prio: 55 },
    ],
  },
  {
    pathologie: "Piqûre d'insecte",
    categorie: "dermatologie",
    description: "Réaction locale à une piqûre de moustique, guêpe ou autre",
    niveau_gravite: 1,
    symptomes: ["piqûre d'insecte", "irritation cutanée"],
    conseils: [
      { code: "PIQU_01", label: "Désinfecter la zone", desc: "Nettoyer la piqûre avec un antiseptique, ne pas gratter" },
      { code: "PIQU_02", label: "Surveiller les réactions", desc: "Consulter si gonflement étendu, fièvre ou réaction allergique" },
    ],
    produits: [
      { nom: "Roll-on apaisant après-piqûres", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Soulage démangeaison et gonflement rapidement", prio: 90 },
      { nom: "Crème antihistaminique locale", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Réduit la réaction inflammatoire locale", prio: 70 },
      { nom: "Aspivenin", type: "dispositif_medical", cat: "premier secours", est_dm: true, just: "Pompe à venin pour extraction immédiate après piqûre", prio: 50 },
    ],
  },
  {
    pathologie: "Règles douloureuses",
    categorie: "gynécologie",
    description: "Dysménorrhée primaire fonctionnelle",
    niveau_gravite: 1,
    symptomes: ["règles douloureuses", "douleur légère"],
    conseils: [
      { code: "DYSM_01", label: "Appliquer de la chaleur", desc: "Bouillotte sur le bas-ventre pour détendre les muscles utérins" },
      { code: "DYSM_02", label: "Activité physique douce", desc: "Marche, yoga ou étirements pour réduire les crampes" },
    ],
    produits: [
      { nom: "Ibuprofène 200mg", type: "produit_conseil", cat: "antalgique", est_otc: true, just: "Anti-inflammatoire de référence pour les dysménorrhées", prio: 90 },
      { nom: "Patch chauffant ventre", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Chaleur continue qui détend les muscles utérins", prio: 75 },
      { nom: "Complément magnésium + vitamine B6", type: "complement", cat: "vitalité", est_compl: true, just: "Réduit les crampes et le syndrome prémenstruel", prio: 55 },
    ],
  },
  {
    pathologie: "Sécheresse cutanée",
    categorie: "dermatologie",
    description: "Xérose, peau sèche inconfortable",
    niveau_gravite: 1,
    symptomes: ["sécheresse cutanée", "irritation cutanée"],
    conseils: [
      { code: "XERO_01", label: "Hydrater matin et soir", desc: "Appliquer un émollient sur peau légèrement humide" },
      { code: "XERO_02", label: "Limiter les douches longues", desc: "Eau tiède, pas trop chaude, durée limitée" },
    ],
    produits: [
      { nom: "Crème hydratante corps riche", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Hydratation longue durée et restauration de la barrière cutanée", prio: 90 },
      { nom: "Huile de douche relipidante", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Nettoie sans dessécher, dépose un film protecteur", prio: 70 },
      { nom: "Complément oméga-3 / huile d'onagre", type: "complement", cat: "dermatologie", est_compl: true, just: "Nourrit la peau de l'intérieur, réduit la sécheresse", prio: 50 },
    ],
  },
  {
    pathologie: "Verrues",
    categorie: "dermatologie",
    description: "Verrues vulgaires ou plantaires à HPV",
    niveau_gravite: 1,
    symptomes: ["verrues"],
    conseils: [
      { code: "VERR_01", label: "Ne pas arracher", desc: "Ne pas gratter ou couper la verrue pour éviter la dissémination" },
      { code: "VERR_02", label: "Protéger en piscine", desc: "Porter des sandales, couvrir la verrue avec un pansement" },
    ],
    produits: [
      { nom: "Solution kératolytique acide salicylique", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Destruction progressive de la verrue couche par couche", prio: 90 },
      { nom: "Stylo cryothérapie", type: "dispositif_medical", cat: "dermatologie", est_dm: true, just: "Traitement par le froid à domicile, efficace et rapide", prio: 75 },
      { nom: "Pansements protecteurs verrues", type: "dispositif_medical", cat: "pansements", est_dm: true, just: "Protège la verrue et empêche la dissémination", prio: 50 },
    ],
  },
  {
    pathologie: "Angine",
    categorie: "ORL",
    description: "Inflammation aiguë des amygdales, virale dans 80% des cas",
    niveau_gravite: 2,
    symptomes: ["gorge irritée", "fièvre"],
    conseils: [
      { code: "ANGI_01", label: "Test de diagnostic rapide", desc: "Réaliser un TDR streptococcique pour guider le traitement" },
      { code: "ANGI_02", label: "Soulager la douleur", desc: "Boissons tièdes, gargarismes, antalgiques adaptés" },
    ],
    produits: [
      { nom: "Collutoire antiseptique", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Action locale antiseptique et analgésique sur la gorge", prio: 90 },
      { nom: "Pastilles anesthésiantes gorge", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Soulagement rapide de la douleur pharyngée", prio: 70 },
      { nom: "Propolis spray gorge", type: "complement", cat: "ORL", est_compl: true, just: "Propriétés antiseptiques naturelles de la propolis", prio: 50 },
    ],
  },
  {
    pathologie: "Décalage horaire",
    categorie: "médecine générale",
    description: "Jet-lag, désynchronisation du rythme circadien",
    niveau_gravite: 1,
    symptomes: ["insomnie légère", "fatigue passagère"],
    conseils: [
      { code: "JETL_01", label: "S'adapter progressivement", desc: "Décaler ses horaires de 1h par jour avant le départ" },
      { code: "JETL_02", label: "S'exposer à la lumière", desc: "Lumière naturelle le matin pour resynchroniser l'horloge interne" },
    ],
    produits: [
      { nom: "Mélatonine 1mg", type: "complement", cat: "sommeil", est_compl: true, just: "Contribue à atténuer les effets du décalage horaire", prio: 95 },
      { nom: "Masque de sommeil", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Favorise l'obscurité totale pour un endormissement rapide", prio: 65 },
      { nom: "Tisane relaxante valériane", type: "produit_conseil", cat: "phytothérapie", est_otc: true, just: "Favorise la détente et l'endormissement naturel", prio: 45 },
    ],
  },
  {
    pathologie: "Otite externe",
    categorie: "ORL",
    description: "Inflammation du conduit auditif externe (oreille du nageur)",
    niveau_gravite: 1,
    symptomes: ["otite externe"],
    conseils: [
      { code: "OTIT_01", label: "Garder l'oreille sèche", desc: "Éviter la baignade, sécher l'oreille après la douche" },
      { code: "OTIT_02", label: "Ne pas utiliser de coton-tige", desc: "Risque de traumatisme et d'aggravation de l'infection" },
    ],
    produits: [
      { nom: "Gouttes auriculaires antiseptiques", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Traitement local de l'infection du conduit auditif", prio: 90 },
      { nom: "Spray nettoyant auriculaire", type: "dispositif_medical", cat: "ORL", est_dm: true, just: "Hygiène douce du conduit auditif sans traumatisme", prio: 70 },
      { nom: "Bouchons d'oreilles waterproof", type: "dispositif_medical", cat: "ORL", est_dm: true, just: "Protection pendant la douche ou la baignade", prio: 50 },
    ],
  },
  {
    pathologie: "Chute de cheveux",
    categorie: "dermatologie",
    description: "Alopécie diffuse réactionnelle",
    niveau_gravite: 1,
    symptomes: ["chute de cheveux", "fatigue passagère"],
    conseils: [
      { code: "CHEV_01", label: "Identifier la cause", desc: "Stress, carence en fer, changement de saison sont des causes fréquentes" },
      { code: "CHEV_02", label: "Adopter un shampoing doux", desc: "Éviter les shampoings agressifs, ne pas frotter le cuir chevelu" },
    ],
    produits: [
      { nom: "Complément cheveux biotine-cystine", type: "complement", cat: "dermatologie", est_compl: true, just: "Renforce la kératine et favorise la croissance capillaire", prio: 90 },
      { nom: "Lotion anti-chute", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Stimule la microcirculation au niveau du bulbe capillaire", prio: 75 },
      { nom: "Complément fer + vitamine C", type: "complement", cat: "vitalité", est_compl: true, just: "La carence en fer est une cause fréquente de chute de cheveux", prio: 55 },
    ],
  },
  {
    pathologie: "Anxiété légère",
    categorie: "psychiatrie",
    description: "Nervosité et anxiété passagères sans trouble psychiatrique",
    niveau_gravite: 1,
    symptomes: ["stress léger", "insomnie légère"],
    conseils: [
      { code: "ANXI_01", label: "Exercices de respiration", desc: "Cohérence cardiaque : 5 secondes inspir, 5 secondes expir, 5 minutes" },
      { code: "ANXI_02", label: "Limiter les excitants", desc: "Réduire café, thé, alcool et écrans avant le coucher" },
    ],
    produits: [
      { nom: "Complément magnésium marin", type: "complement", cat: "stress", est_compl: true, just: "Le magnésium contribue au fonctionnement normal du système nerveux", prio: 90 },
      { nom: "Gélules de passiflore", type: "complement", cat: "phytothérapie", est_compl: true, just: "Anxiolytique naturel sans effet de somnolence", prio: 75 },
      { nom: "Huile essentielle lavande vraie", type: "produit_conseil", cat: "aromathérapie", est_otc: true, just: "Apaisement et relaxation par voie olfactive", prio: 50 },
    ],
  },
  {
    pathologie: "Coliques du nourrisson",
    categorie: "pédiatrie",
    description: "Pleurs excessifs du nourrisson liés à des douleurs abdominales",
    niveau_gravite: 1,
    symptomes: ["ballonnements"],
    conseils: [
      { code: "COLI_01", label: "Position anti-coliques", desc: "Bébé sur l'avant-bras, ventre vers le bas, massage circulaire" },
      { code: "COLI_02", label: "Rassurer les parents", desc: "Les coliques sont bénignes et disparaissent vers 3-4 mois" },
    ],
    produits: [
      { nom: "Eau de chaux + eau de riz", type: "produit_conseil", cat: "pédiatrie", est_otc: true, just: "Formule traditionnelle apaisante pour le ventre du nourrisson", prio: 85 },
      { nom: "Probiotiques nourrisson L. reuteri", type: "complement", cat: "microbiote", est_compl: true, just: "Souche spécifiquement étudiée dans les coliques du nourrisson", prio: 75 },
      { nom: "Tétine anti-colique", type: "dispositif_medical", cat: "pédiatrie", est_dm: true, just: "Réduit l'ingestion d'air pendant les tétées", prio: 50 },
    ],
  },
];

// Pathologies à marquer hors scope (urgence/hospitalier)
const PATHOLOGIES_HORS_SCOPE = [
  "Choc anaphylactique", "Diabète type 1", "Diabète insipide", "BPCO",
  "Dépression", "Angor", "Épilepsie", "Insuffisance cardiaque",
  "Insuffisance rénale", "Hypothyroïdie", "Hyperthyroïdie",
  "Sclérose en plaques", "Polyarthrite rhumatoïde", "Lupus",
  "Maladie de Crohn", "Rectocolite hémorragique",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Admin auth guard ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
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
    const adminCheckClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminCheckClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stats: Record<string, number> = {};
    let errors: string[] = [];

    // ============================================
    // ÉTAPE 0: Ajouter symptômes supplémentaires
    // ============================================
    for (const s of ADDITIONAL_SYMPTOMES) {
      await supabase.from("symptomes_officine").upsert(
        { nom_symptome: s.nom, description: s.desc },
        { onConflict: "nom_symptome" }
      );
    }
    stats.symptomes_ajoutes = ADDITIONAL_SYMPTOMES.length;

    const { data: allSymptomes } = await supabase.from("symptomes_officine").select("id, nom_symptome");
    const symptomeMap = new Map((allSymptomes || []).map((s: any) => [s.nom_symptome, s.id]));

    // ============================================
    // ÉTAPE 1: Créer protocoles pour chaque pathologie
    // ============================================
    let protocolesCreated = 0;

    for (const pp of ADDITIONAL_PROTOCOLES) {
      try {
        // Find or create pathology
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
          }).eq("id", pathologieId);
        } else {
          const { data: newP } = await supabase.from("pathologies").insert({
            nom_pathologie: pp.pathologie,
            categorie: pp.categorie,
            description: pp.description,
            niveau_gravite: pp.niveau_gravite,
            orientation_urgence: false,
          }).select("id").single();
          if (!newP) { errors.push(`Failed to create pathologie: ${pp.pathologie}`); continue; }
          pathologieId = newP.id;
        }

        // Skip if protocol already exists
        const { data: existingProto } = await supabase
          .from("protocole_pathologie")
          .select("id")
          .eq("pathologie_id", pathologieId)
          .eq("actif", true)
          .maybeSingle();
        
        if (existingProto) continue;

        // Link symptoms
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

        // Create conseils
        const conseilIds: string[] = [];
        for (const conseil of pp.conseils) {
          const { data: existingC } = await supabase
            .from("conseils_associes")
            .select("id")
            .eq("pathologie_id", pathologieId)
            .eq("conseil_code", conseil.code)
            .maybeSingle();

          if (existingC) {
            conseilIds.push(existingC.id);
          } else {
            const { data: newC } = await supabase.from("conseils_associes").insert({
              pathologie_id: pathologieId,
              conseil_code: conseil.code,
              conseil: conseil.label,
              description: conseil.desc,
              priorite: 80,
            }).select("id").single();
            if (newC) conseilIds.push(newC.id);
          }
        }

        // Create produits
        const produitIds: string[] = [];
        for (const prod of pp.produits) {
          const { data: existingP } = await supabase
            .from("produits_complementaires")
            .select("id")
            .eq("pathologie_id", pathologieId)
            .ilike("produit", prod.nom)
            .maybeSingle();

          if (existingP) {
            produitIds.push(existingP.id);
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
            if (newP) produitIds.push(newP.id);
          }
        }

        // Create protocole
        if (conseilIds.length >= 2 && produitIds.length >= 3) {
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
          protocolesCreated++;
        } else {
          errors.push(`Incomplete protocol for ${pp.pathologie}: ${conseilIds.length} conseils, ${produitIds.length} produits`);
        }
      } catch (e) {
        errors.push(`Error for ${pp.pathologie}: ${e.message}`);
      }
    }
    stats.protocoles_crees = protocolesCreated;

    // ============================================
    // ÉTAPE 2: Marquer pathologies hors scope
    // ============================================
    let horsScope = 0;
    for (const nom of PATHOLOGIES_HORS_SCOPE) {
      const { data } = await supabase
        .from("pathologies")
        .update({ orientation_urgence: true, niveau_gravite: 4 })
        .ilike("nom_pathologie", nom)
        .select("id");
      if (data?.length) horsScope++;
    }
    stats.pathologies_hors_scope = horsScope;

    // ============================================
    // ÉTAPE 3: Peupler medicament_pathologie
    // ============================================
    // For each OTC medicament, link to pathologies via molecule
    const { data: otcMeds } = await supabase
      .from("medicaments")
      .select("id, molecule_id, nom_commercial")
      .eq("est_otc", true)
      .not("molecule_id", "is", null);

    let medPathLinks = 0;
    for (const med of otcMeds || []) {
      // Get pathologies from molecule_pathologie
      const { data: molPaths } = await supabase
        .from("molecule_pathologie")
        .select("pathologie_id, score_pertinence")
        .eq("molecule_id", med.molecule_id);

      for (const mp of molPaths || []) {
        const { error } = await supabase.from("medicament_pathologie").upsert({
          medicament_id: med.id,
          pathologie_id: mp.pathologie_id,
          score_pertinence: mp.score_pertinence || 50,
          source_mapping: "molecule_bridge",
        }, { onConflict: "medicament_id,pathologie_id" });
        if (!error) medPathLinks++;
      }
    }
    stats.medicament_pathologie_liens = medPathLinks;

    // ============================================
    // Final counts
    // ============================================
    const { count: totalProtocoles } = await supabase
      .from("protocole_pathologie").select("*", { count: "exact", head: true });
    const { count: totalSymptomes } = await supabase
      .from("symptomes_officine").select("*", { count: "exact", head: true });
    const { count: totalSymPathLinks } = await supabase
      .from("symptome_pathologie").select("*", { count: "exact", head: true });
    const { count: totalMedPath } = await supabase
      .from("medicament_pathologie").select("*", { count: "exact", head: true });
    const { count: totalConseils } = await supabase
      .from("conseils_associes").select("*", { count: "exact", head: true });
    const { count: totalProduits } = await supabase
      .from("produits_complementaires").select("*", { count: "exact", head: true });

    stats.totals = {
      protocoles: totalProtocoles || 0,
      symptomes: totalSymptomes || 0,
      liens_symptome_pathologie: totalSymPathLinks || 0,
      liens_medicament_pathologie: totalMedPath || 0,
      conseils: totalConseils || 0,
      produits: totalProduits || 0,
    } as any;

    return new Response(JSON.stringify({
      success: true,
      message: "Phase 2: protocoles supplémentaires + medicament_pathologie peuplés",
      stats,
      errors: errors.length > 0 ? errors : undefined,
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
