import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/hooks/useAnalytics";

export const usePcFeedback = () => {
  const { user } = useAuth();

  const recordFeedback = async (
    medicamentNom: string,
    pcNom: string,
    action: "accepted" | "refused" | "ignored",
    pcCategorie?: string,
    reason?: string
  ) => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single();

      if (!profile?.pharmacy_id) return;

      // Insert feedback
      await supabase.from("pc_feedback" as any).insert({
        pharmacy_id: profile.pharmacy_id,
        user_id: user.id,
        medicament_nom: medicamentNom,
        pc_nom: pcNom,
        pc_categorie: pcCategorie || null,
        action,
        reason: reason || null,
      });

      // Update recommendation_metrics
      if (action === "accepted") {
        const { data: existing } = await supabase
          .from("recommendation_metrics" as any)
          .select("id, times_clicked, times_sold")
          .eq("pharmacy_id", profile.pharmacy_id)
          .eq("medicament_source", medicamentNom)
          .eq("pc_proposed", pcNom)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("recommendation_metrics" as any)
            .update({
              times_clicked: (existing as any).times_clicked + 1,
              times_sold: (existing as any).times_sold + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (existing as any).id);
        } else {
          await supabase.from("recommendation_metrics" as any).insert({
            pharmacy_id: profile.pharmacy_id,
            medicament_source: medicamentNom,
            pc_proposed: pcNom,
            pc_categorie: pcCategorie || null,
            times_clicked: 1,
            times_sold: 1,
            times_proposed: 1,
            times_displayed: 1,
          });
        }
      }

      trackEvent("pc_feedback", { medicament: medicamentNom, pc: pcNom, action });
    } catch (e) {
      console.error("PC feedback error:", e);
    }
  };

  return { recordFeedback };
};
