import type { AnalysisResult } from "./prescriptionAnalyzer";
import { Stethoscope, Syringe, HeartPulse, type LucideIcon } from "lucide-react";
import type { Lang } from "@/i18n/translations";

export interface DemoPrescription {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  prescriptionPreview: string[];
  result: AnalysisResult;
}

const FR: DemoPrescription[] = [
  {
    id: "medecine-generale",
    label: "Médecine générale",
    description: "Doliprane + Amoxicilline + Pastille pour la gorge",
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
          conseil_associe: "Ne pas dépasser 3 g/jour chez l'adulte. Espacer les prises de 6 h. Surveiller la fièvre et l'hydratation.",
          recommendations: [
            {
              produit: "Magnésium marin 300 mg",
              categorie: "Complément alimentaire",
              priorite: 85,
              phrase_conseil: "Pour retrouver toute votre énergie après un épisode de fièvre, le magnésium vous aidera à combattre la fatigue et retrouver votre vitalité.",
            },
          ],
        },
        {
          nom: "Amoxicilline 1 g",
          classe: "Antibiotique β-lactamine",
          molecule: "Amoxicilline",
          code_atc: "J01CA04",
          conseil_associe: "Prendre toutes les 8 h, terminer la cure complète. Signaler tout signe d'allergie cutanée.",
          recommendations: [
            {
              produit: "Ultra-Levure 200 mg / Lactibiane ATB",
              categorie: "Probiotique",
              priorite: 95,
              phrase_conseil: "Afin de protéger votre flore intestinale et éviter des gênes comme les ballonnements, je vous conseille de prendre un probiotique avec votre antibiotique.",
            },
          ],
        },
        {
          nom: "Drill Miel Citron",
          classe: "Antiseptique pharyngé",
          molecule: "Chlorhexidine + tétracaïne",
          conseil_associe: "Laisser fondre lentement en bouche. Ne pas associer à un autre antiseptique local.",
          recommendations: [
            {
              produit: "Spray gorge propolis",
              categorie: "Voies respiratoires",
              priorite: 80,
              phrase_conseil: "Pour soulager rapidement cette irritation, un spray à la propolis agira directement sur votre gorge et apaisera la douleur.",
            },
          ],
        },
      ],
      interactions: [],
      contextes: ["Infection ORL", "Épisode fébrile aigu"],
      conseil: "Hydratation régulière, repos, surveillance de la température 2 fois par jour. Reconsulter si fièvre > 48 h sous antibiotique.",
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
          conseil_associe: "Réfection du pansement selon prescription IDE. Garder la zone propre et sèche entre les passages.",
          recommendations: [
            { produit: "Crème cicatrisante (Cicalfate / Cicabio)", categorie: "Cicatrisation", priorite: 90, phrase_conseil: "Pour une belle cicatrisation, cette crème favorisera la régénération de votre peau et atténuera l'aspect de la cicatrice au fil du temps." },
            { produit: "Pansement hydrocolloïde de secours", categorie: "Dispositif médical", priorite: 80, phrase_conseil: "Si par hasard votre pansement se décolle, ce pansement de secours vous permet de protéger votre plaie en attendant le passage de l'infirmier." },
            { produit: "Solution antiseptique douce (chlorhexidine)", categorie: "Antiseptique", priorite: 75, phrase_conseil: "Pour nettoyer votre cicatrice en douceur si elle se salit, cette solution antiseptique douce est parfaite en attendant votre prochain soin." },
          ],
        },
      ],
      interactions: [],
      contextes: ["Soins post-opératoires", "Cicatrisation"],
      conseil: "Surveiller signes locaux : rougeur, chaleur, écoulement. Prévenir l'IDE en cas d'évolution anormale.",
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
        { nom: "Kardegic 75 mg", classe: "Antiagrégant plaquettaire", molecule: "Acétylsalicylate de lysine", code_atc: "B01AC06", conseil_associe: "Surveillance des saignements (gencives, ecchymoses). Éviter aspirine et AINS en automédication.", recommendations: [] },
        { nom: "Bisoprolol 2,5 mg", classe: "Bêta-bloquant cardiosélectif", molecule: "Bisoprolol", code_atc: "C07AB07", conseil_associe: "Prendre le matin. Ne pas arrêter brutalement. Surveiller fréquence cardiaque et tension.", recommendations: [{ produit: "Tensiomètre auto-poignet", categorie: "Auto-mesure", priorite: 90, phrase_conseil: "Pour mieux suivre votre tension à la maison, ce tensiomètre de poignet vous permettra de mesurer et de noter vos chiffres facilement." }] },
        { nom: "Crestor 10 mg", classe: "Statine", molecule: "Rosuvastatine", code_atc: "C10AA07", conseil_associe: "Prendre le soir. Signaler toute douleur musculaire inhabituelle.", recommendations: [{ produit: "Coenzyme Q10 100 mg", categorie: "Complément alimentaire", priorite: 85, phrase_conseil: "Pour votre confort musculaire, ce complément est souvent recommandé avec les statines pour vous aider à préserver votre tonus au quotidien." }] },
        { nom: "Lasilix 40 mg", classe: "Diurétique de l'anse", molecule: "Furosémide", code_atc: "C03CA01", conseil_associe: "Prendre le matin pour éviter les levers nocturnes. Surveillance kaliémie régulière.", recommendations: [{ produit: "Magnésium + apports potassium (banane, eau riche)", categorie: "Minéraux", priorite: 88, phrase_conseil: "Pour compenser la perte de minéraux causée par votre diurétique, cet apport en magnésium et potassium vous aidera à éviter la fatigue et les crampes." }] },
      ],
      interactions: [{ medicaments: ["Bisoprolol", "Lasilix"], niveau: "modérée", description: "Risque d'hypokaliémie majorée et hypotension orthostatique. Surveillance kaliémie et tension recommandée." }],
      contextes: ["Insuffisance cardiaque", "Prévention cardiovasculaire"],
      conseil: "Observance stricte matin/soir. Suivi tensionnel hebdomadaire. Bilan biologique selon prescription cardiologue.",
      structuredData: true,
      sources: ["Démonstration"],
    },
  },
];

const EN: DemoPrescription[] = [
  {
    id: "medecine-generale",
    label: "General medicine",
    description: "Acetaminophen + Amoxicillin + Throat lozenges",
    icon: Stethoscope,
    prescriptionPreview: [
      "Dr. M. Durand — General practitioner",
      "Patient: Mrs. L., 42 yrs",
      "",
      "• Acetaminophen 1000 mg — 1 tab x 3/day, 5 days",
      "• Amoxicillin 1 g — 1 tab x 3/day, 7 days",
      "• Honey-lemon throat lozenges — 1 lozenge x 4/day if needed",
    ],
    result: {
      medicaments: [
        {
          nom: "Acetaminophen 1000 mg",
          classe: "Analgesic / Antipyretic",
          molecule: "Acetaminophen",
          code_atc: "N02BE01",
          conseil_associe: "Do not exceed 3 g/day in adults. Space doses 6 hours apart. Monitor fever and hydration.",
          recommendations: [
            {
              produit: "Marine magnesium 300 mg",
              categorie: "Dietary supplement",
              priorite: 85,
              phrase_conseil: "To regain your full energy after a fever episode, magnesium will help you fight fatigue and recover your vitality.",
            },
          ],
        },
        {
          nom: "Amoxicillin 1 g",
          classe: "β-lactam antibiotic",
          molecule: "Amoxicillin",
          code_atc: "J01CA04",
          conseil_associe: "Take every 8 hours, complete the full course. Report any sign of skin allergy.",
          recommendations: [
            {
              produit: "Saccharomyces boulardii / Probiotic blend",
              categorie: "Probiotic",
              priorite: 95,
              phrase_conseil: "To protect your gut flora and avoid discomfort like bloating, I recommend taking a probiotic alongside your antibiotic.",
            },
          ],
        },
        {
          nom: "Honey-lemon throat lozenges",
          classe: "Throat antiseptic",
          molecule: "Chlorhexidine + tetracaine",
          conseil_associe: "Let dissolve slowly in the mouth. Do not combine with another local antiseptic.",
          recommendations: [
            {
              produit: "Propolis throat spray",
              categorie: "Respiratory",
              priorite: 80,
              phrase_conseil: "To quickly soothe this irritation, a propolis spray will act directly on your throat and ease the pain.",
            },
          ],
        },
      ],
      interactions: [],
      contextes: ["ENT infection", "Acute febrile episode"],
      conseil: "Regular hydration, rest, monitor temperature twice daily. See your doctor again if fever lasts > 48 h on antibiotics.",
      structuredData: true,
      sources: ["Demonstration"],
    },
  },
  {
    id: "soins-infirmiers",
    label: "Nursing care",
    description: "Sterile gauze + Dressing kit + Tape + Saline",
    icon: Syringe,
    prescriptionPreview: [
      "Dr. C. Bernard — Surgeon",
      "Patient: Mr. R., 67 yrs",
      "",
      "• Sterile gauze 7.5 x 7.5 cm — 1 box",
      "• Post-op dressing kit — 1 box",
      "• Hypoallergenic tape — 1 roll",
      "• Saline 10 ml — 20 single-dose vials",
      "• Nurse visit morning and evening, 10 days",
    ],
    result: {
      medicaments: [
        {
          nom: "Wound care (nursing supplies)",
          classe: "Medical device",
          conseil_associe: "Re-dress per nurse's prescription. Keep the area clean and dry between visits.",
          recommendations: [
            { produit: "Healing cream (Cicalfate / Cicabio)", categorie: "Wound healing", priorite: 90, phrase_conseil: "For optimal healing, this cream supports skin regeneration and reduces the appearance of the scar over time." },
            { produit: "Backup hydrocolloid dressing", categorie: "Medical device", priorite: 80, phrase_conseil: "If your dressing comes loose, this backup dressing protects your wound until the nurse's next visit." },
            { produit: "Mild antiseptic solution (chlorhexidine)", categorie: "Antiseptic", priorite: 75, phrase_conseil: "To gently clean your wound if it gets dirty, this mild antiseptic is perfect until your next nursing visit." },
          ],
        },
      ],
      interactions: [],
      contextes: ["Post-op care", "Wound healing"],
      conseil: "Watch for local signs: redness, warmth, discharge. Alert the nurse if anything looks abnormal.",
      structuredData: true,
      sources: ["Demonstration"],
    },
  },
  {
    id: "cardiologie",
    label: "Cardiology",
    description: "Aspirin + Bisoprolol + Rosuvastatin + Furosemide",
    icon: HeartPulse,
    prescriptionPreview: [
      "Dr. P. Lemoine — Cardiologist",
      "Patient: Mr. T., 71 yrs",
      "",
      "• Low-dose aspirin 75 mg — 1 sachet/day at noon",
      "• Bisoprolol 2.5 mg — 1 tab in the morning",
      "• Rosuvastatin 10 mg — 1 tab in the evening",
      "• Furosemide 40 mg — 1 tab in the morning",
      "• 3-month renewal",
    ],
    result: {
      medicaments: [
        { nom: "Low-dose aspirin 75 mg", classe: "Antiplatelet", molecule: "Acetylsalicylic acid", code_atc: "B01AC06", conseil_associe: "Watch for bleeding (gums, bruising). Avoid OTC aspirin and NSAIDs.", recommendations: [] },
        { nom: "Bisoprolol 2.5 mg", classe: "Cardioselective beta-blocker", molecule: "Bisoprolol", code_atc: "C07AB07", conseil_associe: "Take in the morning. Do not stop abruptly. Monitor heart rate and blood pressure.", recommendations: [{ produit: "Wrist blood pressure monitor", categorie: "Self-monitoring", priorite: 90, phrase_conseil: "To better track your blood pressure at home, this wrist monitor lets you measure and log your numbers easily." }] },
        { nom: "Rosuvastatin 10 mg", classe: "Statin", molecule: "Rosuvastatin", code_atc: "C10AA07", conseil_associe: "Take in the evening. Report any unusual muscle pain.", recommendations: [{ produit: "Coenzyme Q10 100 mg", categorie: "Dietary supplement", priorite: 85, phrase_conseil: "For muscle comfort, this supplement is often recommended with statins to help preserve your daily energy." }] },
        { nom: "Furosemide 40 mg", classe: "Loop diuretic", molecule: "Furosemide", code_atc: "C03CA01", conseil_associe: "Take in the morning to avoid nighttime bathroom trips. Regular potassium monitoring required.", recommendations: [{ produit: "Magnesium + potassium intake (banana, mineral water)", categorie: "Minerals", priorite: 88, phrase_conseil: "To make up for the minerals lost due to your diuretic, this magnesium and potassium intake will help you avoid fatigue and cramps." }] },
      ],
      interactions: [{ medicaments: ["Bisoprolol", "Furosemide"], niveau: "modérée", description: "Increased risk of hypokalemia and orthostatic hypotension. Monitor potassium and blood pressure." }],
      contextes: ["Heart failure", "Cardiovascular prevention"],
      conseil: "Strict morning/evening adherence. Weekly blood pressure check. Lab monitoring per cardiologist's instructions.",
      structuredData: true,
      sources: ["Demonstration"],
    },
  },
];

export const getDemoPrescriptions = (lang: Lang): DemoPrescription[] =>
  lang === "en" ? EN : FR;

/** @deprecated use getDemoPrescriptions(lang) */
export const DEMO_PRESCRIPTIONS = FR;
