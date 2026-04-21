// Cookie consent helpers (CNIL-compliant)
const KEY = "asclion_cookie_consent";

export type CookieCategory = "necessary" | "analytics";

export interface CookieConsent {
  necessary: true; // always true (technically required)
  analytics: boolean;
  date: string;
  version: number;
}

const CURRENT_VERSION = 1;

export const getCookieConsent = (): CookieConsent | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CURRENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setCookieConsent = (consent: { analytics: boolean }) => {
  const payload: CookieConsent = {
    necessary: true,
    analytics: consent.analytics,
    date: new Date().toISOString(),
    version: CURRENT_VERSION,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("asclion:cookie-consent", { detail: payload }));
};

export const resetCookieConsent = () => {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("asclion:cookie-consent-reset"));
};

export const hasAnalyticsConsent = (): boolean => {
  return getCookieConsent()?.analytics === true;
};
