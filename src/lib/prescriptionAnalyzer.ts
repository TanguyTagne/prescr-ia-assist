// Mock analysis engine — will be replaced by AI backend later

export interface MedicamentInfo {
  nom: string;
  classe: string;
}

export interface Suggestion {
  categorie: string;
  raison: string;
  icon: string;
}

export interface AnalysisResult {
  medicaments: MedicamentInfo[];
  contextes: string[];
  questions: string[];
  suggestions: Suggestion[];
}

interface DrugData {
  classe: string;
  contextes: string[];
  questions: string[];
  suggestions: Suggestion[];
}

const DRUG_DATABASE: Record<string, DrugData> = {
  amoxicilline: {
    classe: "Antibiotique (pénicilline)",
    contextes: ["inconfort respiratoire", "irritation de la gorge", "inflammation dentaire"],
    questions: [
      "Avez-vous mal à la gorge ?",
      "Avez-vous de la fièvre ?",
      "Avez-vous des douleurs dentaires ?",
      "Prenez-vous d'autres médicaments actuellement ?",
    ],
    suggestions: [
      { categorie: "Probiotiques", raison: "Les antibiotiques peuvent perturber l'équilibre de la flore intestinale", icon: "🦠" },
      { categorie: "Pastilles gorge", raison: "Souvent associées à un inconfort de la gorge", icon: "🍬" },
    ],
  },
  paracetamol: {
    classe: "Antalgique / Antipyrétique",
    contextes: ["douleurs légères à modérées", "état fébrile", "inconfort général"],
    questions: [
      "Depuis combien de temps avez-vous mal ?",
      "Avez-vous de la fièvre ?",
      "Prenez-vous déjà un autre médicament contenant du paracétamol ?",
    ],
    suggestions: [
      { categorie: "Vitamine C", raison: "Souvent associée au soutien de l'organisme en période d'inconfort", icon: "🍊" },
    ],
  },
  doliprane: {
    classe: "Antalgique / Antipyrétique",
    contextes: ["douleurs légères à modérées", "état fébrile", "inconfort général"],
    questions: [
      "Depuis combien de temps avez-vous mal ?",
      "Avez-vous de la fièvre ?",
      "Prenez-vous déjà un autre médicament contenant du paracétamol ?",
    ],
    suggestions: [
      { categorie: "Vitamine C", raison: "Souvent associée au soutien de l'organisme en période d'inconfort", icon: "🍊" },
    ],
  },
  ibuprofene: {
    classe: "Anti-inflammatoire (AINS)",
    contextes: ["douleurs inflammatoires", "inconfort articulaire", "douleurs musculaires"],
    questions: [
      "Avez-vous des douleurs articulaires ?",
      "Avez-vous des troubles digestifs ?",
      "Prenez-vous un anticoagulant ?",
    ],
    suggestions: [
      { categorie: "Protecteur gastrique", raison: "Les AINS peuvent être associés à un inconfort digestif", icon: "🛡️" },
      { categorie: "Gel anti-inflammatoire", raison: "Alternative locale pour le confort articulaire", icon: "💧" },
    ],
  },
  metformine: {
    classe: "Antidiabétique oral",
    contextes: ["gestion glycémique", "accompagnement métabolique"],
    questions: [
      "Suivez-vous un régime alimentaire particulier ?",
      "Avez-vous des troubles digestifs avec ce traitement ?",
      "Contrôlez-vous régulièrement votre glycémie ?",
    ],
    suggestions: [
      { categorie: "Compléments chrome/zinc", raison: "Souvent associés à l'accompagnement du métabolisme glucidique", icon: "💊" },
      { categorie: "Probiotiques", raison: "Peuvent accompagner le confort digestif", icon: "🦠" },
    ],
  },
  omeprazole: {
    classe: "Inhibiteur de la pompe à protons",
    contextes: ["inconfort gastrique", "reflux", "protection gastrique sous traitement"],
    questions: [
      "Avez-vous des brûlures d'estomac ?",
      "Prenez-vous ce médicament depuis longtemps ?",
      "Avez-vous modifié votre alimentation récemment ?",
    ],
    suggestions: [
      { categorie: "Magnésium", raison: "L'utilisation prolongée d'IPP peut être associée à un besoin accru en magnésium", icon: "✨" },
      { categorie: "Calcium + Vitamine D", raison: "Accompagnement osseux souvent recommandé lors d'usage prolongé d'IPP", icon: "🦴" },
    ],
  },
};

export function analyzePrescription(input: string): AnalysisResult {
  const normalized = input.toLowerCase().trim();
  const words = normalized.split(/[\s,;.\n]+/).filter(Boolean);

  const foundDrugs: MedicamentInfo[] = [];
  const allContextes = new Set<string>();
  const allQuestions = new Set<string>();
  const allSuggestions = new Map<string, Suggestion>();

  for (const word of words) {
    for (const [drugName, data] of Object.entries(DRUG_DATABASE)) {
      if (word.includes(drugName) || drugName.includes(word)) {
        if (!foundDrugs.find(d => d.nom.toLowerCase() === drugName)) {
          foundDrugs.push({ nom: drugName.charAt(0).toUpperCase() + drugName.slice(1), classe: data.classe });
          data.contextes.forEach(c => allContextes.add(c));
          data.questions.forEach(q => allQuestions.add(q));
          data.suggestions.forEach(s => allSuggestions.set(s.categorie, s));
        }
      }
    }
  }

  return {
    medicaments: foundDrugs,
    contextes: Array.from(allContextes),
    questions: Array.from(allQuestions),
    suggestions: Array.from(allSuggestions.values()),
  };
}
