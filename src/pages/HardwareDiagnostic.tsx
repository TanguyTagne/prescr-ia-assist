import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { ScanLine, FolderSearch, Download, Trash2, FileText, AlertCircle, CheckCircle2, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBarcodeScanner, type BarcodeDebugEvent } from "@/hooks/useBarcodeScanner";
import { useFolderWatcher, type WatcherDebugEvent } from "@/hooks/useFolderWatcher";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

const MAX_LOG = 200;

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};

const HardwareDiagnosticTab = () => {

  // ---- Barcode scanner ----
  const [scannerEvents, setScannerEvents] = useState<BarcodeDebugEvent[]>([]);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [rawCapture, setRawCapture] = useState<string>("");
  const [azertyWarned, setAzertyWarned] = useState(false);
  const rawBufferRef = useRef<string>("");
  const rawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Raw keystroke capture (independent of scanner parser) — shows EXACTLY what the douchette sends
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Tab") {
        if (rawBufferRef.current.length > 0) {
          setRawCapture(rawBufferRef.current + `  [${e.key}]`);
          rawBufferRef.current = "";
        }
        return;
      }
      if (e.key.length === 1) {
        rawBufferRef.current += e.key;
        if (rawTimeoutRef.current) clearTimeout(rawTimeoutRef.current);
        rawTimeoutRef.current = setTimeout(() => {
          if (rawBufferRef.current.length > 0) {
            setRawCapture(rawBufferRef.current);
            rawBufferRef.current = "";
          }
        }, 500);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      if (rawTimeoutRef.current) clearTimeout(rawTimeoutRef.current);
    };
  }, []);

  const onScan = useCallback((code: string) => {
    setLastScan(code);
    setScanCount((c) => c + 1);
    toast.success(`Code lu : ${code}`);
  }, []);

  const onScannerDebug = useCallback((ev: BarcodeDebugEvent) => {
    setScannerEvents((prev) => [ev, ...prev].slice(0, MAX_LOG));
    if (ev.type === "azerty-corruption" && !azertyWarned) {
      setAzertyWarned(true);
      toast.error("Douchette mal configurée", {
        description: "Mode US-QWERTY détecté. Reconfigurez en clavier FR-AZERTY (voir livret constructeur).",
        duration: 10000,
      });
    }
  }, [azertyWarned]);

  useBarcodeScanner({ onScan, onDebug: onScannerDebug });

  // ---- Folder watcher ----
  const [watcherEvents, setWatcherEvents] = useState<WatcherDebugEvent[]>([]);
  const [detectedFiles, setDetectedFiles] = useState<{ name: string; size: number; at: number }[]>([]);

  const onNewFile = useCallback((file: File) => {
    setDetectedFiles((prev) => [{ name: file.name, size: file.size, at: Date.now() }, ...prev].slice(0, 50));
  }, []);

  const onWatcherDebug = useCallback((ev: WatcherDebugEvent) => {
    setWatcherEvents((prev) => [ev, ...prev].slice(0, MAX_LOG));
  }, []);

  const watcher = useFolderWatcher({ onNewFile, onDebug: onWatcherDebug });

  // ---- Manual PDF test ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualFile, setManualFile] = useState<{ name: string; size: number; type: string } | null>(null);

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setManualFile({ name: f.name, size: f.size, type: f.type });
    onNewFile(f);
  };

  // ---- Export report ----
  const exportReport = () => {
    const ua = navigator.userAgent;
    const desktop = isAsclionDesktopRuntime();
    const lines: string[] = [];
    lines.push(`# Asclion — Diagnostic Hardware`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`Runtime: ${desktop ? "Desktop (Electron)" : "Web"}`);
    lines.push(`User-Agent: ${ua}`);
    lines.push(``);
    lines.push(`## Scanner code-barres`);
    lines.push(`Scans réussis: ${scanCount}`);
    lines.push(`Dernier code: ${lastScan ?? "—"}`);
    lines.push(`Événements (${scannerEvents.length}):`);
    scannerEvents
      .slice()
      .reverse()
      .forEach((e) => {
        lines.push(
          `  [${formatTime(e.at)}] ${e.type}` +
            (e.key ? ` key="${e.key}"` : "") +
            (e.code ? ` code=${e.code}` : "") +
            (e.elapsedMs !== undefined ? ` Δ=${e.elapsedMs}ms` : "") +
            (e.bufferLen !== undefined ? ` buf=${e.bufferLen}` : "") +
            (e.reason ? ` (${e.reason})` : "")
        );
      });
    lines.push(``);
    lines.push(`## Watcher dossier`);
    lines.push(`Statut: ${watcher.isWatching ? "actif" : "inactif"}`);
    lines.push(`Dossier: ${watcher.folderName ?? "—"}`);
    lines.push(`Erreur récente: ${watcher.lastError ?? "—"}`);
    lines.push(`Fichiers détectés: ${detectedFiles.length}`);
    detectedFiles.forEach((f) => lines.push(`  - ${f.name} (${f.size} o) @ ${formatTime(f.at)}`));
    lines.push(`Événements (${watcherEvents.length}):`);
    watcherEvents
      .slice()
      .reverse()
      .forEach((e) => {
        lines.push(
          `  [${formatTime(e.at)}] ${e.type}` +
            (e.fileName ? ` "${e.fileName}"` : "") +
            (e.size !== undefined ? ` (${e.size} o)` : "") +
            (e.reason ? ` — ${e.reason}` : "")
        );
      });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-hardware-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scannerStatus = useMemo(() => {
    if (scanCount > 0) return { label: "OK", variant: "default" as const, icon: CheckCircle2 };
    if (scannerEvents.some((e) => e.type === "rejected")) return { label: "Codes rejetés", variant: "destructive" as const, icon: AlertCircle };
    return { label: "En attente d'un scan", variant: "secondary" as const, icon: ScanLine };
  }, [scanCount, scannerEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Diagnostic Hardware</h2>
          <p className="text-xs text-muted-foreground">Scanner code-barres et surveillance du dossier de scans</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportReport} className="gap-2">
          <Download className="h-4 w-4" />
          Exporter le rapport
        </Button>
      </div>

      <div className="space-y-6">
        {/* Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <ScanLine className="h-5 w-5 text-primary" />
                Scanner code-barres (HID)
              </span>
              <Badge variant={scannerStatus.variant} className="gap-1.5">
                <scannerStatus.icon className="h-3 w-3" />
                {scannerStatus.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Scans réussis</div>
                <div className="text-2xl font-bold tabular-nums">{scanCount}</div>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Dernier code</div>
                <div className="text-lg font-mono">{lastScan ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Événements capturés</div>
                <div className="text-2xl font-bold tabular-nums">{scannerEvents.length}</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Branchez votre douchette et scannez n'importe quel code-barres. Les frappes clavier sont écoutées
              globalement. Asclion accepte EAN-13, CIP-7, et DataMatrix 2D (GS1).
            </p>

            {/* Raw capture — what the douchette ACTUALLY sends, before any parsing */}
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Keyboard className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide">Capture brute clavier</span>
                <span className="text-xs text-muted-foreground">(ce que la douchette envoie, sans filtre)</span>
              </div>
              <div className="font-mono text-sm break-all min-h-[1.5rem] select-all">
                {rawCapture || <span className="text-muted-foreground italic">Scannez un code pour voir la trame brute…</span>}
              </div>
              {rawCapture && /[éèçà&"'_()-]/.test(rawCapture) && !/^\d+/.test(rawCapture) && (
                <div className="mt-2 text-xs text-destructive font-semibold">
                  ⚠ Caractères non-numériques détectés → douchette probablement en mode US-QWERTY.
                  Reconfigurez-la en clavier français (livret constructeur, code "French keyboard").
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Journal en direct</h3>
                <Button variant="ghost" size="sm" onClick={() => setScannerEvents([])} className="h-7 gap-1.5">
                  <Trash2 className="h-3 w-3" />
                  Vider
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card max-h-64 overflow-y-auto font-mono text-xs">
                {scannerEvents.length === 0 ? (
                  <div className="p-3 text-muted-foreground">Aucun événement. Scannez un code-barres pour commencer.</div>
                ) : (
                  scannerEvents.map((e, i) => (
                    <div key={i} className="flex gap-2 px-3 py-1 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{formatTime(e.at)}</span>
                      <span
                        className={
                          e.type === "scan"
                            ? "text-primary font-semibold"
                            : e.type === "rejected" || e.type === "dedup"
                            ? "text-destructive"
                            : "text-foreground"
                        }
                      >
                        {e.type}
                      </span>
                      {e.key && <span>key="{e.key}"</span>}
                      {e.code && <span>code={e.code}</span>}
                      {e.elapsedMs !== undefined && <span className="text-muted-foreground">Δ={e.elapsedMs}ms</span>}
                      {e.bufferLen !== undefined && <span className="text-muted-foreground">buf={e.bufferLen}</span>}
                      {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Folder watcher */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <FolderSearch className="h-5 w-5 text-primary" />
                Surveillance du dossier de scans
              </span>
              <Badge variant={watcher.isWatching ? "default" : "secondary"}>
                {watcher.isWatching ? "Actif" : "Inactif"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!watcher.isSupported ? (
              <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Votre navigateur ne supporte pas l'API File System Access. Utilisez Chrome, Edge ou
                  l'application desktop Asclion.
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {!watcher.isWatching ? (
                  <Button onClick={watcher.startWatching} className="gap-2">
                    <FolderSearch className="h-4 w-4" />
                    Choisir le dossier à surveiller
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={watcher.stopWatching} className="gap-2">
                      Arrêter la surveillance
                    </Button>
                    <Badge variant="outline" className="self-center">
                      Dossier : {watcher.folderName}
                    </Badge>
                  </>
                )}
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Importer un PDF / image test
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleManualUpload}
                />
              </div>
            )}

            {watcher.lastError && (
              <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Erreur récente</div>
                  <div className="text-xs">{watcher.lastError}</div>
                </div>
              </div>
            )}

            {manualFile && (
              <div className="rounded-lg bg-secondary p-3 text-sm">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Test manuel reçu
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {manualFile.name} — {manualFile.type || "type inconnu"} — {(manualFile.size / 1024).toFixed(1)} Ko
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-2">Fichiers détectés ({detectedFiles.length})</h3>
              <div className="rounded-lg border border-border bg-card max-h-48 overflow-y-auto text-sm">
                {detectedFiles.length === 0 ? (
                  <div className="p-3 text-muted-foreground">
                    Aucun fichier détecté. Déposez un PDF ou une image dans le dossier surveillé.
                  </div>
                ) : (
                  detectedFiles.map((f, i) => (
                    <div key={i} className="flex justify-between gap-2 px-3 py-1.5 border-b border-border/50 last:border-0">
                      <span className="font-mono text-xs truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {(f.size / 1024).toFixed(1)} Ko · {formatTime(f.at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Journal en direct</h3>
                <Button variant="ghost" size="sm" onClick={() => setWatcherEvents([])} className="h-7 gap-1.5">
                  <Trash2 className="h-3 w-3" />
                  Vider
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card max-h-64 overflow-y-auto font-mono text-xs">
                {watcherEvents.length === 0 ? (
                  <div className="p-3 text-muted-foreground">Aucun événement.</div>
                ) : (
                  watcherEvents.map((e, i) => (
                    <div key={i} className="flex gap-2 px-3 py-1 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{formatTime(e.at)}</span>
                      <span
                        className={
                          e.type === "detected"
                            ? "text-primary font-semibold"
                            : e.type === "error"
                            ? "text-destructive"
                            : "text-foreground"
                        }
                      >
                        {e.type}
                      </span>
                      {e.fileName && <span className="truncate">{e.fileName}</span>}
                      {e.size !== undefined && <span className="text-muted-foreground">({e.size} o)</span>}
                      {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default HardwareDiagnostic;
