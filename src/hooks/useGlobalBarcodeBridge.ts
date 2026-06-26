import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bridge between Electron's main-process events and the React renderer.
 *
 * - `global-barcode` (HID scan, system-wide) → DOM event `asclion:global-barcode`
 *   with `source: 'hid_scan'`.
 * - `robot-dispensed` (Leo WWKS2 log watcher, only on the "Asclion principal"
 *   PC i.e. leo00) → DOM event `asclion:global-barcode` with
 *   `source: 'lgo_robot'` AND insertion into `public.scan_queue` so the till
 *   that requested the article (identified by `wwks2_source_id`) receives the
 *   suggestion through Supabase Realtime.
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
      const off = api.onRobotDispensed(async ({ cip, at, wwks2SourceId, messageId }) => {
        logger.log("[ASCLION-LEO] renderer received dispense", { cip, at, wwks2SourceId, messageId });
        try {
          localStorage.setItem("asclion_last_scan_at", String(at));
          localStorage.setItem("asclion_last_scan_ean", cip);
        } catch {
          /* noop */
        }

        // Always dispatch locally — the principal PC pharmacist sees suggestions too.
        window.dispatchEvent(
          new CustomEvent("asclion:global-barcode", {
            detail: { ean: cip, at, source: "lgo_robot", wwks2SourceId },
          }),
        );

        // Route the dispense to the till that requested it via Supabase
        // Realtime. wwks2_source_id = null → broadcast to all tills (fallback).
        try {
          const { data: auth } = await supabase.auth.getUser();
          const userId = auth?.user?.id;
          if (!userId) return;
          const { data: prof } = await supabase
            .from("profiles")
            .select("pharmacy_id")
            .eq("id", userId)
            .maybeSingle();
          const pharmacyId = prof?.pharmacy_id;
          if (!pharmacyId) return;
          const { error } = await supabase.from("scan_queue").insert({
            pharmacy_id: pharmacyId,
            ean_code: cip,
            source: "lgo_robot",
            status: "pending",
            scan_type: "barcode",
            wwks2_source_id: wwks2SourceId ?? null,
            input_data: { cip, messageId, at, wwks2SourceId: wwks2SourceId ?? null },
          });
          if (error) logger.warn("[ASCLION-LEO] scan_queue insert failed", error);
        } catch (e) {
          logger.warn("[ASCLION-LEO] scan_queue insert threw", e);
        }
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
