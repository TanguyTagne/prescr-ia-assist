import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Bridge between Electron's main-process global HID listener and the React
 * renderer. Subscribes to the `global-barcode` IPC channel and re-broadcasts
 * each scan as a `CustomEvent('asclion:global-barcode')` on `window`, so any
 * component (e.g. WidgetApp) can react to it without coupling to Electron.
 *
 * No-op in non-Electron environments.
 */
export function useGlobalBarcodeBridge() {
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.onGlobalBarcode) return;

    const unsubscribe = api.onGlobalBarcode(({ ean, at }) => {
      logger.log("[ASCLION-SCAN] renderer received", { ean, at });
      try {
        localStorage.setItem("asclion_scanner_detected", "1");
        localStorage.setItem("asclion_last_scan_at", String(at));
        localStorage.setItem("asclion_last_scan_ean", ean);
      } catch {
        /* noop */
      }
      window.dispatchEvent(new CustomEvent("asclion:global-barcode", { detail: { ean, at } }));
    });

    return () => {
      try {
        unsubscribe?.();
      } catch {
        /* noop */
      }
    };
  }, []);
}
