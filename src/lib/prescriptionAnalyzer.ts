import { supabase } from "@/integrations/supabase/client";

export interface Interaction {
  medicaments: string[];
  niveau: "majeure" | "modérée" | "mineure";
  description: string;
}

export interface MedicamentInfo {
  nom: string;
  classe: string;
}

export interface Suggestion {
  categorie: string;
  raison: string;
  icon: string;
}

export interface InteractiveQuestion {
  question: string;
  suggestions_oui: Suggestion[];
  suggestions_non: Suggestion[];
}

export interface AnalysisResult {
  medicaments: MedicamentInfo[];
  interactions: Interaction[];
  contextes: string[];
  questions: InteractiveQuestion[];
  suggestions: Suggestion[];
  conseil: string;
}

export async function analyzePrescription(input: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: { prescriptionText: input },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse");
  }

  if (data?.error) throw new Error(data.error);

  return normalizeResult(data);
}

export async function analyzePrescriptionImage(imageBase64: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: { imageBase64 },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse OCR");
  }

  if (data?.error) throw new Error(data.error);

  return normalizeResult(data);
}

function normalizeResult(data: any): AnalysisResult {
  return {
    medicaments: data.medicaments || [],
    interactions: data.interactions || [],
    contextes: data.contextes || [],
    questions: (data.questions || []).slice(0, 2),
    suggestions: (data.suggestions || []).slice(0, 2),
    conseil: data.conseil || "",
  };
}
