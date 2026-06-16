const DESKTOP_QUERY_PARAM = "desktop";
const DESKTOP_QUERY_VALUE = "1";
const ASCLION_APP_HOST = "prescr-ia-assist.lovable.app";

const hasWindow = () => typeof window !== "undefined" && typeof navigator !== "undefined";

const isElectronUserAgent = () => /Electron|AsclionDesktop/i.test(navigator.userAgent || "");

const hasDesktopBridge = () => {
  const w = window as any;
  if (w.__ASCLION_DESKTOP__ === true || w.electronAPI?.isDesktop === true) return true;
  // Capacitor native shell (iOS/Android) — render the same widget UI as desktop.
  const cap = w.Capacitor;
  if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
  return false;
};

const hasDesktopQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get(DESKTOP_QUERY_PARAM) === DESKTOP_QUERY_VALUE;
};

const isLegacyDesktopShell = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("web") === "1") return false;

  const isAppHost = window.location.hostname === ASCLION_APP_HOST;
  const compactElectronWindow =
    window.innerWidth <= 520 &&
    window.innerHeight <= 760 &&
    window.outerWidth <= 560 &&
    window.outerHeight <= 840;
  const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  return isAppHost && compactElectronWindow && !touchDevice && !mobileUA;
};

export const isAsclionDesktopRuntime = () => {
  if (!hasWindow()) return false;

  return (
    hasDesktopQuery() ||
    hasDesktopBridge() ||
    isElectronUserAgent() ||
    isLegacyDesktopShell()
  );
};
