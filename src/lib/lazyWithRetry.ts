import { lazy, type ComponentType } from "react";
import { purgeClientCaches } from "@/lib/versionCheck";

/**
 * React.lazy with resilience against stale Vite chunk manifests.
 * Retries once, then purges caches and hard-reloads to fetch the latest build.
 */
export const lazyWithRetry = <T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(() =>
    factory().catch(async (err: unknown) => {
      console.warn("Dynamic import failed, retrying...", err);
      await new Promise((r) => setTimeout(r, 500));
      return factory().catch(async (err2: unknown) => {
        console.error("Dynamic import failed twice, purging caches and reloading...", err2);
        const key = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(key, String(Date.now()));
          await purgeClientCaches();
          const url = new URL(window.location.href);
          url.searchParams.set("__asclion_reload", String(Date.now()));
          window.location.replace(url.toString());
        }
        throw err2;
      });
    })
  );

export default lazyWithRetry;
