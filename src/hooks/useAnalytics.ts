import { supabase } from "@/integrations/supabase/client";

export const trackEvent = async (
  eventType: string,
  metadata: Record<string, any> = {}
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's pharmacy_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user.id)
      .single();

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      pharmacy_id: profile?.pharmacy_id || null,
      event_type: eventType,
      metadata,
    });
  } catch (e) {
    console.error("Analytics tracking error:", e);
  }
};
