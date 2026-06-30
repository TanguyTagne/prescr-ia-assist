import { useEffect, useState, useCallback } from "react";
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
  input_data?: any;
}

/**
 * Realtime subscription to the pharmacy's `scan_queue`.
 *
 * Note (29/06/2026) : le routing robot par caisse passe désormais 100% en
 * local via `LeoClientAppLog.txt` (cf. electron/leoWatcher.js). Cette
 * souscription Supabase reste utile pour les autres sources (scans
 * ordonnance, intégrations LGO non-robot), mais elle n'est plus filtrée
 * par caisse — chaque PC reçoit l'ensemble des événements de la pharmacie.
 */
export function useScanQueue() {
  const { user } = useAuth();
  const [latestScan, setLatestScan] = useState<ScanEvent | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEvent[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);

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

    const channel = supabase
      .channel(`scan_queue_${pharmacyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_queue", filter: `pharmacy_id=eq.${pharmacyId}` },
        (payload) => {
          const scan = payload.new as ScanEvent;
          setLatestScan(scan);
          setScanHistory((prev) => [scan, ...prev].slice(0, 50));

          // Le routing robot par caisse est désormais 100% local. On ne
          // re-dispatch PAS les events `lgo_robot` venus de Realtime — la
          // caisse qui a délivré les voit déjà via son propre LeoClientAppLog.
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
