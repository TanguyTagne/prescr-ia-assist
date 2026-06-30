import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LogDetectionWizard from "@/components/LogDetectionWizard";

/**
 * Architecture validée le 29/06/2026 :
 * Chaque caisse Léo écrit son CIP13 dans son propre LeoClientAppLog.txt.
 * Ce panneau affiche l'état du watcher LOCAL de cette caisse.
 */

type CheckResult = {
  exists: boolean;
  path: string;
  lastModified: string | Date | null;
  size?: number;
};

type LastDetection = { cip13: string | null; timestamp: number | null };

function formatRelative(ts: number | null): string {
  if (!ts) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function LeoRobotStatusPanel() {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [last, setLast] = useState<LastDetection>({ cip13: null, timestamp: null });
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!api?.leo?.checkClientLog) return;
    setBusy(true);
    try {
      const c = await api.leo.checkClientLog();
      setCheck(c);
      const l = await api.leo.getLastDetection?.();
      if (l) setLast(l);
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live update : re-render toutes les 5s pour le "il y a X s" + nouvelle détection
  useEffect(() => {
    const id = setInterval(async () => {
      setTick((n) => n + 1);
      if (api?.leo?.getLastDetection) {
        try {
          const l = await api.leo.getLastDetection();
          if (l) setLast(l);
        } catch { /* noop */ }
      }
    }, 5000);
    return () => clearInterval(id);
  }, [api]);

  // Écoute directe des dispenses pour mettre à jour sans attendre le poll
  useEffect(() => {
    if (!api?.onRobotDispensed) return;
    const off = api.onRobotDispensed((payload: any) => {
      const cip = payload?.cip13 ?? payload?.cip;
      const at = payload?.timestamp ?? payload?.at ?? Date.now();
      if (cip) setLast({ cip13: cip, timestamp: at });
    });
    return () => { try { off?.(); } catch { /* noop */ } };
  }, [api]);

  const customize = async () => {
    if (!api?.leo?.setClientLogPath) return;
    const next = window.prompt(
      "Chemin du fichier LeoClientAppLog.txt",
      check?.path || "C:\\ProgramData\\Astera\\Leo2.0\\Logs\\Client\\LeoClientAppLog.txt",
    );
    if (!next) return;
    const r = await api.leo.setClientLogPath(next.trim());
    if (r?.ok) {
      toast.success("Chemin enregistré, watcher redémarré");
      await refresh();
    } else {
      toast.error("Échec", { description: r?.error });
    }
  };

  if (!api?.leo?.checkClientLog) {
    return (
      <p className="text-xs text-muted-foreground">
        Disponible uniquement dans l'application desktop.
      </p>
    );
  }

  const exists = !!check?.exists;

  return (
    <div className="space-y-3">
      <div className="text-xs">
        {exists ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Watcher actif — log Léo détecté
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Log Léo introuvable — fichier non détecté à l'emplacement standard
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground break-all">
        <span className="font-medium text-foreground">Chemin du log : </span>
        <code className="text-[10px]">{check?.path || "—"}</code>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy} className="flex-1 gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Vérifier le chemin
        </Button>
        <Button size="sm" variant="outline" onClick={customize} className="flex-1 gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Personnaliser
        </Button>
      </div>

      <LogDetectionWizard onApplied={() => { void refresh(); }} />

      <div className="rounded border bg-muted/30 p-2 text-[11px]">
        <div className="font-medium text-foreground mb-0.5">Dernière délivrance détectée</div>
        {last.cip13 ? (
          <div>
            CIP13 <code className="font-mono">{last.cip13}</code>{" "}
            <span className="text-muted-foreground">{formatRelative(last.timestamp)}</span>
          </div>
        ) : (
          <div className="text-muted-foreground">Aucune délivrance détectée depuis le démarrage</div>
        )}
      </div>
    </div>
  );
}
