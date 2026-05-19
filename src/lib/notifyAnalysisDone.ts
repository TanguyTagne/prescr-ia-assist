// Centralized "analysis finished" notifier.
// - Toast (always)
// - Optional sound bip (controlled by localStorage "asclion.sound.enabled")
// - Electron: flash taskbar icon + bring window to front + native notification
// - Web: favicon switches to yellow until the tab gets focus again

import { toast } from "sonner";

const SOUND_KEY = "asclion.sound.enabled";
const FAVICON_NORMAL = "/favicon.png";
const FAVICON_ALERT = "/favicon-alert.png";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? true : v === "1";
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("asclion:sound-changed", { detail: on }));
}

function playBip() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    /* ignore */
  }
}

function setFavicon(href: string) {
  try {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  } catch {
    /* ignore */
  }
}

let alertFaviconActive = false;
function startFaviconAlert() {
  if (alertFaviconActive) return;
  alertFaviconActive = true;
  setFavicon(FAVICON_ALERT);
  const onFocus = () => {
    setFavicon(FAVICON_NORMAL);
    alertFaviconActive = false;
    window.removeEventListener("focus", onFocus);
  };
  window.addEventListener("focus", onFocus);
}

export interface NotifyOptions {
  count?: number;
  message?: string;
}

export function notifyAnalysisDone(opts: NotifyOptions = {}) {
  const { count, message } = opts;
  const label =
    message ||
    (typeof count === "number"
      ? `Analyse terminée — ${count} médicament${count > 1 ? "s" : ""} détecté${count > 1 ? "s" : ""}`
      : "Analyse terminée");

  // Sound (optional)
  if (isSoundEnabled()) playBip();

  // Toast (always)
  toast.success(label);

  // Detect focus
  const focused = typeof document !== "undefined" && document.hasFocus();
  if (focused) return;

  const api = (typeof window !== "undefined" ? (window as any).electronAPI : null) as
    | {
        attention?: {
          flash: () => Promise<void>;
          bringToFront: () => Promise<void>;
        };
        notify?: (p: { title: string; body: string }) => Promise<boolean>;
      }
    | null;

  if (api?.attention) {
    // Desktop (Electron)
    api.attention.flash().catch(() => {});
    api.attention.bringToFront().catch(() => {});
    api.notify?.({ title: "Asclion", body: label }).catch(() => {});
    return;
  }

  // Web fallback: yellow favicon + Web Notification if permission
  startFaviconAlert();
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Asclion", { body: label, icon: FAVICON_ALERT });
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
