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

async function fetchExpectedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { version?: string };
    return typeof json?.version === "string" ? json.version : null;
  } catch {
    // Silent: heartbeat must keep ticking even if version.json is unreachable.
    if (import.meta.env.DEV) console.debug(`${TAG} version.json fetch failed`);
    return null;
  }
}

function scheduleReload(currentVersion: string, expectedVersion: string) {
  if (reloadScheduled) return;
  reloadScheduled = true;

  const jitterMs = Math.floor(Math.random() * JITTER_MAX_MS);
  console.info(
    `${TAG} new version detected (current=${currentVersion} → expected=${expectedVersion}), reloading in ${Math.round(jitterMs / 1000)}s`,
  );

  setTimeout(() => {
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
