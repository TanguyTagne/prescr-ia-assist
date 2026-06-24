import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Bridge between Electron's main-process global HID listener and the React
 * renderer. Subscribes to the `global-barcode` IPC channel and re-broadcasts
 * each scan as a `CustomEvent('asclion:global-barcode')` on `window`, so any
 * component (e.g. WidgetApp) can react to it without coupling to Electron.
 *
 * Also bridges the `robot-dispensed` IPC channel (Leo / Astera LGO log
 * watcher): each dispense is forwarded through the SAME DOM event, tagged
 * with `source: 'lgo_robot'`, so the downstream pipeline treats a robot
 * drop exactly like a HID scan.
 *
 * No-op in non-Electron environments.
 */
export function useGlobalBarcodeBridge() {
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api) return;

    const offs: Array<() => void> = [];

    if (api.onGlobalBarcode) {
      const off = api.onGlobalBarcode(({ ean, at }) => {
        logger.log("[ASCLION-SCAN] renderer received", { ean, at });
        try {
          localStorage.setItem("asclion_scanner_detected", "1");
          localStorage.setItem("asclion_last_scan_at", String(at));
          localStorage.setItem("asclion_last_scan_ean", ean);
        } catch {
          /* noop */
        }
        window.dispatchEvent(
          new CustomEvent("asclion:global-barcode", { detail: { ean, at, source: "hid_scan" } })
        );
      });
      if (off) offs.push(off);
    }

    if (api.onRobotDispensed) {
      const off = api.onRobotDispensed(({ cip, at }) => {
        logger.log("[ASCLION-LEO] renderer received dispense", { cip, at });
        try {
          localStorage.setItem("asclion_last_scan_at", String(at));
          localStorage.setItem("asclion_last_scan_ean", cip);
        } catch {
          /* noop */
        }
        window.dispatchEvent(
          new CustomEvent("asclion:global-barcode", { detail: { ean: cip, at, source: "lgo_robot" } })
        );
      });
      if (off) offs.push(off);
    }

    return () => {
      for (const off of offs) {
        try { off(); } catch { /* noop */ }
      }
    };
  }, []);
}
