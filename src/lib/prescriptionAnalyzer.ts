import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { beginCriticalTask, endCriticalTask } from "@/lib/criticalTask";


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
  /** Avertissement de sécurité (ne vend rien) — champ "vigilance" de la base. */
  vigilance?: { titre: string; phrase?: string; pertinence?: string };
  recommendations?: Recommendation[];
  // CIP du code-barre scanné — alimenté quand l'analyse vient d'un scan douchette.
  // Permet au pharmacien de signaler un mauvais référencement avec le CIP exact.
  cip_scanned?: string;
}

export interface Recommendation {
  produit: string;
  categorie: string;
  description?: string;
  priorite: number;
  pathologie?: string;
  ordered?: boolean;
  phrase_conseil?: string;
  pertinence?: string;
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


/**
 * Complète la vigilance manquante AVANT le rendu.
 *
 * La phrase de vigilance peut manquer dans la réponse d'`analyze-prescription`
 * — typiquement quand la fonction edge déployée est antérieure à l'ajout des
 * colonnes vigilance. On la relit alors directement en base, ici, pendant que
 * l'appel est encore en cours : le composant reçoit un résultat déjà complet
 * et n'a aucun effet asynchrone à jouer après coup.
 *
 * Trois passes, de la plus précise à la plus large :
 *   1) le CIP scanné ;
 *   2) le nom commercial (préfixe du premier mot) ;
 *   3) le code ATC — la vigilance de la base est écrite PAR CLASSE, donc
 *      n'importe quelle ligne de la même classe porte la bonne phrase.
 */
const VIGILANCE_COLS = "medicament_id, vigilance, phrase_vigilance, pertinence_vigilance";

type CuratedVigilanceRow = {
  medicament_id: string;
  vigilance: string | null;
  phrase_vigilance: string | null;
  pertinence_vigilance: string | null;
};

function toVigilance(row?: CuratedVigilanceRow | null): MedicamentInfo["vigilance"] | null {
  const titre = row?.vigilance?.trim() || row?.phrase_vigilance?.trim();
  if (!titre) return null;
  return {
    titre,
    phrase: row?.vigilance?.trim() ? row?.phrase_vigilance?.trim() || undefined : undefined,
    pertinence: row?.pertinence_vigilance?.trim() || "Sécurité",
  };
}

async function vigilanceFromMedIds(ids: string[]): Promise<MedicamentInfo["vigilance"] | null> {
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from("medicament_curated_pcs")
    .select(VIGILANCE_COLS)
    .in("medicament_id", ids);
  const rows = (data || []) as CuratedVigilanceRow[];
  const byId = new Map(rows.map((row) => [row.medicament_id, row]));
  for (const id of ids) {
    const hit = toVigilance(byId.get(id));
    if (hit) return hit;
  }
  for (const row of rows) {
    const hit = toVigilance(row);
    if (hit) return hit;
  }
  return null;
}

export async function fillMissingVigilance(meds: MedicamentInfo[]): Promise<MedicamentInfo[]> {
  const needs = meds.some((m) => !m.vigilance?.titre && !m.vigilance?.phrase);
  if (!needs) return meds;

  return Promise.all(meds.map(async (med) => {
    if (med.vigilance?.titre || med.vigilance?.phrase) return med;

    try {
      // 1) CIP scanné
      const cip = (med.cip_scanned || "").trim();
      if (cip) {
        const { data } = await supabase.from("medicaments").select("id").eq("cip_code", cip).limit(1);
        const hit = await vigilanceFromMedIds((data || []).map((r) => r.id));
        if (hit) return { ...med, vigilance: hit };
      }

      // 2) nom commercial
      const firstWord = (med.nom || "").trim().split(/[\s/]+/)[0];
      if (firstWord && firstWord.length >= 3) {
        const { data } = await supabase
          .from("medicaments")
          .select("id, nom_commercial")
          .ilike("nom_commercial", `${firstWord}%`)
          .limit(50);
        const target = (med.nom || "").toLowerCase().trim();
        const ordered = [...(data || [])].sort((a, b) => {
          const ae = (a.nom_commercial || "").toLowerCase().trim() === target ? 1 : 0;
          const be = (b.nom_commercial || "").toLowerCase().trim() === target ? 1 : 0;
          return be - ae;
        });
        const hit = await vigilanceFromMedIds(ordered.map((r) => r.id));
        if (hit) return { ...med, vigilance: hit };
      }

      // 3) code ATC
      const atc = (med.code_atc || "").trim();
      if (atc.length >= 4) {
        const { data } = await supabase.from("medicaments").select("id").eq("atc_code", atc).limit(30);
        const hit = await vigilanceFromMedIds((data || []).map((r) => r.id));
        if (hit) return { ...med, vigilance: hit };
      }

      // logger.error et non warn : warn est coupé en production, or c'est
      // exactement en production qu'on a besoin de voir ce cas.
      logger.error(`[vigilance] AUCUNE vigilance trouvée pour "${med.nom}" — atc=${med.code_atc || "(vide)"} cip=${med.cip_scanned || "(vide)"}`);
    } catch (e) {
      logger.error("[vigilance] échec de la relecture:", e);
    }
    return med;
  }));
}

export async function analyzePrescription(
  input: string,
  options?: { basketSessionId?: string; blockedProducts?: string[] },
): Promise<AnalysisResult> {
  beginCriticalTask();
  try {

  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: {
      prescriptionText: input,
      basketSessionId: options?.basketSessionId,
      blockedProducts: options?.blockedProducts,
    },
  });

  if (error) {
    logger.error("Edge function error:", error);
    const ctx: any = (error as any).context;
    if (ctx?.body) {
      let parsed: any = null;
      try {
        parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
      } catch {
        /* not JSON */
      }
      if (parsed?.message || parsed?.error) throw new Error(parsed.message || parsed.error);
    }
    throw new Error(error.message || "Erreur lors de l'analyse");
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  const normalized = normalizeResult(data);
  normalized.medicaments = await fillMissingVigilance(normalized.medicaments);
  return normalized;
  } finally {
    endCriticalTask();
  }
}

export async function analyzePrescriptionImage(
  imageBase64: string,
  options?: { basketSessionId?: string; blockedProducts?: string[] },
): Promise<AnalysisResult> {
  beginCriticalTask();
  try {
  const { data, error } = await supabase.functions.invoke("analyze-prescription", {
    body: {
      imageBase64,
      basketSessionId: options?.basketSessionId,
      blockedProducts: options?.blockedProducts,
    },
  });

  if (error) {
    logger.error("Edge function error:", error);
    const ctx: any = (error as any).context;
    if (ctx?.body) {
      let parsed: any = null;
      try {
        parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
      } catch {
        /* not JSON */
      }
      if (parsed?.message || parsed?.error) throw new Error(parsed.message || parsed.error);
    }
    throw new Error(error.message || "Erreur lors de l'analyse OCR");
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  const normalized = normalizeResult(data);
  normalized.medicaments = await fillMissingVigilance(normalized.medicaments);
  return normalized;
  } finally {
    endCriticalTask();
  }
}


export async function trackRecommendationClick(
  pharmacyId: string,
  medicamentSource: string,
  pcProposed: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("recommendation_metrics")
      .select("id, times_clicked")
      .eq("pharmacy_id", pharmacyId)
      .eq("medicament_source", medicamentSource)
      .eq("pc_proposed", pcProposed)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("recommendation_metrics")
        .update({ times_clicked: (existing.times_clicked || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
  } catch (e) {
    logger.error("Failed to track click:", e);
  }
}

export async function trackRecommendationUsage(
  eventType: string,
  questionId?: string,
  otcSuggestionId?: string,
): Promise<void> {
  try {
    await supabase.from("recommendation_usage").insert({
      event_type: eventType,
      question_id: questionId || null,
      otc_suggestion_id: otcSuggestionId || null,
      user_id: (await supabase.auth.getUser()).data.user?.id || null,
    });
  } catch (e) {
    logger.error("Failed to track usage:", e);
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
      conseil_associe: undefined,
      vigilance: med.vigilance || undefined,
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
