import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ScanEvent {
  id: string;
  scan_type: string;
  status: string;
  result: any;
  source: string;
  device_id: string | null;
  created_at: string;
  processed_at: string | null;
  ean_code?: string | null;
  wwks2_source_id?: number | null;
  input_data?: any;
}

/**
 * Realtime subscription to the pharmacy's `scan_queue`.
 *
 * WWKS2 multi-till routing:
 *   - If `asclion.config.json` defines a `wwks2SourceId` on this PC (typically
 *     LEO21, LEO22, …), only events with the matching `wwks2_source_id` are
 *     surfaced — plus events with `wwks2_source_id IS NULL` (broadcast
 *     fallback when the watcher couldn't extract the till id).
 *   - If no `wwks2SourceId` is configured (web preview, demo, single-till
 *     setups), every event is delivered (no behavioural regression).
 *
 * When a robot dispense (`source === 'lgo_robot'`) reaches this till, it is
 * also re-emitted as the same DOM event used by HID scans, so the existing
 * lookup pipeline (analyse-prescription / PC suggestions) handles it without
 * duplicate logic on the consumer side.
 */
export function useScanQueue() {
  const { user } = useAuth();
  const [latestScan, setLatestScan] = useState<ScanEvent | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEvent[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const wwksSourceRef = useRef<number | null>(null);

  // Load the local till id from Electron config (no-op in web).
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api?.config?.get) { wwksSourceRef.current = null; return; }
    api.config.get().then((cfg) => {
      const v = cfg?.wwks2SourceId;
      wwksSourceRef.current = typeof v === "number" ? v : null;
    }).catch(() => { wwksSourceRef.current = null; });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.pharmacy_id) setPharmacyId(data.pharmacy_id);
      });
  }, [user]);

  useEffect(() => {
    if (!pharmacyId) return;
    setIsListening(true);

    const matchesThisTill = (scan: ScanEvent): boolean => {
      const local = wwksSourceRef.current;
      if (local == null) return true; // no till configured → accept everything
      const v = scan.wwks2_source_id;
      return v == null || v === local;
    };

    const channel = supabase
      .channel(`scan_queue_${pharmacyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_queue", filter: `pharmacy_id=eq.${pharmacyId}` },
        (payload) => {
          const scan = payload.new as ScanEvent;
          if (!matchesThisTill(scan)) return;
          setLatestScan(scan);
          setScanHistory((prev) => [scan, ...prev].slice(0, 50));

          // Robot dispense → replay as a local barcode so the existing pipeline
          // (lookup CIP → recommendations) fires without duplicate logic.
          if (scan.source === "lgo_robot" && scan.ean_code) {
            window.dispatchEvent(new CustomEvent("asclion:global-barcode", {
              detail: { ean: scan.ean_code, at: Date.now(), source: "lgo_robot", wwks2SourceId: scan.wwks2_source_id ?? null },
            }));
          }

          if (scan.status === "completed") {
            const isPrescription = scan.scan_type === "prescription";
            const count = scan.result?.suggestions?.length || 0;
            const title = isPrescription
              ? "📋 Ordonnance scannée analysée !"
              : `🛒 Article scanné — ${count} suggestion(s)`;
            const description = isPrescription
              ? "Les résultats sont disponibles."
              : "Produits complémentaires disponibles.";

            toast.success(title, { description, duration: 8000 });

            if (
              typeof window !== "undefined" &&
              window.electronAPI?.isDesktop &&
              document.hidden
            ) {
              window.electronAPI.notify({ title, body: description }).catch(() => {});
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scan_queue", filter: `pharmacy_id=eq.${pharmacyId}` },
        (payload) => {
          const scan = payload.new as ScanEvent;
          if (!matchesThisTill(scan)) return;
          setLatestScan(scan);
          setScanHistory((prev) => prev.map((s) => (s.id === scan.id ? scan : s)));

          if (scan.status === "completed" && (payload.old as any)?.status === "processing") {
            if (scan.scan_type === "prescription") {
              toast.success("📋 Analyse terminée !", { duration: 8000 });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      setIsListening(false);
    };
  }, [pharmacyId]);

  const dismissScan = useCallback(() => setLatestScan(null), []);

  return { latestScan, scanHistory, isListening, pharmacyId, dismissScan };
}
