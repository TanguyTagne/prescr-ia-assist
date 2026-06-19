import { isCriticalTaskInProgress } from "./criticalTask";

/**
 * Controlled auto-refresh after a new Lovable/Vite deploy.
 *
 * Compares the BUILD_ID embedded at build time with the version exposed at
 * /version.json (regenerated on every deploy). If they differ, schedules a
 * reload with jitter + cooldown + critical-task guard so we never:
 *  - reload mid-analysis,
 *  - loop-reload,
 *  - thunder-herd the backend at deploy time.
 */

export const CURRENT_BUILD_ID: string =
  (import.meta as any).env?.VITE_BUILD_ID || "local-dev";

const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
const JITTER_MAX_MS = 30_000;
const RELOAD_KEY = "last_forced_app_reload_at";
const TAG = "[version-check]";

let reloadScheduled = false;

function readLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) || "0");
  } catch {
    return 0;
  }
}

function markReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export async function fetchExpectedVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { version?: string };
    return typeof json?.version === "string" ? json.version : null;
  } catch {
    // Silent: heartbeat must keep ticking even if version.json is unreachable.
    if (import.meta.env.DEV) console.debug(`${TAG} version.json fetch failed`);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Nuke service worker + cache storage so the next page load can't serve a
 * stale bundle from disk. Must run BEFORE `location.reload()`.
 */
export async function purgeClientCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

export async function ensureFreshAppVersionBeforeRender(): Promise<boolean> {
  if (typeof window === "undefined") return true;

  const expected = await fetchExpectedVersion();
  if (!expected || expected === CURRENT_BUILD_ID) return true;

  const key = "last_boot_forced_app_reload_at";
  const last = Number(sessionStorage.getItem(key) || "0");
  if (Date.now() - last < RELOAD_COOLDOWN_MS) {
    console.warn(`${TAG} boot version mismatch detected but reload skipped due to cooldown`);
    return true;
  }

  sessionStorage.setItem(key, String(Date.now()));
  console.info(`${TAG} stale boot bundle detected, purging caches before render`);
  await purgeClientCaches();

  const url = new URL(window.location.href);
  url.searchParams.set("__asclion_v", expected);
  window.location.replace(url.toString());
  return false;
}

function scheduleReload(currentVersion: string, expectedVersion: string) {
  if (reloadScheduled) return;
  reloadScheduled = true;

  const jitterMs = Math.floor(Math.random() * JITTER_MAX_MS);
  console.info(
    `${TAG} new version detected (current=${currentVersion} → expected=${expectedVersion}), reloading in ${Math.round(jitterMs / 1000)}s`,
  );

  setTimeout(async () => {
    // Re-check guards just before reloading — state may have changed during jitter.
    if (isCriticalTaskInProgress()) {
      console.info(`${TAG} reload cancelled because critical task started during jitter`);
      reloadScheduled = false;
      return;
    }
    if (Date.now() - readLastReloadAt() < RELOAD_COOLDOWN_MS) {
      console.warn(`${TAG} reload cancelled due to cooldown`);
      reloadScheduled = false;
      return;
    }
    markReload();
    // Purge SW + caches first so the reload actually pulls the new bundle.
    await purgeClientCaches();
    window.location.reload();
  }, jitterMs);
}


export async function checkAppVersionAndMaybeReload(): Promise<void> {
  if (typeof window === "undefined") return;
  if (reloadScheduled) return;

  const expected = await fetchExpectedVersion();
  if (!expected) return;
  if (expected === CURRENT_BUILD_ID) return;

  if (isCriticalTaskInProgress()) {
    console.info(
      `${TAG} new version detected but reload postponed because critical task is in progress`,
    );
    return;
  }
  if (Date.now() - readLastReloadAt() < RELOAD_COOLDOWN_MS) {
    console.warn(`${TAG} version mismatch detected but reload skipped due to cooldown`);
    return;
  }

  scheduleReload(CURRENT_BUILD_ID, expected);
}
