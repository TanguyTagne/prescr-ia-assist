import { supabase } from "@/integrations/supabase/client";

export interface Interaction {
  medicaments: string[];
  niveau: "majeure" | "modérée" | "mineure";
  description: string;
}

export interface MedicamentInfo {
  nom: string;
  classe: string;
  molecule?: string;
  code_atc?: string;
  conseil_associe?: string;
  recommendations?: Recommendation[];
}

export interface Recommendation {
  produit: string;
  categorie: string;
  description?: string;
  priorite: number;
  pathologie?: string;
  ordered?: boolean;
}

export interface LGOProduct {
  nom: string;
  cip: string;
  prix: number;
  stock: number;
  categorie?: string;
}

export interface Suggestion {
  categorie: string;
  raison: string;
  icon: string;
  priorite?: "haute" | "moyenne";
  produits_lgo?: LGOProduct[];
}

export interface AnalysisResult {
  medicaments: MedicamentInfo[];
  interactions: Interaction[];
  contextes: string[];
  conseil: string;
  structuredData?: boolean;
  sources?: string[];
  duplicate_warning?: {
    count: number;
    last_seen: string;
  };
  patient_history?: {
    previous_analyses: number;
    first_seen: string;
  };
  patient_name?: string;
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

export async function trackRecommendationUsage(
  eventType: string,
  questionId?: string,
  otcSuggestionId?: string
): Promise<void> {
  try {
    await supabase.from("recommendation_usage").insert({
      event_type: eventType,
      question_id: questionId || null,
      otc_suggestion_id: otcSuggestionId || null,
      user_id: (await supabase.auth.getUser()).data.user?.id || null,
    });
  } catch (e) {
    console.error("Failed to track usage:", e);
  }
}

export async function seedPharmaData(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("seed-pharma-data");
  if (error) throw new Error(error.message || "Erreur lors du seed");
  return data;
}

function normalizeResult(data: any): AnalysisResult {
  return {
    medicaments: (data.medicaments || []).map((med: any) => ({
      nom: med.nom,
      classe: med.classe,
      molecule: med.molecule,
      code_atc: med.code_atc,
      recommendations: (med.recommendations || []).slice(0, 3),
    })),
    interactions: data.interactions || [],
    contextes: data.contextes || [],
    conseil: data.conseil || "",
    structuredData: data.structuredData || false,
    sources: data.sources || [],
    duplicate_warning: data.duplicate_warning || undefined,
    patient_history: data.patient_history || undefined,
    patient_name: data.patient_name || undefined,
  };
}
