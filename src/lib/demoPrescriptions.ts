import type { AnalysisResult } from "./prescriptionAnalyzer";
import { Stethoscope, Syringe, HeartPulse, type LucideIcon } from "lucide-react";

export interface DemoPrescription {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  prescriptionPreview: string[];
  result: AnalysisResult;
}

export const DEMO_PRESCRIPTIONS: DemoPrescription[] = [
  {
    id: "medecine-generale",
    label: "Médecine générale",
    description: "Doliprane + Amoxicilline + Drill",
    icon: Stethoscope,
    prescriptionPreview: [
      "Dr. M. Durand — Médecin généraliste",
      "Patient : Mme L., 42 ans",
      "",
      "• Doliprane 1000 mg — 1 cp x 3/jour, 5 jours",
      "• Amoxicilline 1 g — 1 cp x 3/jour, 7 jours",
      "• Drill Miel Citron — 1 pastille x 4/jour si besoin",
    ],
    result: {
      medicaments: [
        {
          nom: "Doliprane 1000 mg",
          classe: "Antalgique / Antipyrétique",
          molecule: "Paracétamol",
          code_atc: "N02BE01",
          conseil_associe:
            "Ne pas dépasser 3 g/jour chez l'adulte. Espacer les prises de 6 h. Surveiller la fièvre et l'hydratation.",
          recommendations: [
            {
              produit: "Magnésium marin 300 mg",
              categorie: "Complément alimentaire",
              priorite: 85,
              phrase_conseil:
                "Aide à récupérer après l'épisode fébrile et à retrouver du tonus sur quelques jours.",
            },
          ],
        },
        {
          nom: "Amoxicilline 1 g",
          classe: "Antibiotique β-lactamine",
          molecule: "Amoxicilline",
          code_atc: "J01CA04",
          conseil_associe:
            "Prendre toutes les 8 h, terminer la cure complète. Signaler tout signe d'allergie cutanée.",
          recommendations: [
            {
              produit: "Ultra-Levure 200 mg / Lactibiane ATB",
              categorie: "Probiotique",
              priorite: 95,
              phrase_conseil:
                "Protège la flore intestinale pendant la cure d'antibiotique et limite ballonnements et diarrhées.",
            },
          ],
        },
        {
          nom: "Drill Miel Citron",
          classe: "Antiseptique pharyngé",
          molecule: "Chlorhexidine + tétracaïne",
          conseil_associe:
            "Laisser fondre lentement en bouche. Ne pas associer à un autre antiseptique local.",
          recommendations: [
            {
              produit: "Spray gorge propolis",
              categorie: "Voies respiratoires",
              priorite: 80,
              phrase_conseil:
                "Apaise localement et complète l'action de la pastille pour soulager plus vite les irritations.",
            },
          ],
        },
      ],
      interactions: [],
      contextes: ["Infection ORL", "Épisode fébrile aigu"],
      conseil:
        "Hydratation régulière, repos, surveillance de la température 2 fois par jour. Reconsulter si fièvre > 48 h sous antibiotique.",
      structuredData: true,
      sources: ["Démonstration"],
    },
  },
  {
    id: "soins-infirmiers",
    label: "Soins infirmiers",
    description: "Compresses + Set pansement + Sparadrap + Sérum physio",
    icon: Syringe,
    prescriptionPreview: [
      "Dr. C. Bernard — Chirurgien",
      "Patient : M. R., 67 ans",
      "",
      "• Compresses stériles 7,5 x 7,5 cm — 1 boîte",
      "• Set de pansement post-opératoire — 1 boîte",
      "• Sparadrap hypoallergénique — 1 rouleau",
      "• Sérum physiologique 10 ml — 20 unidoses",
      "• Passage IDE matin et soir, 10 jours",
    ],
    result: {
      medicaments: [
        {
          nom: "Soins de cicatrice (matériel infirmier)",
          classe: "Dispositif médical",
          conseil_associe:
            "Réfection du pansement selon prescription IDE. Garder la zone propre et sèche entre les passages.",
          recommendations: [
            {
              produit: "Crème cicatrisante (Cicalfate / Cicabio)",
              categorie: "Cicatrisation",
              priorite: 90,
              phrase_conseil:
                "Accélère la régénération cutanée après la cicatrisation initiale et limite les marques.",
            },
            {
              produit: "Pansement hydrocolloïde de secours",
              categorie: "Dispositif médical",
              priorite: 80,
              phrase_conseil:
                "Pratique en remplacement si le pansement se décolle entre deux passages infirmier.",
            },
            {
              produit: "Solution antiseptique douce (chlorhexidine)",
              categorie: "Antiseptique",
              priorite: 75,
              phrase_conseil:
                "Utile en cas de salissure inattendue avant le prochain passage soignant.",
            },
          ],
        },
      ],
      interactions: [],
      contextes: ["Soins post-opératoires", "Cicatrisation"],
      conseil:
        "Surveiller signes locaux : rougeur, chaleur, écoulement. Prévenir l'IDE en cas d'évolution anormale.",
      structuredData: true,
      sources: ["Démonstration"],
    },
  },
  {
    id: "cardiologie",
    label: "Cardiologie",
    description: "Kardegic + Bisoprolol + Crestor + Lasilix",
    icon: HeartPulse,
    prescriptionPreview: [
      "Dr. P. Lemoine — Cardiologue",
      "Patient : M. T., 71 ans",
      "",
      "• Kardegic 75 mg — 1 sachet/jour, le midi",
      "• Bisoprolol 2,5 mg — 1 cp le matin",
      "• Crestor 10 mg — 1 cp le soir",
      "• Lasilix 40 mg — 1 cp le matin",
      "• Renouvellement 3 mois",
    ],
    result: {
      medicaments: [
        {
          nom: "Kardegic 75 mg",
          classe: "Antiagrégant plaquettaire",
          molecule: "Acétylsalicylate de lysine",
          code_atc: "B01AC06",
          conseil_associe:
            "Surveillance des saignements (gencives, ecchymoses). Éviter aspirine et AINS en automédication.",
          recommendations: [],
        },
        {
          nom: "Bisoprolol 2,5 mg",
          classe: "Bêta-bloquant cardiosélectif",
          molecule: "Bisoprolol",
          code_atc: "C07AB07",
          conseil_associe:
            "Prendre le matin. Ne pas arrêter brutalement. Surveiller fréquence cardiaque et tension.",
          recommendations: [
            {
              produit: "Tensiomètre auto-poignet",
              categorie: "Auto-mesure",
              priorite: 90,
              phrase_conseil:
                "Permet un suivi régulier de l'efficacité du traitement et rassure le patient au quotidien.",
            },
          ],
        },
        {
          nom: "Crestor 10 mg",
          classe: "Statine",
          molecule: "Rosuvastatine",
          code_atc: "C10AA07",
          conseil_associe:
            "Prendre le soir. Signaler toute douleur musculaire inhabituelle.",
          recommendations: [
            {
              produit: "Coenzyme Q10 100 mg",
              categorie: "Complément alimentaire",
              priorite: 85,
              phrase_conseil:
                "Soutient le tonus musculaire, souvent recherché par les patients sous statine sur le long terme.",
            },
          ],
        },
        {
          nom: "Lasilix 40 mg",
          classe: "Diurétique de l'anse",
          molecule: "Furosémide",
          code_atc: "C03CA01",
          conseil_associe:
            "Prendre le matin pour éviter les levers nocturnes. Surveillance kaliémie régulière.",
          recommendations: [
            {
              produit: "Magnésium + apports potassium (banane, eau riche)",
              categorie: "Minéraux",
              priorite: 88,
              phrase_conseil:
                "Compense les pertes minérales liées au diurétique et limite les crampes nocturnes.",
            },
          ],
        },
      ],
      interactions: [
        {
          medicaments: ["Bisoprolol", "Lasilix"],
          niveau: "modérée",
          description:
            "Risque d'hypokaliémie majorée et hypotension orthostatique. Surveillance kaliémie et tension recommandée.",
        },
      ],
      contextes: ["Insuffisance cardiaque", "Prévention cardiovasculaire"],
      conseil:
        "Observance stricte matin/soir. Suivi tensionnel hebdomadaire. Bilan biologique selon prescription cardiologue.",
      structuredData: true,
      sources: ["Démonstration"],
    },
  },
];
