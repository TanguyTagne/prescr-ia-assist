import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/components/DemoLeadForm";

export const trackDemoSession = async (ordonnanceId: string) => {
  try {
    await supabase.functions.invoke("track-demo-session", {
      body: {
        session_id: getSessionId(),
        ordonnance_id: ordonnanceId,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      },
    });
  } catch (e) {
    console.error("trackDemoSession error:", e);
  }
};
