/**
 * Centralized "critical task in progress" flag.
 *
 * Used by the auto-refresh logic in `useInstanceHeartbeat` to make sure the
 * app NEVER reloads under the user while a prescription analysis, an OCR,
 * an AI generation, a scan-in-flight or any other irreversible step is
 * running. Counter-based so concurrent tasks compose safely.
 */

const FLAG_KEY = "__APP_CRITICAL_TASK_IN_PROGRESS__";

function getCount(): number {
  if (typeof window === "undefined") return 0;
  const w = window as any;
  return typeof w[FLAG_KEY] === "number" ? w[FLAG_KEY] : 0;
}

function setCount(n: number) {
  if (typeof window === "undefined") return;
  (window as any)[FLAG_KEY] = Math.max(0, n);
}

export function beginCriticalTask(): void {
  setCount(getCount() + 1);
}

export function endCriticalTask(): void {
  setCount(getCount() - 1);
}

export function isCriticalTaskInProgress(): boolean {
  return getCount() > 0;
}

export async function withCriticalTask<T>(fn: () => Promise<T>): Promise<T> {
  beginCriticalTask();
  try {
    return await fn();
  } finally {
    endCriticalTask();
  }
}
