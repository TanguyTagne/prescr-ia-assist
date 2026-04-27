import { supabase } from "@/integrations/supabase/client";

export type QuotaType = "analysis" | "ai_call";

export interface QuotaResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  quota_type: QuotaType;
}

/**
 * Vérifie et incrémente le quota d'une pharmacie via RPC.
 * À appeler avant tout traitement coûteux (analyse d'ordonnance, appel IA).
 */
export async function checkAndIncrementQuota(
  pharmacyId: string,
  quotaType: QuotaType
): Promise<QuotaResult | null> {
  try {
    const { data, error } = await supabase.rpc("check_and_increment_quota", {
      _pharmacy_id: pharmacyId,
      _quota_type: quotaType,
    });
    if (error) {
      console.error("Quota check failed:", error);
      // En cas d'erreur DB, on autorise par défaut pour ne pas bloquer le pharmacien
      return null;
    }
    return data as unknown as QuotaResult;
  } catch (e) {
    console.error("Quota RPC error:", e);
    return null;
  }
}
