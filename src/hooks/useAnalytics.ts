import { supabase } from "@/integrations/supabase/client";
import { hasAnalyticsConsent } from "@/lib/cookieConsent";

const STORAGE_KEY = "asclion_register_id";

export const trackEvent = async (
  eventType: string,
  metadata: Record<string, any> = {}
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Respect cookie consent: only track when user opted-in for analytics
    if (!hasAnalyticsConsent()) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user.id)
      .single();

    const registerId = localStorage.getItem(STORAGE_KEY) || null;

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      pharmacy_id: profile?.pharmacy_id || null,
      register_id: registerId,
      event_type: eventType,
      metadata,
    });
  } catch (e) {
    console.error("Analytics tracking error:", e);
  }
};
