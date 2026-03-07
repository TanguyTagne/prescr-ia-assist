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

export interface AnalysisResult {
  medicaments: MedicamentInfo[];
  interactions: Interaction[];
  contextes: string[];
  questions: string[];
  suggestions: Suggestion[];
}

export async function analyzePrescription(input: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: { prescriptionText: input },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    medicaments: data.medicaments || [],
    interactions: data.interactions || [],
    contextes: data.contextes || [],
    questions: data.questions || [],
    suggestions: data.suggestions || [],
  };
}

export async function analyzePrescriptionImage(imageBase64: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: { imageBase64 },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse OCR");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    medicaments: data.medicaments || [],
    interactions: data.interactions || [],
    contextes: data.contextes || [],
    questions: data.questions || [],
    suggestions: data.suggestions || [],
  };
}
