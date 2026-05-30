import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/hooks/useAnalytics";

const STORAGE_KEY = "asclion_register_id";

export const usePcFeedback = () => {
  const { user, pharmacyId } = useAuth();

  const recordFeedback = async (
    medicamentNom: string,
    pcNom: string,
    action: "accepted" | "refused" | "ignored",
    pcCategorie?: string,
    reason?: string,
    context?: { medicaments_analyses?: string[]; pcs_proposes?: string[] },
    detectionSource: "manual_click" | "hid_auto" | "lgo_sale" | "inferred" = "manual_click"
  ) => {

    if (!user) return;
    if (!pharmacyId) return;

    try {
      const profile = { pharmacy_id: pharmacyId };

      const registerId = localStorage.getItem(STORAGE_KEY) || null;

      // Insert feedback
      await supabase.from("pc_feedback").insert({
        pharmacy_id: profile.pharmacy_id,
        user_id: user.id,
        register_id: registerId,
        medicament_nom: medicamentNom,
        pc_nom: pcNom,
        pc_categorie: pcCategorie || null,
        action,
        reason: reason || null,
        detection_source: detectionSource,
      } as any);


      // Update recommendation_metrics
      if (action === "accepted") {
        const { data: existing } = await supabase
          .from("recommendation_metrics")
          .select("id, times_clicked, times_sold")
          .eq("pharmacy_id", profile.pharmacy_id)
          .eq("medicament_source", medicamentNom)
          .eq("pc_proposed", pcNom)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("recommendation_metrics")
            .update({
              times_clicked: (existing as any).times_clicked + 1,
              times_sold: (existing as any).times_sold + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (existing as any).id);
        } else {
          await supabase.from("recommendation_metrics").insert({
            pharmacy_id: profile.pharmacy_id,
            register_id: registerId,
            medicament_source: medicamentNom,
            pc_proposed: pcNom,
            pc_categorie: pcCategorie || null,
            times_clicked: 1,
            times_sold: 1,
            times_proposed: 1,
            times_displayed: 1,
          });
        }

        // Log full accepted combination (KPI: meds analysed + PCs proposed + PC accepted)
        await supabase.from("accepted_combinations").insert({
          pharmacy_id: profile.pharmacy_id,
          user_id: user.id,
          register_id: registerId,
          medicaments_analyses: context?.medicaments_analyses || [medicamentNom],
          pcs_proposes: context?.pcs_proposes || [pcNom],
          pc_accepte: pcNom,
          pc_categorie: pcCategorie || null,
          medicament_source: medicamentNom,
        });
      }

      trackEvent("pc_feedback", { medicament: medicamentNom, pc: pcNom, action });
    } catch (e) {
      console.error("PC feedback error:", e);
    }
  };

  return { recordFeedback };
};
