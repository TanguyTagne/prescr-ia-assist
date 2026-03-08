import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Structured pharmacological data based on ANSM, ATC classification, DrugBank, ICD-10, HAS
const PHARMA_DATA = {
  classes: [
    { nom: "Antibiotiques - Pénicillines", description: "Antibiotiques bêta-lactamines à large spectre", systeme: "Anti-infectieux" },
    { nom: "Antibiotiques - Macrolides", description: "Antibiotiques inhibant la synthèse protéique bactérienne", systeme: "Anti-infectieux" },
    { nom: "Antalgiques non opioïdes", description: "Antalgiques de palier 1 (paracétamol)", systeme: "Système nerveux" },
    { nom: "Anti-inflammatoires non stéroïdiens", description: "AINS inhibiteurs de la cyclo-oxygénase", systeme: "Système musculo-squelettique" },
    { nom: "Antiseptiques", description: "Agents antimicrobiens à usage local (buccal et cutané)", systeme: "Dermatologie / ORL" },
    { nom: "Antalgiques opioïdes faibles", description: "Opioïdes de palier 2 (tramadol, codéine)", systeme: "Système nerveux" },
    { nom: "Inhibiteurs de la pompe à protons", description: "IPP réduisant la sécrétion acide gastrique", systeme: "Système digestif" },
    { nom: "Biguanides", description: "Antidiabétiques oraux (metformine)", systeme: "Métabolisme" },
    { nom: "Inhibiteurs de l'enzyme de conversion", description: "IEC pour hypertension et insuffisance cardiaque", systeme: "Système cardiovasculaire" },
    { nom: "Bêta-bloquants", description: "Antagonistes des récepteurs bêta-adrénergiques", systeme: "Système cardiovasculaire" },
    { nom: "Statines", description: "Inhibiteurs de l'HMG-CoA réductase (cholestérol)", systeme: "Métabolisme" },
    { nom: "ISRS", description: "Inhibiteurs sélectifs de la recapture de la sérotonine", systeme: "Système nerveux" },
    { nom: "Bronchodilatateurs", description: "Agonistes bêta-2 adrénergiques inhalés", systeme: "Système respiratoire" },
    { nom: "Corticoïdes systémiques", description: "Anti-inflammatoires stéroïdiens à usage systémique", systeme: "Système immunitaire" },
    { nom: "Anticoagulants oraux directs", description: "AOD inhibiteurs du facteur Xa ou de la thrombine", systeme: "Sang et hémostase" },
    { nom: "Antihistaminiques", description: "Antagonistes des récepteurs H1 de l'histamine", systeme: "Système immunitaire" },
    { nom: "Antitussifs", description: "Médicaments contre la toux sèche", systeme: "Système respiratoire" },
    { nom: "Mucolytiques / Expectorants", description: "Fluidifiants des sécrétions bronchiques", systeme: "Système respiratoire" },
  ],

  medications: [
    // Pénicillines
    { nom: "Amoxicilline", molecule: "Amoxicilline", atc: "J01CA04", classe: "Antibiotiques - Pénicillines", indications: ["Infection ORL", "Infection respiratoire basse", "Infection urinaire", "Infection dentaire"], mecanisme: "Inhibition de la synthèse de la paroi bactérienne", effets: ["Troubles digestifs", "Diarrhée", "Nausées", "Éruption cutanée"] },
    { nom: "Augmentin", molecule: "Amoxicilline + Acide clavulanique", atc: "J01CR02", classe: "Antibiotiques - Pénicillines", indications: ["Infection ORL résistante", "Sinusite", "Otite moyenne", "Infection respiratoire", "Infection cutanée"], mecanisme: "Inhibition de la synthèse de la paroi bactérienne + inhibition des bêta-lactamases", effets: ["Diarrhée", "Nausées", "Candidose", "Troubles hépatiques"] },
    { nom: "Clamoxyl", molecule: "Amoxicilline", atc: "J01CA04", classe: "Antibiotiques - Pénicillines", indications: ["Infection ORL", "Infection respiratoire", "Infection urinaire"], mecanisme: "Inhibition de la synthèse de la paroi bactérienne", effets: ["Troubles digestifs", "Diarrhée", "Éruption cutanée"] },
    // Macrolides
    { nom: "Azithromycine", molecule: "Azithromycine", atc: "J01FA10", classe: "Antibiotiques - Macrolides", indications: ["Infection respiratoire", "Angine", "Infection cutanée", "IST"], mecanisme: "Inhibition de la synthèse protéique bactérienne (sous-unité 50S)", effets: ["Diarrhée", "Nausées", "Douleurs abdominales"] },
    { nom: "Clarithromycine", molecule: "Clarithromycine", atc: "J01FA09", classe: "Antibiotiques - Macrolides", indications: ["Infection respiratoire", "Infection ORL", "Infection à H. pylori"], mecanisme: "Inhibition de la synthèse protéique bactérienne", effets: ["Troubles digestifs", "Dysgueusie", "Céphalées"] },
    // Antalgiques
    { nom: "Doliprane", molecule: "Paracétamol", atc: "N02BE01", classe: "Antalgiques non opioïdes", indications: ["Douleur légère à modérée", "Fièvre", "Céphalées", "Douleurs dentaires", "Douleurs musculaires"], mecanisme: "Inhibition centrale des prostaglandines, action antipyrétique", effets: ["Hépatotoxicité à forte dose", "Réactions allergiques rares"] },
    { nom: "Efferalgan", molecule: "Paracétamol", atc: "N02BE01", classe: "Antalgiques non opioïdes", indications: ["Douleur légère à modérée", "Fièvre"], mecanisme: "Inhibition centrale des prostaglandines", effets: ["Hépatotoxicité à forte dose"] },
    { nom: "Dafalgan", molecule: "Paracétamol", atc: "N02BE01", classe: "Antalgiques non opioïdes", indications: ["Douleur", "Fièvre"], mecanisme: "Inhibition centrale des prostaglandines", effets: ["Hépatotoxicité à forte dose"] },
    // AINS
    { nom: "Ibuprofène", molecule: "Ibuprofène", atc: "M01AE01", classe: "Anti-inflammatoires non stéroïdiens", indications: ["Douleur inflammatoire", "Fièvre", "Douleurs articulaires", "Dysménorrhée", "Douleurs dentaires"], mecanisme: "Inhibition non sélective des COX-1 et COX-2", effets: ["Troubles gastriques", "Ulcère gastrique", "Insuffisance rénale", "Risque cardiovasculaire"] },
    { nom: "Kétoprofène", molecule: "Kétoprofène", atc: "M01AE03", classe: "Anti-inflammatoires non stéroïdiens", indications: ["Douleur inflammatoire", "Rhumatismes", "Douleurs post-opératoires"], mecanisme: "Inhibition des COX", effets: ["Troubles gastriques", "Photosensibilisation"] },
    // Antiseptiques
    { nom: "Chlorhexidine", molecule: "Chlorhexidine digluconate", atc: "D08AC02", classe: "Antiseptiques", indications: ["Antisepsie cutanée", "Bain de bouche", "Désinfection plaie", "Post-extraction dentaire"], mecanisme: "Destruction de la membrane cellulaire bactérienne", effets: ["Irritation locale", "Dysgueusie temporaire", "Coloration dentaire"] },
    // Opioïdes faibles
    { nom: "Tramadol", molecule: "Tramadol", atc: "N02AX02", classe: "Antalgiques opioïdes faibles", indications: ["Douleur modérée à sévère"], mecanisme: "Agoniste opioïde mu + inhibition recapture sérotonine/noradrénaline", effets: ["Nausées", "Vertiges", "Constipation", "Somnolence", "Risque de dépendance"] },
    { nom: "Codéine", molecule: "Codéine", atc: "N02AA59", classe: "Antalgiques opioïdes faibles", indications: ["Douleur modérée", "Toux sèche"], mecanisme: "Prodrogue de la morphine, agoniste opioïde mu", effets: ["Constipation", "Somnolence", "Nausées"] },
    // IPP
    { nom: "Oméprazole", molecule: "Oméprazole", atc: "A02BC01", classe: "Inhibiteurs de la pompe à protons", indications: ["Reflux gastro-œsophagien", "Ulcère gastroduodénal", "Protection gastrique sous AINS", "Éradication H. pylori"], mecanisme: "Inhibition irréversible de la H+/K+-ATPase gastrique", effets: ["Céphalées", "Troubles digestifs", "Carences (Mg, B12, Ca) au long cours"] },
    { nom: "Pantoprazole", molecule: "Pantoprazole", atc: "A02BC02", classe: "Inhibiteurs de la pompe à protons", indications: ["RGO", "Ulcère", "Protection gastrique"], mecanisme: "Inhibition de la pompe à protons", effets: ["Céphalées", "Diarrhée"] },
    // Biguanides
    { nom: "Metformine", molecule: "Metformine", atc: "A10BA02", classe: "Biguanides", indications: ["Diabète de type 2"], mecanisme: "Réduction de la production hépatique de glucose, amélioration de la sensibilité à l'insuline", effets: ["Troubles digestifs", "Diarrhée", "Acidose lactique rare"] },
    // IEC
    { nom: "Ramipril", molecule: "Ramipril", atc: "C09AA05", classe: "Inhibiteurs de l'enzyme de conversion", indications: ["Hypertension artérielle", "Insuffisance cardiaque", "Post-infarctus", "Néphroprotection diabétique"], mecanisme: "Inhibition de l'enzyme de conversion de l'angiotensine", effets: ["Toux sèche", "Hypotension", "Hyperkaliémie", "Angiœdème rare"] },
    { nom: "Périndopril", molecule: "Périndopril", atc: "C09AA04", classe: "Inhibiteurs de l'enzyme de conversion", indications: ["HTA", "Insuffisance cardiaque"], mecanisme: "Inhibition de l'ECA", effets: ["Toux sèche", "Vertiges"] },
    // Bêta-bloquants
    { nom: "Bisoprolol", molecule: "Bisoprolol", atc: "C07AB07", classe: "Bêta-bloquants", indications: ["HTA", "Insuffisance cardiaque", "Angor"], mecanisme: "Blocage sélectif des récepteurs bêta-1 adrénergiques", effets: ["Bradycardie", "Fatigue", "Extrémités froides", "Troubles du sommeil"] },
    // Statines
    { nom: "Atorvastatine", molecule: "Atorvastatine", atc: "C10AA05", classe: "Statines", indications: ["Hypercholestérolémie", "Prévention cardiovasculaire"], mecanisme: "Inhibition de l'HMG-CoA réductase hépatique", effets: ["Myalgies", "Rhabdomyolyse rare", "Troubles hépatiques", "Troubles digestifs"] },
    { nom: "Rosuvastatine", molecule: "Rosuvastatine", atc: "C10AA07", classe: "Statines", indications: ["Hypercholestérolémie", "Prévention cardiovasculaire"], mecanisme: "Inhibition de l'HMG-CoA réductase", effets: ["Myalgies", "Céphalées"] },
    // ISRS
    { nom: "Escitalopram", molecule: "Escitalopram", atc: "N06AB10", classe: "ISRS", indications: ["Épisode dépressif majeur", "Trouble anxieux généralisé", "Trouble panique", "TOC"], mecanisme: "Inhibition sélective de la recapture de la sérotonine", effets: ["Nausées", "Insomnie/somnolence", "Troubles sexuels", "Prise de poids"] },
    { nom: "Sertraline", molecule: "Sertraline", atc: "N06AB06", classe: "ISRS", indications: ["Dépression", "TOC", "Trouble panique", "PTSD"], mecanisme: "Inhibition sélective de la recapture de la sérotonine", effets: ["Diarrhée", "Nausées", "Insomnie"] },
    // Bronchodilatateurs
    { nom: "Ventoline", molecule: "Salbutamol", atc: "R03AC02", classe: "Bronchodilatateurs", indications: ["Asthme", "Bronchospasme", "BPCO"], mecanisme: "Agoniste sélectif des récepteurs bêta-2 adrénergiques bronchiques", effets: ["Tremblements", "Tachycardie", "Céphalées"] },
    // Corticoïdes
    { nom: "Prednisone", molecule: "Prednisone", atc: "H02AB07", classe: "Corticoïdes systémiques", indications: ["Inflammation sévère", "Allergie sévère", "Asthme aigu", "Maladies auto-immunes"], mecanisme: "Inhibition de la phospholipase A2, suppression immunitaire", effets: ["Prise de poids", "Hyperglycémie", "Ostéoporose", "Troubles du sommeil", "Immunosuppression"] },
    { nom: "Prednisolone", molecule: "Prednisolone", atc: "H02AB06", classe: "Corticoïdes systémiques", indications: ["Inflammation", "Allergie", "Asthme"], mecanisme: "Anti-inflammatoire stéroïdien", effets: ["Rétention hydrosodée", "Troubles métaboliques"] },
    // AOD
    { nom: "Xarelto", molecule: "Rivaroxaban", atc: "B01AF01", classe: "Anticoagulants oraux directs", indications: ["Prévention AVC (FA)", "TVP", "Embolie pulmonaire"], mecanisme: "Inhibition directe du facteur Xa", effets: ["Saignements", "Anémie", "Nausées"] },
    { nom: "Eliquis", molecule: "Apixaban", atc: "B01AF02", classe: "Anticoagulants oraux directs", indications: ["Prévention AVC (FA)", "TVP", "EP"], mecanisme: "Inhibition directe du facteur Xa", effets: ["Saignements", "Ecchymoses"] },
    // Antihistaminiques
    { nom: "Cétirizine", molecule: "Cétirizine", atc: "R06AE07", classe: "Antihistaminiques", indications: ["Rhinite allergique", "Urticaire", "Conjonctivite allergique"], mecanisme: "Antagoniste sélectif des récepteurs H1 périphériques", effets: ["Somnolence légère", "Sécheresse buccale", "Céphalées"] },
    { nom: "Desloratadine", molecule: "Desloratadine", atc: "R06AX27", classe: "Antihistaminiques", indications: ["Rhinite allergique", "Urticaire chronique"], mecanisme: "Antagoniste H1 non sédatif", effets: ["Fatigue", "Sécheresse buccale"] },
  ],

  // Contextes thérapeutiques par classe
  contexts: {
    "Antibiotiques - Pénicillines": [
      { desc: "Infection ORL (angine, otite, sinusite)", score: 90 },
      { desc: "Infection respiratoire basse (bronchite, pneumonie)", score: 75 },
      { desc: "Infection urinaire", score: 60 },
      { desc: "Infection dentaire (abcès)", score: 70 },
      { desc: "Infection cutanée", score: 40 },
    ],
    "Antibiotiques - Macrolides": [
      { desc: "Infection respiratoire (bronchite, pneumopathie atypique)", score: 85 },
      { desc: "Angine en cas d'allergie aux pénicillines", score: 70 },
      { desc: "Infection cutanée (impétigo, érysipèle)", score: 50 },
      { desc: "Infection sexuellement transmissible", score: 40 },
    ],
    "Antalgiques non opioïdes": [
      { desc: "Fièvre d'origine diverse", score: 85 },
      { desc: "Céphalées / migraines", score: 80 },
      { desc: "Douleurs dentaires", score: 75 },
      { desc: "Douleurs musculaires / courbatures", score: 70 },
      { desc: "Douleurs post-opératoires légères", score: 50 },
      { desc: "Syndrome grippal", score: 65 },
    ],
    "Anti-inflammatoires non stéroïdiens": [
      { desc: "Douleur inflammatoire articulaire", score: 85 },
      { desc: "Douleurs dentaires inflammatoires", score: 75 },
      { desc: "Dysménorrhée (douleurs menstruelles)", score: 70 },
      { desc: "Traumatisme musculo-squelettique (entorse, contusion)", score: 65 },
      { desc: "Fièvre résistante au paracétamol", score: 50 },
    ],
    "Antiseptiques": [
      { desc: "Mal de gorge / angine (bain de bouche)", score: 80 },
      { desc: "Post-extraction dentaire ou chirurgie buccale", score: 75 },
      { desc: "Plaie cutanée (coupure, éraflure, brûlure légère)", score: 75 },
      { desc: "Aphtes / ulcérations buccales", score: 60 },
      { desc: "Désinfection post-chirurgicale (points de suture)", score: 50 },
    ],
    "Antalgiques opioïdes faibles": [
      { desc: "Douleur post-opératoire modérée", score: 80 },
      { desc: "Douleur dentaire sévère", score: 70 },
      { desc: "Lombalgie aiguë / sciatique", score: 75 },
      { desc: "Douleurs traumatiques (fracture, entorse sévère)", score: 65 },
    ],
    "Inhibiteurs de la pompe à protons": [
      { desc: "Reflux gastro-œsophagien", score: 85 },
      { desc: "Protection gastrique sous AINS ou corticoïdes", score: 80 },
      { desc: "Ulcère gastrique ou duodénal", score: 70 },
      { desc: "Éradication de Helicobacter pylori (avec antibiotiques)", score: 50 },
    ],
    "Biguanides": [
      { desc: "Diabète de type 2 nouvellement diagnostiqué", score: 90 },
      { desc: "Diabète de type 2 en traitement chronique", score: 85 },
    ],
    "Inhibiteurs de l'enzyme de conversion": [
      { desc: "Hypertension artérielle", score: 90 },
      { desc: "Insuffisance cardiaque chronique", score: 70 },
      { desc: "Post-infarctus du myocarde", score: 50 },
      { desc: "Néphropathie diabétique", score: 45 },
    ],
    "Bêta-bloquants": [
      { desc: "Hypertension artérielle", score: 85 },
      { desc: "Insuffisance cardiaque", score: 70 },
      { desc: "Angor / angine de poitrine", score: 60 },
      { desc: "Trouble du rythme cardiaque", score: 55 },
    ],
    "Statines": [
      { desc: "Hypercholestérolémie primaire", score: 85 },
      { desc: "Prévention cardiovasculaire secondaire", score: 80 },
      { desc: "Dyslipidémie mixte", score: 60 },
    ],
    "ISRS": [
      { desc: "Épisode dépressif", score: 85 },
      { desc: "Trouble anxieux généralisé", score: 75 },
      { desc: "Trouble panique", score: 60 },
      { desc: "Trouble obsessionnel compulsif", score: 50 },
    ],
    "Bronchodilatateurs": [
      { desc: "Crise d'asthme / bronchospasme aigu", score: 90 },
      { desc: "BPCO en exacerbation", score: 70 },
      { desc: "Asthme d'effort", score: 60 },
    ],
    "Corticoïdes systémiques": [
      { desc: "Crise d'asthme sévère", score: 80 },
      { desc: "Réaction allergique importante", score: 75 },
      { desc: "Poussée inflammatoire rhumatismale", score: 65 },
      { desc: "Maladie auto-immune", score: 50 },
    ],
    "Anticoagulants oraux directs": [
      { desc: "Fibrillation auriculaire (prévention AVC)", score: 85 },
      { desc: "Thrombose veineuse profonde", score: 75 },
      { desc: "Embolie pulmonaire", score: 60 },
    ],
    "Antihistaminiques": [
      { desc: "Rhinite allergique saisonnière", score: 90 },
      { desc: "Urticaire", score: 75 },
      { desc: "Conjonctivite allergique", score: 65 },
      { desc: "Allergie alimentaire ou médicamenteuse", score: 50 },
    ],
  },

  // Symptômes par contexte + questions + besoins + OTC
  symptomTree: {
    "Infection ORL (angine, otite, sinusite)": {
      symptoms: [
        { symptome: "Mal de gorge", question: "Avez-vous mal à la gorge ?", contexte: "Identifier une possible infection ORL haute", besoin: "Soulagement de la gorge", otc: [{ cat: "Pastilles pour la gorge", desc: "Pastilles apaisantes ou antiseptiques", icon: "🍬", prio: "haute" }, { cat: "Spray gorge", desc: "Spray antiseptique ou anesthésiant local", icon: "💨", prio: "haute" }] },
        { symptome: "Nez bouché ou qui coule", question: "Avez-vous le nez bouché ou qui coule ?", contexte: "Identifier une atteinte nasale associée", besoin: "Décongestion nasale", otc: [{ cat: "Spray nasal salin", desc: "Lavage nasal à l'eau de mer", icon: "🌊", prio: "haute" }, { cat: "Solution de lavage nasal", desc: "Sérum physiologique pour lavage", icon: "💧", prio: "moyenne" }] },
        { symptome: "Douleur à l'oreille", question: "Ressentez-vous une gêne ou douleur au niveau des oreilles ?", contexte: "Identifier une otite associée", besoin: "Soulagement auriculaire", otc: [{ cat: "Gouttes auriculaires apaisantes", desc: "Solution auriculaire pour le confort", icon: "👂", prio: "moyenne" }] },
        { symptome: "Fièvre", question: "Avez-vous de la fièvre ou des frissons ?", contexte: "Évaluer la sévérité de l'infection", besoin: "Gestion de la fièvre", otc: [{ cat: "Thermomètre", desc: "Pour le suivi de la température", icon: "🌡️", prio: "moyenne" }] },
      ],
    },
    "Infection respiratoire basse (bronchite, pneumonie)": {
      symptoms: [
        { symptome: "Toux", question: "Avez-vous de la toux ?", contexte: "Identifier une atteinte respiratoire basse", besoin: "Soulagement de la toux", otc: [{ cat: "Sirop contre la toux", desc: "Sirop adapté au type de toux (sèche ou grasse)", icon: "🍯", prio: "haute" }] },
        { symptome: "Essoufflement", question: "Ressentez-vous un essoufflement ou une difficulté à respirer ?", contexte: "Évaluer l'atteinte respiratoire", besoin: "Confort respiratoire", otc: [{ cat: "Inhalation aux huiles essentielles", desc: "Inhalation pour dégager les voies respiratoires", icon: "🌿", prio: "moyenne" }] },
        { symptome: "Fatigue intense", question: "Vous sentez-vous particulièrement fatigué(e) ?", contexte: "Évaluer l'état général", besoin: "Soutien de la vitalité", otc: [{ cat: "Vitamines et minéraux", desc: "Complexe vitaminique pour la convalescence", icon: "💊", prio: "moyenne" }] },
      ],
    },
    "Infection urinaire": {
      symptoms: [
        { symptome: "Brûlures urinaires", question: "Ressentez-vous des brûlures en urinant ?", contexte: "Confirmer l'atteinte urinaire", besoin: "Confort urinaire", otc: [{ cat: "Canneberge (cranberry)", desc: "Complément alimentaire à base de cranberry", icon: "🫐", prio: "haute" }, { cat: "Sachets urinaires", desc: "Solution alcalinisante pour le confort urinaire", icon: "💧", prio: "haute" }] },
        { symptome: "Envies fréquentes d'uriner", question: "Allez-vous aux toilettes plus souvent que d'habitude ?", contexte: "Évaluer les troubles urinaires", besoin: "Hydratation renforcée", otc: [{ cat: "Tisanes drainantes", desc: "Infusion à visée urinaire", icon: "🍵", prio: "moyenne" }] },
      ],
    },
    "Infection dentaire (abcès)": {
      symptoms: [
        { symptome: "Douleur dentaire", question: "La douleur est-elle localisée au niveau d'une dent ou de la mâchoire ?", contexte: "Identifier un problème dentaire", besoin: "Soulagement dentaire", otc: [{ cat: "Bain de bouche antiseptique", desc: "Bain de bouche pour hygiène buccale", icon: "🫗", prio: "haute" }, { cat: "Gel gingival apaisant", desc: "Gel pour soulager les gencives", icon: "🦷", prio: "haute" }] },
        { symptome: "Gonflement de la joue", question: "Avez-vous un gonflement au niveau du visage ou de la joue ?", contexte: "Évaluer une possible complication", besoin: "Hygiène buccale renforcée", otc: [{ cat: "Brosse à dents souple", desc: "Brosse à dents post-chirurgicale", icon: "🪥", prio: "moyenne" }] },
      ],
    },
    "Plaie cutanée (coupure, éraflure, brûlure légère)": {
      symptoms: [
        { symptome: "Plaie ouverte", question: "Est-ce lié à une plaie ou blessure sur la peau ?", contexte: "Identifier un besoin de soins cutanés", besoin: "Cicatrisation et protection", otc: [{ cat: "Pansements", desc: "Pansements stériles adaptés", icon: "🩹", prio: "haute" }, { cat: "Crème cicatrisante", desc: "Crème favorisant la cicatrisation", icon: "🧴", prio: "haute" }] },
        { symptome: "Rougeur ou irritation cutanée", question: "La zone concernée est-elle rouge ou irritée ?", contexte: "Évaluer l'état de la peau", besoin: "Apaisement cutané", otc: [{ cat: "Compresses stériles", desc: "Compresses pour soins locaux", icon: "🏥", prio: "moyenne" }] },
      ],
    },
    "Post-extraction dentaire ou chirurgie buccale": {
      symptoms: [
        { symptome: "Douleur post-intervention buccale", question: "Avez-vous eu une intervention dentaire ou buccale récemment ?", contexte: "Identifier un contexte post-opératoire buccal", besoin: "Soins post-intervention", otc: [{ cat: "Bain de bouche doux", desc: "Bain de bouche sans alcool pour cicatrisation", icon: "🫗", prio: "haute" }, { cat: "Alimentation adaptée", desc: "Compléments alimentaires liquides ou mous", icon: "🥤", prio: "moyenne" }] },
        { symptome: "Saignement buccal", question: "Avez-vous des saignements au niveau de la bouche ?", contexte: "Évaluer la cicatrisation", besoin: "Arrêt du saignement", otc: [{ cat: "Compresses hémostatiques buccales", desc: "Compresses pour arrêter le saignement buccal", icon: "🩹", prio: "haute" }] },
      ],
    },
    "Reflux gastro-œsophagien": {
      symptoms: [
        { symptome: "Brûlures d'estomac", question: "Ressentez-vous des brûlures d'estomac ou des remontées acides ?", contexte: "Identifier un reflux gastrique", besoin: "Protection gastrique", otc: [{ cat: "Antiacide", desc: "Antiacide en comprimés ou sachets", icon: "💊", prio: "haute" }, { cat: "Pansement gastrique", desc: "Gel protecteur de la muqueuse gastrique", icon: "🛡️", prio: "haute" }] },
        { symptome: "Régurgitations", question: "Avez-vous des remontées alimentaires après les repas ?", contexte: "Évaluer les troubles digestifs hauts", besoin: "Confort digestif", otc: [{ cat: "Coussin de surélévation", desc: "Coussin pour surélever la tête de lit", icon: "🛏️", prio: "moyenne" }] },
      ],
    },
    "Protection gastrique sous AINS ou corticoïdes": {
      symptoms: [
        { symptome: "Prise AINS concomitante", question: "Prenez-vous un anti-inflammatoire en parallèle ?", contexte: "Vérifier le besoin de protection gastrique", besoin: "Protection de l'estomac", otc: [{ cat: "Pansement gastrique", desc: "Gel protecteur gastrique", icon: "🛡️", prio: "haute" }] },
      ],
    },
    "Diabète de type 2 nouvellement diagnostiqué": {
      symptoms: [
        { symptome: "Soif excessive", question: "Avez-vous soif plus que d'habitude ?", contexte: "Évaluer les signes du diabète", besoin: "Suivi glycémique", otc: [{ cat: "Lecteur de glycémie", desc: "Dispositif d'auto-surveillance glycémique", icon: "🩸", prio: "haute" }] },
        { symptome: "Fatigue inhabituelle", question: "Vous sentez-vous anormalement fatigué(e) ?", contexte: "Évaluer l'état général", besoin: "Soutien nutritionnel", otc: [{ cat: "Compléments alimentaires pour diabétiques", desc: "Chrome, magnésium, vitamines du groupe B", icon: "💊", prio: "moyenne" }] },
      ],
    },
    "Diabète de type 2 en traitement chronique": {
      symptoms: [
        { symptome: "Troubles digestifs sous metformine", question: "Avez-vous des troubles digestifs (diarrhée, ballonnements) ?", contexte: "Évaluer la tolérance digestive de la metformine", besoin: "Confort digestif", otc: [{ cat: "Probiotiques", desc: "Probiotiques pour l'équilibre intestinal", icon: "🦠", prio: "haute" }, { cat: "Charbon végétal", desc: "Pour réduire les ballonnements", icon: "⚫", prio: "moyenne" }] },
        { symptome: "Sécheresse cutanée", question: "Votre peau est-elle sèche ou vous démange-t-elle ?", contexte: "Identifier un besoin de soins cutanés chez le patient diabétique", besoin: "Soins cutanés", otc: [{ cat: "Crème hydratante pieds", desc: "Crème spéciale pieds diabétiques", icon: "🦶", prio: "haute" }] },
      ],
    },
    "Hypertension artérielle": {
      symptoms: [
        { symptome: "Toux sèche sous IEC", question: "Avez-vous développé une toux sèche depuis le début du traitement ?", contexte: "Identifier un effet secondaire fréquent des IEC", besoin: "Soulagement de la toux", otc: [{ cat: "Pastilles adoucissantes gorge", desc: "Pastilles au miel pour la toux sèche", icon: "🍬", prio: "moyenne" }] },
        { symptome: "Vertiges", question: "Ressentez-vous des vertiges, surtout en vous levant ?", contexte: "Évaluer une possible hypotension orthostatique", besoin: "Conseil d'hydratation", otc: [{ cat: "Sels de réhydratation", desc: "Solution de réhydratation orale", icon: "💧", prio: "moyenne" }] },
      ],
    },
    "Hypercholestérolémie primaire": {
      symptoms: [
        { symptome: "Douleurs musculaires sous statines", question: "Ressentez-vous des douleurs ou courbatures musculaires ?", contexte: "Identifier un effet secondaire des statines", besoin: "Soutien musculaire", otc: [{ cat: "Magnésium", desc: "Complément de magnésium pour les muscles", icon: "💪", prio: "haute" }, { cat: "Coenzyme Q10", desc: "Complément pour compenser la baisse de CoQ10", icon: "💊", prio: "moyenne" }] },
      ],
    },
    "Épisode dépressif": {
      symptoms: [
        { symptome: "Troubles du sommeil", question: "Avez-vous des difficultés à dormir (insomnie ou sommeil excessif) ?", contexte: "Évaluer les troubles du sommeil associés", besoin: "Amélioration du sommeil", otc: [{ cat: "Mélatonine", desc: "Complément de mélatonine pour le sommeil", icon: "🌙", prio: "haute" }, { cat: "Tisanes relaxantes", desc: "Infusion à base de valériane, passiflore", icon: "🍵", prio: "moyenne" }] },
        { symptome: "Baisse d'énergie", question: "Manquez-vous d'énergie au quotidien ?", contexte: "Évaluer l'asthénie associée", besoin: "Soutien de la vitalité", otc: [{ cat: "Vitamines B et magnésium", desc: "Complexe vitaminique pour l'énergie", icon: "⚡", prio: "moyenne" }] },
        { symptome: "Nausées sous ISRS", question: "Avez-vous des nausées depuis le début du traitement ?", contexte: "Identifier un effet secondaire fréquent", besoin: "Confort digestif", otc: [{ cat: "Gingembre", desc: "Gélules ou pastilles de gingembre anti-nausées", icon: "🫚", prio: "moyenne" }] },
      ],
    },
    "Crise d'asthme / bronchospasme aigu": {
      symptoms: [
        { symptome: "Difficulté respiratoire", question: "Avez-vous des difficultés à respirer ou une sensation d'oppression ?", contexte: "Évaluer la crise respiratoire", besoin: "Confort respiratoire", otc: [{ cat: "Chambre d'inhalation", desc: "Dispositif pour améliorer l'utilisation de l'inhalateur", icon: "🫁", prio: "haute" }] },
        { symptome: "Toux nocturne", question: "Êtes-vous réveillé(e) par la toux la nuit ?", contexte: "Évaluer la sévérité de l'asthme", besoin: "Surveillance des symptômes", otc: [{ cat: "Débitmètre de pointe", desc: "Appareil de mesure du souffle", icon: "📊", prio: "moyenne" }] },
      ],
    },
    "Rhinite allergique saisonnière": {
      symptoms: [
        { symptome: "Nez qui coule / éternuements", question: "Avez-vous le nez qui coule ou des éternuements fréquents ?", contexte: "Identifier une rhinite allergique", besoin: "Soulagement nasal", otc: [{ cat: "Spray nasal antiallergique", desc: "Spray nasal à base de cromoglycate ou corticoïde local", icon: "💨", prio: "haute" }, { cat: "Lavage nasal", desc: "Spray d'eau de mer pour nettoyer le nez", icon: "🌊", prio: "haute" }] },
        { symptome: "Yeux qui piquent", question: "Avez-vous les yeux qui piquent ou qui larmoient ?", contexte: "Identifier une conjonctivite allergique associée", besoin: "Soulagement oculaire", otc: [{ cat: "Collyre antiallergique", desc: "Gouttes oculaires apaisantes", icon: "👁️", prio: "haute" }] },
        { symptome: "Démangeaisons", question: "Ressentez-vous des démangeaisons (nez, palais, gorge) ?", contexte: "Évaluer l'étendue de la réaction allergique", besoin: "Apaisement des démangeaisons", otc: [{ cat: "Baume apaisant", desc: "Crème ou baume anti-démangeaison", icon: "🧴", prio: "moyenne" }] },
      ],
    },
    "Douleur post-opératoire modérée": {
      symptoms: [
        { symptome: "Douleur intense post-opératoire", question: "La douleur est-elle liée à une intervention chirurgicale récente ?", contexte: "Identifier un contexte post-opératoire", besoin: "Gestion de la douleur et récupération", otc: [{ cat: "Coussin de positionnement", desc: "Coussin pour le confort post-opératoire", icon: "🛋️", prio: "moyenne" }, { cat: "Arnica", desc: "Gel ou granules d'arnica pour les ecchymoses", icon: "🌼", prio: "haute" }] },
        { symptome: "Constipation sous opioïdes", question: "Avez-vous des problèmes de transit depuis le début du traitement ?", contexte: "Effet secondaire très fréquent des opioïdes", besoin: "Régulation du transit", otc: [{ cat: "Laxatif osmotique", desc: "Macrogol ou lactulose pour le transit", icon: "💧", prio: "haute" }, { cat: "Probiotiques", desc: "Rééquilibrage de la flore intestinale", icon: "🦠", prio: "moyenne" }] },
      ],
    },
    // Contextes antibiotiques - effets secondaires communs
    "Fièvre d'origine diverse": {
      symptoms: [
        { symptome: "Fièvre", question: "Avez-vous de la fièvre ?", contexte: "Évaluer si fièvre associée", besoin: "Surveillance et hydratation", otc: [{ cat: "Thermomètre digital", desc: "Thermomètre pour le suivi", icon: "🌡️", prio: "haute" }, { cat: "Sels de réhydratation", desc: "Pour maintenir l'hydratation", icon: "💧", prio: "moyenne" }] },
        { symptome: "Fatigue", question: "Vous sentez-vous fatigué(e) ou affaibli(e) ?", contexte: "Évaluer l'état général", besoin: "Récupération", otc: [{ cat: "Vitamines C et D", desc: "Soutien immunitaire", icon: "🍊", prio: "moyenne" }] },
      ],
    },
    "Douleur inflammatoire articulaire": {
      symptoms: [
        { symptome: "Douleur articulaire", question: "Avez-vous des douleurs au niveau des articulations ?", contexte: "Identifier des douleurs articulaires", besoin: "Soulagement articulaire", otc: [{ cat: "Gel anti-inflammatoire local", desc: "Gel à base de diclofénac ou kétoprofène", icon: "🧴", prio: "haute" }, { cat: "Patch chauffant", desc: "Patch thermique pour les douleurs", icon: "🔥", prio: "moyenne" }] },
        { symptome: "Raideur matinale", question: "Ressentez-vous une raideur le matin au réveil ?", contexte: "Identifier une composante inflammatoire chronique", besoin: "Mobilité articulaire", otc: [{ cat: "Glucosamine / Chondroïtine", desc: "Compléments pour le cartilage", icon: "💊", prio: "moyenne" }] },
      ],
    },
    "Dysménorrhée (douleurs menstruelles)": {
      symptoms: [
        { symptome: "Douleurs abdominales basses", question: "Les douleurs sont-elles liées à vos règles ?", contexte: "Identifier une dysménorrhée", besoin: "Soulagement menstruel", otc: [{ cat: "Bouillotte ou patch chauffant", desc: "Chaleur locale pour soulager les crampes", icon: "🔥", prio: "haute" }, { cat: "Tisane antispasmodique", desc: "Infusion de mélisse ou camomille", icon: "🍵", prio: "moyenne" }] },
      ],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase config");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if data already exists
    const { count } = await supabase.from("therapeutic_classes").select("*", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ message: "Data already seeded", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Insert therapeutic classes
    const classMap: Record<string, string> = {};
    for (const cls of PHARMA_DATA.classes) {
      const { data } = await supabase.from("therapeutic_classes").insert({
        nom: cls.nom, description: cls.description, systeme_physiologique: cls.systeme,
      }).select("id").single();
      if (data) classMap[cls.nom] = data.id;
    }

    // 2. Insert medications
    const medMap: Record<string, string> = {};
    for (const med of PHARMA_DATA.medications) {
      const { data } = await supabase.from("medications").insert({
        nom_commercial: med.nom,
        molecule_active: med.molecule,
        code_atc: med.atc,
        classe_therapeutique_id: classMap[med.classe] || null,
        indications_principales: med.indications,
        mecanisme_action: med.mecanisme,
        effets_secondaires_frequents: med.effets,
      }).select("id").single();
      if (data) medMap[med.nom] = data.id;
    }

    // 3. Insert contexts
    const ctxMap: Record<string, string> = {};
    for (const [classeName, contexts] of Object.entries(PHARMA_DATA.contexts)) {
      const classeId = classMap[classeName];
      if (!classeId) continue;
      for (const ctx of contexts) {
        const { data } = await supabase.from("therapeutic_contexts").insert({
          classe_therapeutique_id: classeId,
          description: ctx.desc,
          frequence_score: ctx.score,
        }).select("id").single();
        if (data) ctxMap[ctx.desc] = data.id;
      }
    }

    // 4. Insert symptoms, questions, needs, OTC
    for (const [ctxDesc, tree] of Object.entries(PHARMA_DATA.symptomTree)) {
      const ctxId = ctxMap[ctxDesc];
      if (!ctxId) continue;

      for (const s of tree.symptoms) {
        // Insert symptom
        const { data: symptomData } = await supabase.from("symptoms").insert({
          contexte_id: ctxId, symptome: s.symptome, frequence_score: 50,
        }).select("id").single();
        if (!symptomData) continue;

        // Insert question
        await supabase.from("pharma_questions").insert({
          symptom_id: symptomData.id, question: s.question, contexte_explication: s.contexte,
        });

        // Insert patient need
        const { data: needData } = await supabase.from("patient_needs").insert({
          symptom_id: symptomData.id, besoin: s.besoin,
        }).select("id").single();

        // Insert OTC suggestions
        if (needData && s.otc) {
          for (const otc of s.otc) {
            await supabase.from("otc_suggestions").insert({
              patient_need_id: needData.id,
              categorie_produit: otc.cat,
              description: otc.desc,
              icon: otc.icon,
              priorite: otc.prio,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Pharma data seeded successfully",
      stats: {
        classes: Object.keys(classMap).length,
        medications: Object.keys(medMap).length,
        contexts: Object.keys(ctxMap).length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Seed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
