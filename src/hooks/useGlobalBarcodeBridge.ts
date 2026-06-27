import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bridge between Electron's main-process events and the React renderer.
 *
 * - `global-barcode` (HID scan, system-wide) → DOM event `asclion:global-barcode`
 *   with `source: 'hid_scan'`.
 * - `robot-dispensed` (Leo WWKS2 log watcher, only on the "Asclion principal"
 *   PC i.e. leo00) → insertion into `public.scan_queue` so the till that
 *   requested the article (identified by `wwks2_source_id`) receives the
 *   suggestion through Supabase Realtime.
 *
 *   Local display routing: leo00 is the PRODUCER, not the destination. The
 *   suggestion is only dispatched locally when THIS PC's own `wwks2SourceId`
 *   equals the `OutputRequest` Source carried by the event. When a different
 *   till requested the dispense (e.g. local=100, dispense source=21), leo00
 *   stays silent locally and lets the Supabase insert route the suggestion to
 *   the right till. A `null` source falls back to broadcast (every till's own
 *   `useScanQueue` picks it up), so we don't double-fire it here.
 *
 * No-op in non-Electron environments.
 */
export function useGlobalBarcodeBridge() {
  // This PC's own WWKS2 till id, read from asclion.config.json. On the "Asclion
  // principal" PC (leo00) this is typically 100. `null` when unconfigured
  // (web preview / single-PC) → preserve the original "show locally" behaviour.
  const localWwksSourceRef = useRef<number | null>(null);

  useEffect(() => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.config?.get) { localWwksSourceRef.current = null; return; }
    api.config.get().then((cfg) => {
      const v = cfg?.wwks2SourceId;
      localWwksSourceRef.current = typeof v === "number" ? v : null;
    }).catch(() => { localWwksSourceRef.current = null; });
  }, []);

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

        // Local display gate — leo00 is the producer, not the destination.
        // Only show the suggestion on THIS PC when it is the till that requested
        // the dispense (its own wwks2SourceId === the OutputRequest Source).
        //   - local source unknown (web / single-PC) → keep legacy behaviour.
        //   - dispense source null (broadcast) → handled by every till's own
        //     useScanQueue (incl. this PC) → don't double-fire it here.
        // Otherwise stay silent locally; the Supabase insert below routes the
        // suggestion to the correct till via Realtime.
        const localSource = localWwksSourceRef.current;
        const isDestination =
          localSource == null || (wwks2SourceId != null && wwks2SourceId === localSource);
        if (isDestination) {
          window.dispatchEvent(
            new CustomEvent("asclion:global-barcode", {
              detail: { ean: cip, at, source: "lgo_robot", wwks2SourceId },
            }),
          );
        } else {
          logger.log(
            "[ASCLION-LEO] affichage local supprimé (producteur ≠ destinataire)",
            { localSource, wwks2SourceId },
          );
        }

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
