import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/components/DemoLeadForm";
import { getStoredAttribution } from "@/lib/trackingAttribution";

export const trackDemoSession = async (ordonnanceId: string) => {
  try {
    await supabase.functions.invoke("track-demo-session", {
      body: {
        session_id: getSessionId(),
        ordonnance_id: ordonnanceId,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        tracking_link_id: getStoredAttribution(),
      },
    });
  } catch (e) {
    console.error("trackDemoSession error:", e);
  }
};
