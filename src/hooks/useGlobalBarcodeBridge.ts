import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Bridge entre les events Electron (main process) et le renderer React.
 *
 * Architecture robot validée le 29/06/2026 :
 * Chaque caisse a son propre `LeoClientAppLog.txt` lu localement par le main
 * process. Les délivrances sont émises via `robot-dispensed` et rediffusées
 * dans le pipeline scan local — aucun routage Supabase, aucun filtrage par
 * caisse, chaque PC est autonome.
 *
 * No-op hors Electron.
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
        } catch { /* noop */ }
        window.dispatchEvent(
          new CustomEvent("asclion:global-barcode", { detail: { ean, at, source: "hid_scan" } })
        );
      });
      if (off) offs.push(off);
    }

    if (api.onRobotDispensed) {
      const off = api.onRobotDispensed((payload: any) => {
        // Compat : ancien payload { cip } / nouveau payload { cip13, source, timestamp }
        const cip = payload?.cip13 ?? payload?.cip;
        const at = payload?.timestamp ?? payload?.at ?? Date.now();
        if (!cip) return;
        logger.log("[ASCLION-LEO-CLIENT] dispense locale", { cip, at });
        try {
          localStorage.setItem("asclion_last_scan_at", String(at));
          localStorage.setItem("asclion_last_scan_ean", cip);
        } catch { /* noop */ }
        window.dispatchEvent(
          new CustomEvent("asclion:global-barcode", {
            detail: { ean: cip, at, source: "lgo_robot" },
          }),
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
