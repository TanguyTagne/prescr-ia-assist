import { supabase } from "@/integrations/supabase/client";
import { hasAnalyticsConsent } from "@/lib/cookieConsent";
import { getCachedPharmacyId } from "@/lib/authCache";

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

    // Read pharmacy_id from the AuthProvider cache (populated at login)
    // instead of re-querying `profiles` on every analytics event.
    let pharmacyId = getCachedPharmacyId(user.id);
    if (pharmacyId === null) {
      // Cache miss (rare — e.g. event fired before AuthProvider resolved).
      // Fall back to a one-time DB lookup so we never lose the event.
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single();
      pharmacyId = profile?.pharmacy_id || null;
    }

    const registerId = localStorage.getItem(STORAGE_KEY) || null;

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      pharmacy_id: pharmacyId,
      register_id: registerId,
      event_type: eventType,
      metadata,
    });
  } catch (e) {
    console.error("Analytics tracking error:", e);
  }
};
