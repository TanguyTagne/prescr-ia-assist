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
}

export function useScanQueue() {
  const { user } = useAuth();
  const [latestScan, setLatestScan] = useState<ScanEvent | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEvent[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Get user's pharmacy_id
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

  // Subscribe to realtime changes
  useEffect(() => {
    if (!pharmacyId) return;

    setIsListening(true);

    const channel = supabase
      .channel(`scan_queue_${pharmacyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_queue",
          filter: `pharmacy_id=eq.${pharmacyId}`,
        },
        (payload) => {
          const scan = payload.new as ScanEvent;
          setLatestScan(scan);
          setScanHistory((prev) => [scan, ...prev].slice(0, 50));

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

            // Native OS notification when Electron app is in background
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
        {
          event: "UPDATE",
          schema: "public",
          table: "scan_queue",
          filter: `pharmacy_id=eq.${pharmacyId}`,
        },
        (payload) => {
          const scan = payload.new as ScanEvent;
          setLatestScan(scan);
          setScanHistory((prev) =>
            prev.map((s) => (s.id === scan.id ? scan : s)),
          );

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
