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
  priorite?: "haute" | "moyenne";
}

export interface AnalysisQuestion {
  question: string;
  contexte: string;
}

export interface AnalysisResult {
  medicaments: MedicamentInfo[];
  interactions: Interaction[];
  contextes: string[];
  questions: AnalysisQuestion[];
  conseil: string;
}

export interface RefinedResult {
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

export async function refinePrescription(
  analysisContext: AnalysisResult,
  answers: Record<number, boolean>
): Promise<RefinedResult> {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: {
      mode: "refine",
      analysisContext,
      answers,
    },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Erreur lors de l'affinage");
  }
  if (data?.error) throw new Error(data.error);

  return {
    suggestions: data.suggestions || [],
    conseil: data.conseil || "",
  };
}

function normalizeResult(data: any): AnalysisResult {
  return {
    medicaments: data.medicaments || [],
    interactions: data.interactions || [],
    contextes: data.contextes || [],
    questions: (data.questions || []).slice(0, 5),
    conseil: data.conseil || "",
  };
}
