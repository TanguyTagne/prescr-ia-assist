import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── CIP CODES from real_base dataset ──────────────────────
const CIP_UPDATES: Record<string, string> = {
  "Abilify 10mg": "3400936000038",
  "Actifed Rhume": "3400935509600",
  "Actisoufre": "3400935509750",
  "Advil 200mg": "3400935240200",
  "Advil 400mg": "3400935240300",
  "Amoxicilline Biogaran 1g": "3400935507400",
  "Aspirine UPSA 1000mg": "3400935509200",
  "Augmentin 1g/125mg": "3400935507450",
  "Bronchokod sirop": "3400935509350",
  "Célestène 2mg": "3400935507550",
  "Crestor 10mg": "3400935506850",
  "Dafalgan 1000mg": "3400935507000",
  "Daflon 500mg": "3400935507050",
  "Daflon 1000mg": "3400935507100",
  "Doliprane 1000mg": "3400935506950",
  "Doliprane 500mg": "3400935506900",
  "Donormyl 15mg": "3400935509450",
  "Efferalgan 1000mg": "3400935507200",
  "Eliquis 5mg": "3400936000015",
  "Eupantol 20mg": "3400935507150",
  "Fervex": "3400935509650",
  "Flagyl 500mg": "3400936000043",
  "Flixotide 250µg": "3400936000056",
  "Fluimucil 200mg": "3400930018583",
  "Forlax 10g": "3400935507300",
  "Gaviscon suspension": "3400935509000",
  "Gavisconell menthe": "3400935509050",
  "Hexaspray": "3400935509300",
  "Humex Toux Sèche": "3400935509500",
  "Inexium 20mg": "3400935507350",
  "Ixprim": "3400935507600",
  "Levothyrox 50µg": "3400935506350",
  "Levothyrox 75µg": "3400935506400",
  "Levothyrox 100µg": "3400935506450",
  "Lovenox": "3400936000018",
  "Meteospasmyl": "3400935509500",
  "Mopral 20mg": "3400935507350",
  "Nurofen 200mg": "3400935509100",
  "Nurofen 400mg": "3400935509150",
  "Nurofen Rhume": "3400935509600",
  "Plavix 75mg": "3400936000020",
  "Profénid 100mg": "3400933480158",
  "Rennie": "3400935509150",
  "Rhinadvil": "3400935509550",
  "Seroplex 10mg": "3400935508450",
  "Singulair 10mg": "3400935508200",
  "Smecta": "3400936000067",
  "Smecta 3g": "3400935508950",
  "Solupred 20mg": "3400935507650",
  "Spasfon": "3400935507700",
  "Symbicort Turbuhaler": "3400936000058",
  "Tanganil 500mg": "3400935507750",
  "Tramadol Biogaran 50mg": "3400936889250",
  "Ventoline 100µg": "3400935507850",
  "Voltarène 50mg": "3400933074197",
  "Xanax 0.25mg": "3400936000030",
  "Xarelto 20mg": "3400936000017",
  "Xyzall 5mg": "3400935508150",
  "Zithromax 250mg": "3400935507800",
  "Zoloft 50mg": "3400935508400",
  "Zovirax 200mg": "3400935508600",
  "Kardégic 160mg": "3400936000016",
  "Lexomil 6mg": "3400936000031",
  "Lyrica 150mg": "3400936000035",
  "Prozac 20mg": "3400935508350",
  "Spiriva 18µg": "3400936000057",
  "Stilnox 10mg": "3400936000033",
  "Tahor 10mg": "3400935506800",
};

// ─── JUSTIFICATIONS for protocols missing them ──────────────
const PROTOCOL_JUSTIFICATIONS: Record<string, {
  conseil_1: string; conseil_2: string;
  just_1: string; just_2: string; just_3: string;
}> = {
  "Contraception": {
    conseil_1: "Observance contraceptive",
    conseil_2: "Conduite en cas d'oubli",
    just_1: "Organisation de la prise régulière pour éviter les oublis",
    just_2: "Protection supplémentaire en cas de rapport non protégé",
    just_3: "Maintien du confort intime et de la flore vaginale",
  },
  "Contusion et ecchymose": {
    conseil_1: "Appliquer du froid immédiatement",
    conseil_2: "Consulter si aggravation ou hématome étendu",
    just_1: "L'arnica accélère la résorption des hématomes (grade B)",
    just_2: "Vasoconstriction et réduction de l'œdème par le froid",
    just_3: "Compression douce pour limiter l'extension de l'hématome",
  },
  "Douleur dentaire": {
    conseil_1: "Consulter un dentiste rapidement",
    conseil_2: "Éviter les aliments chauds/froids/sucrés",
    just_1: "Réduction de la charge bactérienne buccale",
    just_2: "Anesthésique local pour soulagement immédiat de la douleur gingivale",
    just_3: "Antalgique naturel traditionnel à action rapide",
  },
  "Gerçures et crevasses": {
    conseil_1: "Protéger la peau du froid et du vent",
    conseil_2: "Hydrater plusieurs fois par jour",
    just_1: "Cicatrisant et protecteur cutané polyvalent",
    just_2: "Réparation et protection de la barrière labiale",
    just_3: "Nutrition intense de la peau sèche et craquelée",
  },
  "Irritation cutanée": {
    conseil_1: "Identifier et supprimer l'agent irritant",
    conseil_2: "Hydrater la peau après chaque lavage",
    just_1: "Réparation accélérée de la barrière cutanée (vitamine B5)",
    just_2: "Apaisement immédiat et réduction de l'inflammation locale",
    just_3: "Effet cicatrisant et anti-inflammatoire naturel du calendula",
  },
  "Rétention hydrique": {
    conseil_1: "Limiter les apports en sel",
    conseil_2: "Surélever les jambes au repos",
    just_1: "Diurétique naturel doux sans effet indésirable",
    just_2: "Favorise l'élimination rénale naturellement",
    just_3: "Réduction mécanique des œdèmes des membres inférieurs",
  },
  "Rhinite aiguë": {
    conseil_1: "Lavage nasal fréquent au sérum physiologique",
    conseil_2: "Se moucher doucement pour éviter l'otite",
    just_1: "Décongestion nasale naturelle par effet osmotique",
    just_2: "Évite l'irritation du nez lors du mouchage répété",
    just_3: "Dégagement des voies respiratoires par inhalation",
  },
  "Spasmes intestinaux": {
    conseil_1: "Manger lentement et fractionner les repas",
    conseil_2: "Éviter les aliments fermentescibles",
    just_1: "Rééquilibrage de la flore digestive perturbée",
    just_2: "Effet antispasmodique naturel du fenouil et de la menthe",
    just_3: "Chaleur apaisante qui détend les muscles intestinaux",
  },
  "Syndrome grippal": {
    conseil_1: "Repos au lit et hydratation abondante",
    conseil_2: "Consulter si fièvre >3 jours ou difficultés respiratoires",
    just_1: "Soutien des défenses immunitaires en phase aiguë",
    just_2: "Stimulation naturelle de l'immunité antivirale",
    just_3: "Apaisement des voies respiratoires et effet antiseptique naturel",
  },
  "Toux productive": {
    conseil_1: "Bien s'hydrater pour fluidifier les sécrétions",
    conseil_2: "Ne pas prendre d'antitussif (toux utile)",
    just_1: "Apaise les voies respiratoires et effet antiseptique naturel du thym",
    just_2: "Décongestionne les fosses nasales par effet osmotique",
    just_3: "Antiseptique naturel des voies respiratoires supérieures",
  },
  "Troubles bipolaires": {
    conseil_1: "Régularité du rythme de vie",
    conseil_2: "Surveillance de l'humeur au quotidien",
    just_1: "Le magnésium contribue à la régulation de l'humeur et réduit l'irritabilité",
    just_2: "Effet neuroprotecteur et anti-inflammatoire cérébral démontré",
    just_3: "Régulation du cycle veille-sommeil souvent perturbé",
  },
  "Troubles prostatiques": {
    conseil_1: "Uriner dès que le besoin se fait sentir",
    conseil_2: "Éviter la position assise prolongée",
    just_1: "Serenoa repens réduit les symptômes urinaires (grade A)",
    just_2: "Soutien de la fonction prostatique (oligo-élément essentiel)",
    just_3: "Phytothérapie traditionnelle pour le confort urinaire masculin",
  },
};

// ─── NEW PATHOLOGIES from dataset not yet in DB ──────────────
const NEW_PATHOLOGIES: {
  nom: string; categorie: string; gravite: number; desc: string;
  conseils: { code: string; label: string; desc: string }[];
  produits: { nom: string; type: string; cat: string; prio: number; just: string }[];
}[] = [
  {
    nom: "Prévention hivernale", categorie: "Immunologie", gravite: 0,
    desc: "Préparation du système immunitaire avant la saison froide",
    conseils: [
      { code: "PREV_HIV_1", label: "Commencer 1 mois avant l'hiver", desc: "Débuter les compléments en octobre" },
      { code: "PREV_HIV_2", label: "Gestes barrières", desc: "Lavage des mains, aération des pièces" },
    ],
    produits: [
      { nom: "Vitamine D3 + Zinc", type: "complement", cat: "Immunité", prio: 90, just: "Piliers de la prévention immunitaire hivernale" },
      { nom: "Gelée royale fraîche", type: "complement", cat: "Tonifiant", prio: 70, just: "Tonifiant naturel riche en nutriments essentiels" },
      { nom: "Propolis spray gorge", type: "produit_conseil", cat: "ORL", prio: 55, just: "Antiseptique naturel des voies respiratoires supérieures" },
    ],
  },
  {
    nom: "Stress et anxiété légère", categorie: "Psychiatrie", gravite: 1,
    desc: "Stress chronique et anxiété d'intensité légère",
    conseils: [
      { code: "STRESS_1", label: "Techniques de respiration", desc: "Cohérence cardiaque, respiration abdominale" },
      { code: "STRESS_2", label: "Activité physique quotidienne", desc: "30 min de marche ou sport doux" },
    ],
    produits: [
      { nom: "Magnésium B6", type: "complement", cat: "Équilibre nerveux", prio: 90, just: "Magné B6 ou équivalent pour le système nerveux" },
      { nom: "Rhodiola", type: "complement", cat: "Adaptogène", prio: 80, just: "Adaptogène anti-stress scientifiquement validé" },
      { nom: "Ashwagandha", type: "complement", cat: "Adaptogène", prio: 75, just: "Adaptogène apaisant, réduit le cortisol" },
    ],
  },
  {
    nom: "Vieillissement cutané", categorie: "Dermatologie", gravite: 0,
    desc: "Prévention et prise en charge du vieillissement de la peau",
    conseils: [
      { code: "VIEIL_CUT_1", label: "Appliquer un écran solaire quotidien", desc: "SPF 30+ toute l'année" },
      { code: "VIEIL_CUT_2", label: "Hydrater la peau matin et soir", desc: "Crème adaptée à son type de peau" },
    ],
    produits: [
      { nom: "Sérum vitamine C antioxydant", type: "produit_conseil", cat: "Anti-âge", prio: 90, just: "Protection antioxydante et stimulation du collagène" },
      { nom: "Crème acide hyaluronique", type: "produit_conseil", cat: "Hydratation", prio: 70, just: "Hydratation profonde et comblement des rides" },
      { nom: "Collagène marin buvable", type: "complement", cat: "Nutrition cutanée", prio: 50, just: "Soutien de la structure dermique de l'intérieur" },
    ],
  },
  {
    nom: "Torticolis", categorie: "Rhumatologie", gravite: 1,
    desc: "Contracture douloureuse des muscles du cou",
    conseils: [
      { code: "TORTICOLIS_1", label: "Appliquer de la chaleur sur la zone", desc: "Bouillotte ou patch chauffant" },
      { code: "TORTICOLIS_2", label: "Mobiliser doucement le cou", desc: "Étirements doux sans forcer" },
    ],
    produits: [
      { nom: "Patch chauffant nuque", type: "dispositif_medical", cat: "Thermothérapie", prio: 90, just: "Chaleur ciblée pour décontraction du trapèze et du cou" },
      { nom: "Gel décontractant musculaire", type: "produit_conseil", cat: "Antalgique local", prio: 70, just: "Soulagement local de la contracture cervicale" },
      { nom: "Oreiller ergonomique cervical", type: "produit_conseil", cat: "Prévention", prio: 50, just: "Prévention des récidives par un bon maintien cervical nocturne" },
    ],
  },
  {
    nom: "Spasmes musculaires", categorie: "Rhumatologie", gravite: 1,
    desc: "Contractions musculaires involontaires et douloureuses",
    conseils: [
      { code: "SPASME_MUSC_1", label: "S'hydrater suffisamment", desc: "Boire au moins 1.5L d'eau par jour" },
      { code: "SPASME_MUSC_2", label: "Étirer le muscle en douceur", desc: "Étirements passifs et progressifs" },
    ],
    produits: [
      { nom: "Magnésium marin + B6", type: "complement", cat: "Minéraux", prio: 90, just: "Correction de la carence en magnésium, cause fréquente de spasmes" },
      { nom: "Spray décontractant musculaire", type: "produit_conseil", cat: "Antalgique local", prio: 70, just: "Soulagement rapide par voie locale" },
      { nom: "Bouillotte sèche micro-ondes", type: "produit_conseil", cat: "Thermothérapie", prio: 50, just: "Chaleur douce pour relaxation musculaire" },
    ],
  },
  {
    nom: "Reflux gastro-œsophagien léger", categorie: "Gastro-entérologie", gravite: 1,
    desc: "Remontées acides légères et occasionnelles",
    conseils: [
      { code: "RGO_LEGER_1", label: "Surélever la tête du lit", desc: "10-15 cm pour limiter le reflux nocturne" },
      { code: "RGO_LEGER_2", label: "Éviter les repas tardifs", desc: "Dîner 3h avant le coucher" },
    ],
    produits: [
      { nom: "Antiacide local", type: "produit_conseil", cat: "Gastro", prio: 90, just: "Neutralise l'acidité gastrique rapidement" },
      { nom: "Alginate protecteur", type: "produit_conseil", cat: "Gastro", prio: 75, just: "Forme un radeau anti-reflux sur le contenu gastrique" },
      { nom: "Probiotiques digestion", type: "complement", cat: "Flore intestinale", prio: 50, just: "Soutient l'équilibre du microbiote gastro-intestinal" },
    ],
  },
  {
    nom: "Toux grasse", categorie: "Pneumologie", gravite: 1,
    desc: "Toux avec expectoration de mucus abondant",
    conseils: [
      { code: "TOUX_GRASSE_1", label: "Favoriser l'hydratation", desc: "Boire chaud pour fluidifier les sécrétions" },
      { code: "TOUX_GRASSE_2", label: "Ne pas supprimer la toux", desc: "La toux grasse est un mécanisme d'épuration utile" },
    ],
    produits: [
      { nom: "Sirop expectorant", type: "produit_conseil", cat: "Pneumologie", prio: 90, just: "Facilite l'expectoration et le drainage bronchique" },
      { nom: "Spray nasal décongestionnant", type: "dispositif_medical", cat: "ORL", prio: 70, just: "Libère les voies respiratoires si contexte ORL associé" },
      { nom: "Pastilles adoucissantes gorge", type: "produit_conseil", cat: "ORL", prio: 50, just: "Soulage l'irritation pharyngée liée à la toux répétée" },
    ],
  },
  {
    nom: "Règles douloureuses", categorie: "Gynécologie", gravite: 1,
    desc: "Dysménorrhées primaires avec crampes abdominales",
    conseils: [
      { code: "DYSM_1", label: "Appliquer de la chaleur", desc: "Bouillotte sur le bas-ventre" },
      { code: "DYSM_2", label: "Activité physique douce", desc: "Marche, yoga, étirements" },
    ],
    produits: [
      { nom: "Ibuprofène 200mg", type: "produit_conseil", cat: "Antalgique", prio: 90, just: "Anti-inflammatoire de référence pour les dysménorrhées" },
      { nom: "Patch chauffant ventre", type: "dispositif_medical", cat: "Thermothérapie", prio: 75, just: "Chaleur continue qui détend les muscles utérins" },
      { nom: "Complément magnésium + vitamine B6", type: "complement", cat: "Minéraux", prio: 55, just: "Réduit les crampes et le syndrome prémenstruel" },
    ],
  },
  {
    nom: "Trouble bipolaire", categorie: "Psychiatrie", gravite: 3,
    desc: "Alternance d'épisodes maniaques et dépressifs",
    conseils: [
      { code: "BIPOL_1", label: "Régularité du rythme de vie", desc: "Horaires de sommeil et repas réguliers" },
      { code: "BIPOL_2", label: "Journal de l'humeur", desc: "Surveiller les fluctuations thymiques" },
    ],
    produits: [
      { nom: "Pilulier semainier", type: "dispositif_medical", cat: "Observance", prio: 90, just: "Gestion rigoureuse du multi-traitement" },
      { nom: "Oméga-3 EPA haute dose", type: "complement", cat: "Neuroprotection", prio: 75, just: "Effet neuroprotecteur et stabilisateur de l'humeur" },
      { nom: "Mélatonine 1mg", type: "complement", cat: "Sommeil", prio: 55, just: "Régulation du cycle veille-sommeil souvent perturbé" },
    ],
  },
  {
    nom: "Rectocolite hémorragique", categorie: "Gastro-entérologie", gravite: 4,
    desc: "Maladie inflammatoire chronique du côlon et du rectum",
    conseils: [
      { code: "RCH_1", label: "Suivi gastroentérologique régulier", desc: "Consultations et coloscopies de surveillance" },
      { code: "RCH_2", label: "Régime adapté en poussée", desc: "Alimentation pauvre en résidus" },
    ],
    produits: [
      { nom: "Probiotiques VSL#3", type: "complement", cat: "Flore intestinale", prio: 85, just: "Maintien de la rémission par rééquilibrage du microbiote" },
      { nom: "Curcumine haute biodisponibilité", type: "complement", cat: "Anti-inflammatoire", prio: 70, just: "Effet anti-inflammatoire intestinal complémentaire" },
      { nom: "Fer bisglycinate 14mg", type: "complement", cat: "Hématologie", prio: 55, just: "Compensation des pertes en fer liées aux saignements" },
    ],
  },
  {
    nom: "Schizophrénie", categorie: "Psychiatrie", gravite: 4,
    desc: "Trouble psychotique chronique",
    conseils: [
      { code: "SCHIZ_1", label: "Observance stricte du traitement", desc: "Ne jamais arrêter sans avis psychiatrique" },
      { code: "SCHIZ_2", label: "Suivi régulier", desc: "Consultations psychiatriques et métaboliques" },
    ],
    produits: [
      { nom: "Pilulier journalier", type: "dispositif_medical", cat: "Observance", prio: 90, just: "Soutien à l'observance du traitement quotidien" },
      { nom: "Oméga-3 EPA/DHA", type: "complement", cat: "Neuroprotection", prio: 70, just: "Effet neuroprotecteur complémentaire documenté" },
      { nom: "Vitamine D3 1000UI", type: "complement", cat: "Carence fréquente", prio: 55, just: "Carence en vitamine D fréquente sous antipsychotiques" },
    ],
  },
];

// ─── NEW MEDICATIONS from dataset ──────────────────────
const NEW_MEDS: {
  nom: string; molecule: string; atc?: string; labo: string;
  forme: string; dosage: string; otc: boolean; cip?: string;
  pathologies: string[];
}[] = [
  { nom: "Pévaryl crème", molecule: "Éconazole", labo: "Janssen", forme: "Crème", dosage: "1%", otc: true, pathologies: ["Candidose vaginale", "Mycose cutanée"] },
  { nom: "Piasclédine 300", molecule: "Piasclédine", labo: "Expanscience", forme: "Gélule", dosage: "Huile avocat + soja", otc: true, pathologies: ["Arthrose"] },
  { nom: "Pradaxa 150mg", molecule: "Dabigatran", atc: "B01AE07", labo: "Boehringer", forme: "Gélule", dosage: "150mg", otc: false, cip: "3400936000019", pathologies: ["Fibrillation auriculaire", "Thrombose veineuse"] },
  { nom: "Probiolog Fort", molecule: "Lactobacillus rhamnosus GG", labo: "Mayoly Spindler", forme: "Gélule", dosage: "4 milliards UFC", otc: true, pathologies: ["Diarrhée aiguë", "Gastro-entérite"] },
  { nom: "Toplexil", molecule: "Oxomémazine", labo: "Sanofi", forme: "Sirop", dosage: "0.33mg/ml", otc: true, pathologies: ["Toux sèche"] },
  { nom: "Tussidane 30mg", molecule: "Dextrométhorphane", atc: "R05DA09", labo: "Sanofi", forme: "Comprimé", dosage: "30mg", otc: true, cip: "3400937007344", pathologies: ["Toux sèche"] },
  { nom: "Valium 5mg", molecule: "Diazépam", atc: "N05BA01", labo: "Roche", forme: "Comprimé", dosage: "5mg", otc: false, pathologies: ["Spasmes musculaires", "Anxiété"] },
  { nom: "Séresta 10mg", molecule: "Oxazépam", labo: "Pfizer", forme: "Comprimé", dosage: "10mg", otc: false, pathologies: ["Anxiété"] },
  { nom: "Rénitec 20mg", molecule: "Énalapril", atc: "C09AA02", labo: "MSD", forme: "Comprimé", dosage: "20mg", otc: false, cip: "3400935506700", pathologies: ["Hypertension artérielle"] },
  { nom: "Seloken 100mg", molecule: "Métoprolol", atc: "C07AB02", labo: "AstraZeneca", forme: "Comprimé", dosage: "100mg", otc: false, cip: "3400935506550", pathologies: ["Hypertension artérielle"] },
  { nom: "Zocor 20mg", molecule: "Simvastatine", atc: "C10AA01", labo: "MSD", forme: "Comprimé", dosage: "20mg", otc: false, cip: "3400935506900", pathologies: ["Hypercholestérolémie"] },
  { nom: "Triatec 5mg", molecule: "Ramipril", atc: "C09AA05", labo: "Sanofi", forme: "Comprimé", dosage: "5mg", otc: false, cip: "3400935506750", pathologies: ["Hypertension artérielle"] },
  { nom: "Seretide Diskus", molecule: "Fluticasone + Salmétérol", atc: "R03AK06", labo: "GSK", forme: "Poudre inhalation", dosage: "500/50µg", otc: false, pathologies: ["Asthme"] },
  { nom: "Pulmicort 200µg", molecule: "Budésonide", atc: "R03BA02", labo: "AstraZeneca", forme: "Poudre pour inhalation", dosage: "200µg", otc: false, cip: "3400936000055", pathologies: ["Asthme"] },
  { nom: "Qvar 100µg", molecule: "Béclométasone inhalée", atc: "R03BA01", labo: "Teva", forme: "Solution pour inhalation", dosage: "100µg", otc: false, cip: "3400936000054", pathologies: ["Asthme"] },
  { nom: "Zelitrex 500mg", molecule: "Valaciclovir", atc: "J05AB11", labo: "GSK", forme: "Comprimé", dosage: "500mg", otc: false, cip: "3400936000039", pathologies: ["Herpès labial", "Zona"] },
  { nom: "Triflucan 50mg", molecule: "Fluconazole", labo: "Pfizer", forme: "Gélule", dosage: "50mg", otc: false, cip: "3400935508650", pathologies: ["Mycose cutanée", "Candidose vaginale"] },
  { nom: "Virlix 10mg", molecule: "Cétirizine", atc: "R06AE07", labo: "UCB", forme: "Comprimé", dosage: "10mg", otc: true, cip: "3400936022805", pathologies: ["Rhinite allergique", "Allergie saisonnière"] },
  { nom: "Vismed", molecule: "Hyaluronate de sodium", atc: "S01XA20", labo: "TRB Chemedica", forme: "Collyre", dosage: "0.18%", otc: true, pathologies: ["Sécheresse oculaire"] },
  { nom: "Xatral LP", molecule: "Alfuzosine", atc: "G04CA01", labo: "Sanofi", forme: "Comprimé LP", dosage: "10mg", otc: false, pathologies: ["Hypertrophie bénigne de prostate"] },
  { nom: "Uvedose 100000 UI", molecule: "Cholécalciférol", atc: "A11CC05", labo: "Crinex", forme: "Ampoule buvable", dosage: "100000 UI", otc: true, pathologies: ["Carence en vitamine D", "Ostéoporose"] },
  { nom: "Zophren 4mg", molecule: "Ondansétron", atc: "A04AA01", labo: "Novartis", forme: "Comprimé orodispersible", dosage: "4mg", otc: false, cip: "3400936000064", pathologies: ["Vomissements", "Nausées"] },
  { nom: "Seebri Breezhaler", molecule: "Glycopyrronium", atc: "R03BB06", labo: "Novartis", forme: "Gélule inhalation", dosage: "44µg", otc: false, pathologies: ["BPCO"] },
  { nom: "Salazopyrine", molecule: "Sulfasalazine", atc: "A07EC01", labo: "Pfizer", forme: "Comprimé", dosage: "500mg", otc: false, pathologies: ["Rectocolite hémorragique"] },
  { nom: "Sinemet 100/25mg", molecule: "Lévodopa", atc: "N04BA02", labo: "MSD", forme: "Comprimé", dosage: "100mg/25mg", otc: false, cip: "3400936000029", pathologies: ["Maladie de Parkinson"] },
];

// ─── NEW ATC CODES needed ──────────────────────
const NEW_ATC: { code: string; nom: string }[] = [
  { code: "B01AE07", nom: "Dabigatran" },
  { code: "R05DA09", nom: "Dextrométhorphane" },
  { code: "N05BA01", nom: "Diazépam" },
  { code: "C07AB02", nom: "Métoprolol" },
  { code: "R03BA02", nom: "Budésonide inhalé" },
  { code: "R03BA01", nom: "Béclométasone inhalée" },
  { code: "J05AB11", nom: "Valaciclovir" },
  { code: "S01XA20", nom: "Hyaluronate de sodium" },
  { code: "G04CA01", nom: "Alfuzosine" },
  { code: "A04AA01", nom: "Ondansétron" },
  { code: "R03BB06", nom: "Glycopyrronium" },
  { code: "A07EC01", nom: "Sulfasalazine" },
  { code: "N04BA02", nom: "Lévodopa" },
  { code: "P01BA02", nom: "Hydroxychloroquine" },
  { code: "S01EC03", nom: "Dorzolamide" },
  { code: "S01EE01", nom: "Latanoprost" },
  { code: "S01ED01", nom: "Timolol ophtalmique" },
  { code: "S01AA12", nom: "Tobramycine ophtalmique" },
  { code: "N03AG01", nom: "Valproate" },
  { code: "N05AH04", nom: "Quétiapine" },
  { code: "N05AX08", nom: "Rispéridone" },
  { code: "N05AX12", nom: "Aripiprazole" },
  { code: "C10AX06", nom: "Oméga-3 triglycérides" },
  { code: "G04BD08", nom: "Solifénacine" },
  { code: "M03BX05", nom: "Thiocolchicoside" },
  { code: "C03DA01", nom: "Spironolactone" },
  { code: "S01FA06", nom: "Tropicamide" },
  { code: "R03DA04", nom: "Théophylline" },
  { code: "N02BA", nom: "Dérivés salicylés" },
  { code: "G02CX04", nom: "Gattilier" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Require admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats = { cip_updated: 0, justifications_added: 0, pathologies_created: 0, meds_created: 0, links_created: 0, produits_created: 0, atc_created: 0, errors: [] as string[] };

    // ── 1. Insert missing ATC codes ──
    for (const atc of NEW_ATC) {
      const { error } = await supabase.from("classe_atc").upsert({ atc_code: atc.code, nom_classe: atc.nom, niveau: 5 }, { onConflict: "atc_code" });
      if (!error) stats.atc_created++;
    }

    // ── 2. Update CIP codes ──
    for (const [nom, cip] of Object.entries(CIP_UPDATES)) {
      const { data, error } = await supabase.from("medicaments")
        .update({ cip_code: cip })
        .eq("nom_commercial", nom)
        .is("cip_code", null);
      if (!error) stats.cip_updated++;
    }

    // ── 3. Add justifications to protocols ──
    for (const [pathoName, justif] of Object.entries(PROTOCOL_JUSTIFICATIONS)) {
      const { data: patho } = await supabase.from("pathologies").select("id").eq("nom_pathologie", pathoName).single();
      if (!patho) continue;

      // Update conseils text
      const { data: conseils } = await supabase.from("conseils_associes")
        .select("id, conseil")
        .eq("pathologie_id", patho.id)
        .order("priorite", { ascending: false })
        .limit(2);

      if (conseils && conseils.length >= 1) {
        await supabase.from("conseils_associes").update({ conseil: justif.conseil_1 }).eq("id", conseils[0].id);
        if (conseils.length >= 2) {
          await supabase.from("conseils_associes").update({ conseil: justif.conseil_2 }).eq("id", conseils[1].id);
        }
      }

      // Update justifications on protocol
      const { error } = await supabase.from("protocole_pathologie")
        .update({
          justification_1: justif.just_1,
          justification_2: justif.just_2,
          justification_3: justif.just_3,
        })
        .eq("pathologie_id", patho.id)
        .eq("actif", true);
      if (!error) stats.justifications_added++;
    }

    // ── 4. Create new pathologies with full protocols ──
    const pathoMap: Record<string, string> = {};
    const { data: allPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const p of allPathos || []) pathoMap[p.nom_pathologie] = p.id;

    for (const np of NEW_PATHOLOGIES) {
      let pathoId = pathoMap[np.nom];
      if (!pathoId) {
        const { data, error } = await supabase.from("pathologies").insert({
          nom_pathologie: np.nom, categorie: np.categorie, niveau_gravite: np.gravite, description: np.desc,
        }).select("id").single();
        if (data) { pathoId = data.id; pathoMap[np.nom] = pathoId; stats.pathologies_created++; }
        if (error) { stats.errors.push(`Patho ${np.nom}: ${error.message}`); continue; }
      }

      // Create conseils
      const conseilIds: string[] = [];
      for (const c of np.conseils) {
        const { data: existing } = await supabase.from("conseils_associes")
          .select("id").eq("pathologie_id", pathoId).eq("conseil_code", c.code).limit(1);
        if (existing && existing.length > 0) { conseilIds.push(existing[0].id); continue; }
        const { data } = await supabase.from("conseils_associes").insert({
          pathologie_id: pathoId, conseil: c.label, description: c.desc, conseil_code: c.code, priorite: 80,
        }).select("id").single();
        if (data) conseilIds.push(data.id);
      }

      // Create produits
      const produitIds: string[] = [];
      for (const prod of np.produits) {
        const { data: existing } = await supabase.from("produits_complementaires")
          .select("id").eq("pathologie_id", pathoId).eq("produit", prod.nom).limit(1);
        if (existing && existing.length > 0) { produitIds.push(existing[0].id); continue; }
        const { data } = await supabase.from("produits_complementaires").insert({
          produit: prod.nom, categorie: prod.cat, description: prod.just,
          type_produit: prod.type, priorite: prod.prio, pathologie_id: pathoId,
          est_otc: prod.type === "produit_conseil",
          est_complement: prod.type === "complement",
          est_dispositif_medical: prod.type === "dispositif_medical",
          est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) { produitIds.push(data.id); stats.produits_created++; }
      }

      // Create protocole
      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        const { data: existProto } = await supabase.from("protocole_pathologie")
          .select("id").eq("pathologie_id", pathoId).eq("actif", true).limit(1);
        if (!existProto || existProto.length === 0) {
          await supabase.from("protocole_pathologie").insert({
            pathologie_id: pathoId,
            conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0],
            produit_complementaire_2_id: produitIds[1],
            produit_complementaire_3_id: produitIds[2],
            justification_1: np.produits[0].just,
            justification_2: np.produits[1].just,
            justification_3: np.produits[2].just,
            actif: true, version_protocole: 1,
          });
        }
      }
    }

    // ── 5. Create new medications ──
    const molMap: Record<string, string> = {};
    const { data: allMols } = await supabase.from("molecules").select("id, nom_molecule");
    for (const m of allMols || []) molMap[m.nom_molecule] = m.id;

    for (const med of NEW_MEDS) {
      const { data: existing } = await supabase.from("medicaments")
        .select("id").eq("nom_commercial", med.nom).limit(1);
      if (existing && existing.length > 0) {
        // Ensure links exist
        for (const pn of med.pathologies) {
          const pid = pathoMap[pn];
          if (!pid) continue;
          const { data: link } = await supabase.from("medicament_pathologie")
            .select("id").eq("medicament_id", existing[0].id).eq("pathologie_id", pid).limit(1);
          if (!link || link.length === 0) {
            await supabase.from("medicament_pathologie").insert({
              medicament_id: existing[0].id, pathologie_id: pid,
              score_pertinence: 80, source_mapping: "dataset_import",
            });
            stats.links_created++;
          }
        }
        if (med.cip) {
          await supabase.from("medicaments").update({ cip_code: med.cip }).eq("id", existing[0].id).is("cip_code", null);
        }
        continue;
      }

      const moleculeId = molMap[med.molecule] || null;
      const { data, error } = await supabase.from("medicaments").insert({
        nom_commercial: med.nom, molecule_id: moleculeId,
        atc_code: med.atc || null, laboratoire: med.labo,
        forme_galenique: med.forme, dosage: med.dosage,
        est_otc: med.otc, est_produit_conseil: med.otc,
        statut_officine: "actif", cip_code: med.cip || null,
      }).select("id").single();

      if (data) {
        stats.meds_created++;
        for (const pn of med.pathologies) {
          const pid = pathoMap[pn];
          if (!pid) { stats.errors.push(`Patho not found: ${pn}`); continue; }
          await supabase.from("medicament_pathologie").insert({
            medicament_id: data.id, pathologie_id: pid,
            score_pertinence: 80, source_mapping: "dataset_import",
          });
          stats.links_created++;
        }
      }
      if (error) stats.errors.push(`Med ${med.nom}: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Import terminé: ${stats.cip_updated} CIP, ${stats.justifications_added} justifs, ${stats.pathologies_created} pathos, ${stats.meds_created} meds, ${stats.links_created} liens, ${stats.produits_created} produits`,
      stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
