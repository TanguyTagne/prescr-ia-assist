import { useScanQueue, type ScanEvent } from "@/hooks/useScanQueue";
import { X, Wifi, WifiOff, ShoppingCart, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScanNotificationProps {
  scan: ScanEvent;
  onDismiss: () => void;
  onViewResult: (scan: ScanEvent) => void;
}

const ScanNotification = ({ scan, onDismiss, onViewResult }: ScanNotificationProps) => {
  const isPrescription = scan.scan_type === "prescription";
  const suggestions = scan.result?.suggestions || [];
  const meds = scan.result?.medicaments || [];

  return (
    <div className="animate-fade-in border border-primary/30 bg-accent/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPrescription ? (
            <FileText className="h-4 w-4 text-primary" />
          ) : (
            <ShoppingCart className="h-4 w-4 text-primary" />
          )}
          <span className="text-xs font-semibold">
            {isPrescription ? "Ordonnance scannée" : `${meds.length} article(s) scanné(s)`}
          </span>
          <Badge variant="outline" className="text-[10px] h-4">
            {scan.source === "api" ? "Caisse" : scan.source === "folder_watcher" ? "Scanner" : scan.source}
          </Badge>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!isPrescription && suggestions.length > 0 && (
        <div className="space-y-1">
          {suggestions.slice(0, 2).map((s: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <Package className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{s.pathologie}</span>
                {s.produits?.slice(0, 2).map((p: any, j: number) => (
                  <span key={j} className="text-muted-foreground"> • {p.produit}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => onViewResult(scan)}
      >
        Voir les détails
      </Button>
    </div>
  );
};

interface ScannerStatusProps {
  onViewResult: (scan: ScanEvent) => void;
}

export const ScannerStatus = ({ onViewResult }: ScannerStatusProps) => {
  const { latestScan, isListening, dismissScan } = useScanQueue();

  return (
    <div className="space-y-2">
      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {isListening ? (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span>Scanner connecté</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Scanner non connecté</span>
          </>
        )}
      </div>

      {/* Latest scan notification */}
      {latestScan && latestScan.status === "completed" && (
        <ScanNotification
          scan={latestScan}
          onDismiss={dismissScan}
          onViewResult={onViewResult}
        />
      )}
    </div>
  );
};

export default ScannerStatus;
