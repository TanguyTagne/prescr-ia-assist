import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHASE3_PROTOCOLES = [
  {
    pathologie: "Rhinite allergique",
    categorie: "allergie",
    description: "Inflammation allergique de la muqueuse nasale",
    niveau_gravite: 1,
    conseils: [
      { code: "RHIN_01", label: "Limiter l'exposition aux allergènes", desc: "Aérer tôt le matin, fermer les fenêtres en journée, lunettes de soleil" },
      { code: "RHIN_02", label: "Lavage nasal quotidien", desc: "Sérum physiologique ou spray salin matin et soir" },
    ],
    produits: [
      { nom: "Antihistaminique oral (cétirizine/loratadine)", type: "produit_conseil", cat: "allergie", est_otc: true, just: "Traitement de première intention de la rhinite allergique", prio: 90 },
      { nom: "Spray nasal corticoïde local", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Réduit l'inflammation nasale allergique durablement", prio: 75 },
      { nom: "Sérum physiologique unidose", type: "dispositif_medical", cat: "hygiène nasale", est_dm: true, just: "Élimine les allergènes déposés sur la muqueuse", prio: 55 },
    ],
  },
  {
    pathologie: "Urticaire",
    categorie: "allergie",
    description: "Éruption cutanée prurigineuse en plaques",
    niveau_gravite: 1,
    conseils: [
      { code: "URTI_01", label: "Ne pas gratter", desc: "Appliquer du froid pour calmer les démangeaisons" },
      { code: "URTI_02", label: "Identifier le déclencheur", desc: "Aliment, médicament, stress, froid — consulter si récidivant" },
    ],
    produits: [
      { nom: "Antihistaminique oral cétirizine", type: "produit_conseil", cat: "allergie", est_otc: true, just: "Soulage le prurit et réduit les plaques urticariennes", prio: 90 },
      { nom: "Crème apaisante anti-démangeaisons", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Soulagement local immédiat du prurit", prio: 70 },
      { nom: "Eau thermale en spray", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Apaise et rafraîchit la peau irritée", prio: 50 },
    ],
  },
  {
    pathologie: "Gingivite",
    categorie: "dentaire",
    description: "Inflammation des gencives avec saignement au brossage",
    niveau_gravite: 1,
    conseils: [
      { code: "GING_01", label: "Brossage adapté", desc: "Brosse souple, technique de Bass, 2 minutes minimum" },
      { code: "GING_02", label: "Nettoyage interdentaire", desc: "Fil dentaire ou brossettes interdentaires quotidiennement" },
    ],
    produits: [
      { nom: "Bain de bouche antiseptique chlorhexidine", type: "produit_conseil", cat: "dentaire", est_otc: true, just: "Réduit la plaque bactérienne et l'inflammation gingivale", prio: 90 },
      { nom: "Dentifrice gencives sensibles", type: "produit_conseil", cat: "dentaire", est_otc: true, just: "Formule adaptée aux gencives fragiles", prio: 70 },
      { nom: "Brossettes interdentaires", type: "dispositif_medical", cat: "dentaire", est_dm: true, just: "Nettoyage des espaces inaccessibles à la brosse", prio: 55 },
    ],
  },
  {
    pathologie: "Eczéma",
    categorie: "dermatologie",
    description: "Dermatite atopique avec poussées inflammatoires",
    niveau_gravite: 1,
    conseils: [
      { code: "ECZE_V2_01", label: "Émollient quotidien", desc: "Hydrater la peau 1 à 2 fois par jour même en dehors des poussées" },
      { code: "ECZE_V2_02", label: "Éviter les facteurs déclenchants", desc: "Vêtements en coton, lessive hypoallergénique, éviter le stress" },
    ],
    produits: [
      { nom: "Crème émolliente relipidante", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Restaure la barrière cutanée et prévient les poussées", prio: 95 },
      { nom: "Savon surgras sans savon", type: "produit_conseil", cat: "hygiène", est_otc: true, just: "Nettoie sans agresser la peau atopique", prio: 70 },
      { nom: "Complément probiotiques peau", type: "complement", cat: "dermatologie", est_compl: true, just: "Certaines souches réduisent la sévérité de l'eczéma atopique", prio: 50 },
    ],
  },
  {
    pathologie: "Mycose cutanée",
    categorie: "dermatologie",
    description: "Infection fongique de la peau (pieds, plis)",
    niveau_gravite: 1,
    conseils: [
      { code: "MYCC_01", label: "Sécher soigneusement les plis", desc: "Bien sécher entre les orteils et dans les plis après la toilette" },
      { code: "MYCC_02", label: "Traiter la durée complète", desc: "Poursuivre 1 à 2 semaines après disparition des symptômes" },
    ],
    produits: [
      { nom: "Antifongique local crème", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Traitement de première ligne des mycoses cutanées", prio: 95 },
      { nom: "Poudre antifongique", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Maintient la zone sèche avec action antifongique continue", prio: 70 },
      { nom: "Spray désinfectant chaussures", type: "dispositif_medical", cat: "hygiène", est_dm: true, just: "Prévient la recontamination via les chaussures", prio: 50 },
    ],
  },
  {
    pathologie: "Prurit",
    categorie: "dermatologie",
    description: "Démangeaisons cutanées sans cause identifiée",
    niveau_gravite: 1,
    conseils: [
      { code: "PRUR_01", label: "Hydrater la peau", desc: "Un émollient réduit souvent les démangeaisons liées à la sécheresse" },
      { code: "PRUR_02", label: "Éviter la chaleur", desc: "Douche tiède, vêtements en coton, température fraîche la nuit" },
    ],
    produits: [
      { nom: "Crème anti-démangeaisons", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Soulagement rapide du prurit par action locale", prio: 90 },
      { nom: "Crème émolliente apaisante", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Hydrate et réduit l'irritation cutanée", prio: 70 },
      { nom: "Antihistaminique oral", type: "produit_conseil", cat: "allergie", est_otc: true, just: "Réduit le prurit d'origine histaminique", prio: 55 },
    ],
  },
  {
    pathologie: "Psoriasis",
    categorie: "dermatologie",
    description: "Dermatose chronique avec plaques squameuses",
    niveau_gravite: 2,
    conseils: [
      { code: "PSOR_01", label: "Hydrater intensément", desc: "Émollient après chaque douche pour assouplir les plaques" },
      { code: "PSOR_02", label: "Gérer le stress", desc: "Le stress est un facteur de poussée — relaxation recommandée" },
    ],
    produits: [
      { nom: "Crème kératolytique à l'urée", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Élimine les squames et assouplit les plaques psoriasiques", prio: 90 },
      { nom: "Huile de bain émolliente", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Protège la peau pendant le bain, réduit les tiraillements", prio: 70 },
      { nom: "Complément oméga-3", type: "complement", cat: "dermatologie", est_compl: true, just: "Effet anti-inflammatoire bénéfique dans le psoriasis", prio: 50 },
    ],
  },
  {
    pathologie: "Grippe",
    categorie: "infectieux",
    description: "Infection virale aiguë saisonnière",
    niveau_gravite: 2,
    conseils: [
      { code: "GRIP_01", label: "Repos strict", desc: "Rester au lit, limiter les contacts pour éviter la contagion" },
      { code: "GRIP_02", label: "Hydratation et alimentation", desc: "Boire abondamment, soupes, bouillons, éviter les efforts" },
    ],
    produits: [
      { nom: "Paracétamol 1g", type: "produit_conseil", cat: "antalgique", est_otc: true, just: "Antalgique et antipyrétique de première intention", prio: 90 },
      { nom: "Spray nasal eau de mer", type: "dispositif_medical", cat: "ORL", est_dm: true, just: "Désencombre les voies nasales et facilite la respiration", prio: 70 },
      { nom: "Vitamine C + Zinc", type: "complement", cat: "immunité", est_compl: true, just: "Soutient les défenses immunitaires pendant l'épisode infectieux", prio: 55 },
    ],
  },
  {
    pathologie: "Gastro-entérite",
    categorie: "gastro-entérologie",
    description: "Infection digestive aiguë virale",
    niveau_gravite: 2,
    conseils: [
      { code: "GAST_01", label: "Réhydratation prioritaire", desc: "SRO par petites gorgées fréquentes, surtout chez l'enfant" },
      { code: "GAST_02", label: "Régime adapté", desc: "Riz, carottes cuites, bananes, compotes — reprendre progressivement" },
    ],
    produits: [
      { nom: "Solution de réhydratation orale", type: "produit_conseil", cat: "réhydratation", est_otc: true, just: "Compense les pertes hydro-électrolytiques essentielles", prio: 95 },
      { nom: "Probiotiques Saccharomyces boulardii", type: "complement", cat: "microbiote", est_compl: true, just: "Réduit la durée et l'intensité de la diarrhée", prio: 75 },
      { nom: "Pansement intestinal", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Protège la muqueuse et adsorbe les toxines", prio: 55 },
    ],
  },
  {
    pathologie: "Nausées",
    categorie: "gastro-entérologie",
    description: "Envie de vomir d'étiologie bénigne",
    niveau_gravite: 1,
    conseils: [
      { code: "NAUS_V2_01", label: "Fractionner l'alimentation", desc: "Petits repas légers et fréquents, éviter les odeurs fortes" },
      { code: "NAUS_V2_02", label: "Position assise", desc: "Rester assis ou semi-assis, respirer lentement" },
    ],
    produits: [
      { nom: "Métopimazine", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Antiémétique OTC de référence", prio: 90 },
      { nom: "Gélules de gingembre", type: "complement", cat: "digestion", est_compl: true, just: "Anti-nauséeux naturel scientifiquement validé", prio: 70 },
      { nom: "Eau gazeuse citronnée", type: "produit_conseil", cat: "confort", est_otc: true, just: "Soulagement léger et accessible des nausées", prio: 45 },
    ],
  },
  {
    pathologie: "Reflux gastro-oesophagien",
    categorie: "gastro-entérologie",
    description: "Remontées acides récurrentes",
    niveau_gravite: 1,
    conseils: [
      { code: "RGO_01", label: "Surélever la tête du lit", desc: "Cale de 15cm sous les pieds du lit côté tête" },
      { code: "RGO_02", label: "Adapter l'alimentation", desc: "Pas de repas tardif, éviter café, alcool, épices, agrumes" },
    ],
    produits: [
      { nom: "Alginate protecteur gastrique", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Forme un radeau anti-reflux au-dessus du contenu gastrique", prio: 90 },
      { nom: "Antiacide", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Neutralise rapidement l'acidité gastrique", prio: 75 },
      { nom: "Probiotiques digestion", type: "complement", cat: "microbiote", est_compl: true, just: "Soutient l'équilibre digestif global", prio: 50 },
    ],
  },
  {
    pathologie: "Syndrome du côlon irritable",
    categorie: "gastro-entérologie",
    description: "Troubles fonctionnels intestinaux chroniques",
    niveau_gravite: 1,
    conseils: [
      { code: "SCI_01", label: "Régime pauvre en FODMAP", desc: "Limiter lactose, fructose, polyols pendant 4 à 6 semaines" },
      { code: "SCI_02", label: "Gestion du stress", desc: "Le stress aggrave les symptômes — relaxation, activité physique" },
    ],
    produits: [
      { nom: "Probiotiques IBS", type: "complement", cat: "microbiote", est_compl: true, just: "Souches spécifiques pour le confort digestif du SII", prio: 90 },
      { nom: "Antispasmodique phloroglucinol", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Soulage les spasmes et douleurs abdominales", prio: 75 },
      { nom: "Complément fibres solubles", type: "complement", cat: "transit", est_compl: true, just: "Régule le transit sans aggraver les ballonnements", prio: 55 },
    ],
  },
  {
    pathologie: "Ménopause troubles",
    categorie: "gynécologie",
    description: "Bouffées de chaleur, troubles du sommeil liés à la ménopause",
    niveau_gravite: 1,
    conseils: [
      { code: "MENO_01", label: "Hygiène de vie adaptée", desc: "Activité physique régulière, éviter alcool et café le soir" },
      { code: "MENO_02", label: "Vêtements en couches", desc: "S'habiller en couches pour gérer les bouffées de chaleur" },
    ],
    produits: [
      { nom: "Complément isoflavones de soja", type: "complement", cat: "gynécologie", est_compl: true, just: "Phytoestrogènes qui atténuent les bouffées de chaleur", prio: 90 },
      { nom: "Complément sauge officinale", type: "complement", cat: "phytothérapie", est_compl: true, just: "Réduit les bouffées de chaleur et la transpiration nocturne", prio: 70 },
      { nom: "Gel hydratant intime", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Soulage la sécheresse vaginale liée à la ménopause", prio: 55 },
    ],
  },
  {
    pathologie: "Syndrome prémenstruel",
    categorie: "gynécologie",
    description: "Symptômes physiques et émotionnels avant les règles",
    niveau_gravite: 1,
    conseils: [
      { code: "SPM_01", label: "Activité physique régulière", desc: "30 minutes d'exercice modéré réduisent les symptômes du SPM" },
      { code: "SPM_02", label: "Limiter sel et sucre", desc: "Réduire la rétention d'eau et les fluctuations glycémiques" },
    ],
    produits: [
      { nom: "Complément magnésium + vitamine B6", type: "complement", cat: "gynécologie", est_compl: true, just: "Réduit irritabilité, fatigue et crampes du SPM", prio: 90 },
      { nom: "Huile d'onagre", type: "complement", cat: "gynécologie", est_compl: true, just: "Acides gras essentiels qui régulent les symptômes hormonaux", prio: 70 },
      { nom: "Tisane gattilier", type: "complement", cat: "phytothérapie", est_compl: true, just: "Plante de référence pour l'équilibre hormonal féminin", prio: 55 },
    ],
  },
  {
    pathologie: "Sécheresse vaginale",
    categorie: "gynécologie",
    description: "Atrophie vaginale avec sécheresse et inconfort",
    niveau_gravite: 1,
    conseils: [
      { code: "SECV_01", label: "Hydratation intime régulière", desc: "Utiliser un hydratant vaginal 2 à 3 fois par semaine" },
      { code: "SECV_02", label: "Hygiène adaptée", desc: "Produit d'hygiène intime sans parfum, pH physiologique" },
    ],
    produits: [
      { nom: "Gel hydratant vaginal", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Hydratation longue durée de la muqueuse vaginale", prio: 95 },
      { nom: "Ovules hydratants à l'acide hyaluronique", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Restauration de la muqueuse vaginale en profondeur", prio: 70 },
      { nom: "Lubrifiant intime", type: "produit_conseil", cat: "gynécologie", est_otc: true, just: "Confort immédiat lors des rapports", prio: 50 },
    ],
  },
  {
    pathologie: "Grossesse complémentation",
    categorie: "gynécologie",
    description: "Besoins nutritionnels spécifiques de la femme enceinte",
    niveau_gravite: 1,
    conseils: [
      { code: "GROS_01", label: "Acide folique dès le projet de grossesse", desc: "400µg/jour recommandé dès le désir de grossesse et pendant le 1er trimestre" },
      { code: "GROS_02", label: "Alimentation variée", desc: "Fer, calcium, oméga-3, vitamine D — éviter alcool et tabac" },
    ],
    produits: [
      { nom: "Acide folique 400µg", type: "complement", cat: "grossesse", est_compl: true, just: "Prévention des anomalies du tube neural", prio: 95 },
      { nom: "Complément fer grossesse", type: "complement", cat: "grossesse", est_compl: true, just: "Prévient l'anémie ferriprive fréquente pendant la grossesse", prio: 75 },
      { nom: "DHA oméga-3 grossesse", type: "complement", cat: "grossesse", est_compl: true, just: "Développement cérébral et visuel du fœtus", prio: 55 },
    ],
  },
  {
    pathologie: "Carence en fer",
    categorie: "hématologie",
    description: "Déficit martial avec fatigue et pâleur",
    niveau_gravite: 1,
    conseils: [
      { code: "FER_01", label: "Associer vitamine C", desc: "Prendre le fer avec un jus d'orange pour améliorer l'absorption" },
      { code: "FER_02", label: "Espacer du thé et café", desc: "Les tanins réduisent l'absorption du fer — attendre 2h" },
    ],
    produits: [
      { nom: "Complément fer bisglycinate", type: "complement", cat: "vitalité", est_compl: true, just: "Forme de fer bien tolérée avec haute biodisponibilité", prio: 90 },
      { nom: "Spiruline comprimés", type: "complement", cat: "vitalité", est_compl: true, just: "Source naturelle de fer, vitamines et protéines", prio: 70 },
      { nom: "Complément vitamine C", type: "complement", cat: "vitamines", est_compl: true, just: "Potentialise l'absorption du fer non héminique", prio: 55 },
    ],
  },
  {
    pathologie: "Immunité faible",
    categorie: "immunologie",
    description: "Sensibilité accrue aux infections, défenses immunitaires affaiblies",
    niveau_gravite: 1,
    conseils: [
      { code: "IMMU_01", label: "Sommeil suffisant", desc: "7 à 8h de sommeil par nuit pour un système immunitaire optimal" },
      { code: "IMMU_02", label: "Alimentation riche en micronutriments", desc: "Fruits, légumes, poissons gras, champignons, ail" },
    ],
    produits: [
      { nom: "Vitamine C + Zinc", type: "complement", cat: "immunité", est_compl: true, just: "Duo de référence pour soutenir les défenses naturelles", prio: 90 },
      { nom: "Échinacée", type: "complement", cat: "phytothérapie", est_compl: true, just: "Stimule les défenses immunitaires en prévention hivernale", prio: 70 },
      { nom: "Probiotiques immunité", type: "complement", cat: "microbiote", est_compl: true, just: "70% du système immunitaire est dans l'intestin", prio: 55 },
    ],
  },
  {
    pathologie: "Prévention hivernale",
    categorie: "immunologie",
    description: "Renforcement des défenses avant la saison froide",
    niveau_gravite: 1,
    conseils: [
      { code: "HIVE_01", label: "Commencer 1 mois avant l'hiver", desc: "Cure de 1 à 3 mois de septembre à décembre" },
      { code: "HIVE_02", label: "Gestes barrières", desc: "Lavage des mains, aération des pièces, éviter les contacts malades" },
    ],
    produits: [
      { nom: "Vitamine D3 + Zinc", type: "complement", cat: "immunité", est_compl: true, just: "Piliers de la prévention immunitaire hivernale", prio: 90 },
      { nom: "Gelée royale fraîche", type: "complement", cat: "vitalité", est_compl: true, just: "Tonifiant naturel riche en nutriments essentiels", prio: 70 },
      { nom: "Propolis spray gorge", type: "complement", cat: "ORL", est_compl: true, just: "Antiseptique naturel des voies respiratoires supérieures", prio: 55 },
    ],
  },
  {
    pathologie: "Sevrage tabagique",
    categorie: "addictologie",
    description: "Aide à l'arrêt du tabac",
    niveau_gravite: 1,
    conseils: [
      { code: "TABA_01", label: "Substituts nicotiniques adaptés", desc: "Combiner patch + forme orale pour couvrir le besoin basal et les pulsions" },
      { code: "TABA_02", label: "Accompagnement motivationnel", desc: "Tabac Info Service 3989, pharmacien, tabacologue" },
    ],
    produits: [
      { nom: "Patchs nicotiniques", type: "produit_conseil", cat: "sevrage tabagique", est_otc: true, just: "Substitution nicotinique de fond sur 24h", prio: 90 },
      { nom: "Gommes ou pastilles à la nicotine", type: "produit_conseil", cat: "sevrage tabagique", est_otc: true, just: "Gestion des envies ponctuelles de fumer", prio: 75 },
      { nom: "Spray buccal nicotine", type: "produit_conseil", cat: "sevrage tabagique", est_otc: true, just: "Action ultra-rapide pour les craving intenses", prio: 55 },
    ],
  },
  {
    pathologie: "Convalescence",
    categorie: "médecine générale",
    description: "Récupération après maladie ou intervention",
    niveau_gravite: 1,
    conseils: [
      { code: "CONV_01", label: "Reprise progressive", desc: "Augmenter l'activité graduellement, respecter la fatigue" },
      { code: "CONV_02", label: "Alimentation riche en protéines", desc: "Viande, poisson, œufs, légumineuses pour la reconstruction tissulaire" },
    ],
    produits: [
      { nom: "Complément multivitamines", type: "complement", cat: "vitalité", est_compl: true, just: "Apport global en micronutriments pour la récupération", prio: 90 },
      { nom: "Gelée royale", type: "complement", cat: "vitalité", est_compl: true, just: "Stimulant naturel pour retrouver la forme", prio: 70 },
      { nom: "Complément protéiné", type: "complement", cat: "nutrition", est_compl: true, just: "Soutient la reconstruction musculaire et tissulaire", prio: 50 },
    ],
  },
  {
    pathologie: "Fatigue chronique",
    categorie: "médecine générale",
    description: "Asthénie persistante avec retentissement fonctionnel",
    niveau_gravite: 2,
    conseils: [
      { code: "FATC_01", label: "Bilan biologique recommandé", desc: "Vérifier fer, vitamine D, thyroïde, glycémie" },
      { code: "FATC_02", label: "Hygiène de vie globale", desc: "Sommeil régulier, alimentation équilibrée, activité physique douce" },
    ],
    produits: [
      { nom: "Complément magnésium + vitamines B", type: "complement", cat: "vitalité", est_compl: true, just: "Réduit la fatigue et soutient le métabolisme énergétique", prio: 90 },
      { nom: "Fer + vitamine C", type: "complement", cat: "vitalité", est_compl: true, just: "Corrige une éventuelle carence en fer non diagnostiquée", prio: 70 },
      { nom: "Ginseng ou rhodiola", type: "complement", cat: "phytothérapie", est_compl: true, just: "Adaptogènes qui améliorent la résistance à la fatigue", prio: 55 },
    ],
  },
  {
    pathologie: "Candidose buccale",
    categorie: "infectieux",
    description: "Muguet buccal à Candida albicans",
    niveau_gravite: 1,
    conseils: [
      { code: "CANB_01", label: "Hygiène buccale renforcée", desc: "Brossage doux, bain de bouche au bicarbonate de sodium" },
      { code: "CANB_02", label: "Traiter la durée complète", desc: "Poursuivre le traitement 2 jours après la disparition des symptômes" },
    ],
    produits: [
      { nom: "Gel buccal antifongique", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Traitement local de première intention du muguet buccal", prio: 95 },
      { nom: "Bain de bouche au bicarbonate", type: "produit_conseil", cat: "ORL", est_otc: true, just: "Alcalinise le milieu buccal, défavorable au Candida", prio: 70 },
      { nom: "Probiotiques buccaux", type: "complement", cat: "microbiote", est_compl: true, just: "Rééquilibre la flore buccale et prévient les récidives", prio: 50 },
    ],
  },
  {
    pathologie: "Onychomycose",
    categorie: "dermatologie",
    description: "Mycose de l'ongle (pied ou main)",
    niveau_gravite: 1,
    conseils: [
      { code: "ONYC_01", label: "Traiter longtemps", desc: "6 à 12 mois de traitement, l'ongle repousse lentement" },
      { code: "ONYC_02", label: "Limiter l'humidité", desc: "Chaussettes en coton, chaussures aérées, sécher les pieds" },
    ],
    produits: [
      { nom: "Vernis antifongique amorolfine", type: "produit_conseil", cat: "dermatologie", est_otc: true, just: "Pénètre l'ongle et traite le champignon en profondeur", prio: 95 },
      { nom: "Kit mycose ongle (lime + solution)", type: "dispositif_medical", cat: "dermatologie", est_dm: true, just: "Amincit l'ongle pour favoriser la pénétration du traitement", prio: 70 },
      { nom: "Spray désinfectant chaussures", type: "dispositif_medical", cat: "hygiène", est_dm: true, just: "Prévient la recontamination quotidienne", prio: 50 },
    ],
  },
  {
    pathologie: "Gastrite",
    categorie: "gastro-entérologie",
    description: "Inflammation de la muqueuse gastrique",
    niveau_gravite: 1,
    conseils: [
      { code: "GASR_01", label: "Éviter les irritants gastriques", desc: "Café, alcool, AINS, tabac aggravent la gastrite" },
      { code: "GASR_02", label: "Repas légers et fréquents", desc: "Fractionner l'alimentation, manger lentement" },
    ],
    produits: [
      { nom: "Pansement gastrique", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Protège la muqueuse gastrique enflammée", prio: 90 },
      { nom: "Antiacide en comprimés", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Neutralise l'excès d'acidité rapidement", prio: 75 },
      { nom: "Complément réglisse DGL", type: "complement", cat: "gastro-entérologie", est_compl: true, just: "Protecteur gastrique naturel sans effet sur la tension", prio: 50 },
    ],
  },
  {
    pathologie: "Douleur musculaire",
    categorie: "rhumatologie",
    description: "Myalgies post-effort ou d'origine virale",
    niveau_gravite: 1,
    conseils: [
      { code: "DMUS_01", label: "Repos et étirements doux", desc: "Étirer délicatement les muscles endoloris, éviter les efforts intenses" },
      { code: "DMUS_02", label: "Application locale", desc: "Chaud pour les contractures, froid pour les traumatismes" },
    ],
    produits: [
      { nom: "Gel anti-inflammatoire local", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Action ciblée sans effet systémique", prio: 90 },
      { nom: "Patch chauffant", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Chaleur continue pour détendre les muscles contracturés", prio: 70 },
      { nom: "Complément magnésium", type: "complement", cat: "vitalité", est_compl: true, just: "Prévient les crampes et soutient la récupération musculaire", prio: 55 },
    ],
  },
  {
    pathologie: "Douleur modérée",
    categorie: "douleur",
    description: "Douleur nécessitant un antalgique de palier 1",
    niveau_gravite: 2,
    conseils: [
      { code: "DMOD_01", label: "Respecter les doses maximales", desc: "Paracétamol max 4g/jour, ibuprofène max 1200mg/jour OTC" },
      { code: "DMOD_02", label: "Consulter si persistance", desc: "Douleur >3 jours ou résistante aux antalgiques = avis médical" },
    ],
    produits: [
      { nom: "Ibuprofène 400mg", type: "produit_conseil", cat: "antalgique", est_otc: true, just: "Anti-inflammatoire et antalgique pour douleurs modérées", prio: 90 },
      { nom: "Paracétamol 1g", type: "produit_conseil", cat: "antalgique", est_otc: true, just: "Antalgique de première intention bien toléré", prio: 75 },
      { nom: "Gel anti-inflammatoire local", type: "produit_conseil", cat: "rhumatologie", est_otc: true, just: "Complément local pour les douleurs localisées", prio: 55 },
    ],
  },
  {
    pathologie: "Ballonnements",
    categorie: "gastro-entérologie",
    description: "Sensation de gonflement abdominal avec gaz",
    niveau_gravite: 1,
    conseils: [
      { code: "BALL_V2_01", label: "Manger lentement", desc: "Bien mastiquer, ne pas parler en mangeant, éviter les chewing-gums" },
      { code: "BALL_V2_02", label: "Réduire les aliments fermentescibles", desc: "Choux, haricots, boissons gazeuses, lactose si intolérance" },
    ],
    produits: [
      { nom: "Charbon végétal activé", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Absorbe les gaz intestinaux efficacement", prio: 90 },
      { nom: "Siméticone", type: "produit_conseil", cat: "digestion", est_otc: true, just: "Fragmente les bulles de gaz pour réduire les ballonnements", prio: 70 },
      { nom: "Tisane digestion (fenouil, anis)", type: "produit_conseil", cat: "phytothérapie", est_otc: true, just: "Plantes carminatives traditionnellement utilisées", prio: 50 },
    ],
  },
  {
    pathologie: "Crampes abdominales",
    categorie: "gastro-entérologie",
    description: "Spasmes douloureux de l'abdomen",
    niveau_gravite: 1,
    conseils: [
      { code: "CRAB_01", label: "Chaleur sur le ventre", desc: "Bouillotte chaude pour détendre les muscles abdominaux" },
      { code: "CRAB_02", label: "Position confortable", desc: "Position fœtale ou allongé, genoux repliés" },
    ],
    produits: [
      { nom: "Phloroglucinol", type: "produit_conseil", cat: "gastro-entérologie", est_otc: true, just: "Antispasmodique de référence pour les douleurs abdominales", prio: 90 },
      { nom: "Bouillotte micro-ondes", type: "dispositif_medical", cat: "confort", est_dm: true, just: "Détend les spasmes par la chaleur", prio: 70 },
      { nom: "Tisane mélisse-camomille", type: "produit_conseil", cat: "phytothérapie", est_otc: true, just: "Effet antispasmodique et calmant digestif", prio: 50 },
    ],
  },
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

    let protocolesCreated = 0;
    const errors: string[] = [];

    for (const pp of PHASE3_PROTOCOLES) {
      try {
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
          if (!newP) { errors.push(`Failed: ${pp.pathologie}`); continue; }
          pathologieId = newP.id;
        }

        // Skip if already has protocol
        const { data: existingProto } = await supabase
          .from("protocole_pathologie")
          .select("id")
          .eq("pathologie_id", pathologieId)
          .eq("actif", true)
          .maybeSingle();
        if (existingProto) continue;

        const conseilIds: string[] = [];
        for (const c of pp.conseils) {
          const { data: ec } = await supabase.from("conseils_associes")
            .select("id").eq("pathologie_id", pathologieId).eq("conseil_code", c.code).maybeSingle();
          if (ec) { conseilIds.push(ec.id); }
          else {
            const { data: nc } = await supabase.from("conseils_associes").insert({
              pathologie_id: pathologieId, conseil_code: c.code, conseil: c.label, description: c.desc, priorite: 80,
            }).select("id").single();
            if (nc) conseilIds.push(nc.id);
          }
        }

        const produitIds: string[] = [];
        for (const p of pp.produits) {
          const { data: ep } = await supabase.from("produits_complementaires")
            .select("id").eq("pathologie_id", pathologieId).ilike("produit", p.nom).maybeSingle();
          if (ep) { produitIds.push(ep.id); }
          else {
            const { data: np } = await supabase.from("produits_complementaires").insert({
              pathologie_id: pathologieId, produit: p.nom, nom_produit: p.nom,
              type_produit: p.type, categorie: p.cat, priorite: p.prio, description: p.just,
              est_dispositif_medical: p.est_dm || false, est_complement: p.est_compl || false,
              est_otc: p.est_otc || false, est_eligible_cross_sell: true,
            }).select("id").single();
            if (np) produitIds.push(np.id);
          }
        }

        if (conseilIds.length >= 2 && produitIds.length >= 3) {
          await supabase.from("protocole_pathologie").insert({
            pathologie_id: pathologieId,
            conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0],
            produit_complementaire_2_id: produitIds[1],
            produit_complementaire_3_id: produitIds[2],
            justification_1: pp.produits[0].just, justification_2: pp.produits[1].just, justification_3: pp.produits[2].just,
            priorite_produit_1: pp.produits[0].prio, priorite_produit_2: pp.produits[1].prio, priorite_produit_3: pp.produits[2].prio,
            version_protocole: 1, actif: true,
          });
          protocolesCreated++;
        }
      } catch (e) {
        errors.push(`${pp.pathologie}: ${e.message}`);
      }
    }

    const { count: total } = await supabase.from("protocole_pathologie").select("*", { count: "exact", head: true });
    const { count: sansProt } = await supabase.from("pathologies").select("*", { count: "exact", head: true })
      // Can't easily count pathologies without protocol in one query, will report total

    return new Response(JSON.stringify({
      success: true,
      protocoles_crees_phase3: protocolesCreated,
      total_protocoles: total,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
