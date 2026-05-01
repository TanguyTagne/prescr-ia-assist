import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/components/DemoLeadForm";

const ATTR_KEY = "asclion_tracking_link";
const ATTR_TTL_DAYS = 30;

interface Attribution {
  link_id: string;
  saved_at: number;
}

export const getStoredAttribution = (): string | null => {
  try {
    const raw = localStorage.getItem(ATTR_KEY);
    if (!raw) return null;
    const parsed: Attribution = JSON.parse(raw);
    const ageMs = Date.now() - parsed.saved_at;
    if (ageMs > ATTR_TTL_DAYS * 24 * 3600 * 1000) {
      localStorage.removeItem(ATTR_KEY);
      return null;
    }
    return parsed.link_id;
  } catch {
    return null;
  }
};

const storeAttribution = (link_id: string) => {
  try {
    localStorage.setItem(ATTR_KEY, JSON.stringify({ link_id, saved_at: Date.now() }));
  } catch {}
};

/**
 * Reads ?r=<slug> (or ?ref=<slug>) from the URL, registers the click,
 * stores the attribution for 30 days, then optionally redirects.
 * Cleans the slug param from the URL afterwards.
 */
export const processIncomingTrackingLink = async () => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("r") || params.get("ref");
  if (!slug) return;

  try {
    const { data } = await supabase.functions.invoke("track-link-click", {
      body: {
        slug,
        session_id: getSessionId(),
        referrer: document.referrer || null,
      },
    });
    const result = data as { ok?: boolean; link_id?: string; destination?: string } | null;
    if (result?.ok && result.link_id) {
      storeAttribution(result.link_id);
    }

    // Strip the tracking param from URL (no reload)
    params.delete("r");
    params.delete("ref");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);

    // Optional redirect to the link's intended destination
    if (result?.ok && result.destination && result.destination !== "/" && result.destination !== window.location.pathname) {
      window.location.assign(result.destination);
    }
  } catch (e) {
    console.error("processIncomingTrackingLink error:", e);
  }
};
