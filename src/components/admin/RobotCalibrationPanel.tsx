import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, Play, Square, CheckCircle2, AlertCircle, Loader2,
  Usb, HardDrive, Cable, FileText, Network, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

// ── Types ───────────────────────────────────────────────────────────────────
interface LgoProc {
  name: string;
  pid: number;
  exePath: string;
  installDir: string;
}

interface TcpConn {
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  state: string;
}

interface RecentFile {
  path: string;
  ext: string;
  sizeBytes: number;
  modifiedAgo: number;
}

interface SnapshotData {
  lgoProcs: LgoProc[];
  installDir: string;
  busyCom: string[];
  tcp: TcpConn[];
  robotPipes: string[];
  recentFiles: RecentFile[];
  scannedAt: string;
}

interface CalibrateEvent {
  type: "ready" | "change" | "done" | "error";
  path?: string;
  ext?: string;
  changeType?: string;
  time?: string;
  files?: RecentFile[];
  totalEvents?: number;
  uniqueFiles?: number;
  message?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const robotApi = () =>
  typeof window !== "undefined" ? (window as any).electronAPI?.robot : null;

function shortPath(p: string) {
  if (!p) return "—";
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.length > 3 ? "…/" + parts.slice(-2).join("/") : p;
}

const EXT_ICONS: Record<string, string> = {
  ".mdb": "🗄️", ".db": "🗄️", ".sqlite": "🗄️", ".sqlite3": "🗄️",
  ".log": "📝", ".txt": "📝", ".xml": "📄", ".json": "📄",
  ".csv": "📊", ".dat": "💾",
};

function extIcon(ext: string) {
  return EXT_ICONS[ext] ?? "📁";
}

// ── Sous-composants ──────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
    {children}
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="text-xs text-muted-foreground italic px-1">{text}</div>
);

// ── Composant principal ──────────────────────────────────────────────────────
const CAPTURE_DURATION_S = 35;

const RobotCalibrationPanel = () => {
  const isDesktop = isAsclionDesktopRuntime();

  // ─── Étape 1 : Snapshot ──────────────────────────────────────────────────
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const runSnapshot = useCallback(async () => {
    const api = robotApi();
    if (!api?.calibrateSnapshot) return;
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const res = await api.calibrateSnapshot();
      if (res?.ok && res.data) {
        // Défensif : le diagnostic peut renvoyer un champ non-tableau (script
        // absent, JSON partiel…). On force chaque liste à être un tableau,
        // sinon un .map() plus bas fait planter toute l'app au rendu.
        const d: any = res.data;
        const arr = (v: any) => (Array.isArray(v) ? v : []);
        setSnapshot({
          ...d,
          lgoProcs: arr(d.lgoProcs),
          busyCom: arr(d.busyCom),
          tcp: arr(d.tcp),
          robotPipes: arr(d.robotPipes),
          recentFiles: arr(d.recentFiles),
        });
        if ((res.data.lgoProcs || []).length === 0) {
          toast.warning("Aucun processus LGO trouvé", {
            description: "Le LGO est peut-être arrêté ou son nom n'est pas encore connu d'Asclion.",
          });
        }
      } else {
        setSnapshotError(res?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      setSnapshotError(e?.message || "Erreur");
    }
    setSnapshotLoading(false);
  }, []);

  // ─── Étape 2 : Capture ──────────────────────────────────────────────────
  const [captureState, setCaptureState] = useState<"idle" | "starting" | "ready" | "capturing" | "done">("idle");
  const [captureEvents, setCaptureEvents] = useState<CalibrateEvent[]>([]);
  const [captureSummary, setCaptureSummary] = useState<CalibrateEvent | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCapture = useCallback(async () => {
    const api = robotApi();
    if (!api?.calibrateStart) return;

    setCaptureEvents([]);
    setCaptureSummary(null);
    setCaptureState("starting");
    setCountdown(CAPTURE_DURATION_S);

    // Abonnement aux événements temps réel
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = api.onCalibrateEvent((evt: CalibrateEvent) => {
      if (evt.type === "ready") {
        setCaptureState("ready");
        // Démarre le décompte après le signal READY
        clearCountdown();
        setCountdown(CAPTURE_DURATION_S);
        countdownRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) { clearCountdown(); return 0; }
            return c - 1;
          });
        }, 1000);
      } else if (evt.type === "change") {
        setCaptureState("capturing");
        setCaptureEvents((prev) => [evt, ...prev].slice(0, 100));
      } else if (evt.type === "done") {
        clearCountdown();
        setCaptureState("done");
        setCaptureSummary(evt);
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      } else if (evt.type === "error") {
        clearCountdown();
        setCaptureState("idle");
        toast.error("Erreur capture", { description: evt.message });
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      }
    });

    const res = await api.calibrateStart({
      watchDir: snapshot?.installDir || undefined,
      duration: CAPTURE_DURATION_S,
    });
    if (!res?.ok) {
      clearCountdown();
      setCaptureState("idle");
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      toast.error("Impossible de démarrer la capture", { description: res?.error });
    }
  }, [snapshot?.installDir]);

  const stopCapture = useCallback(async () => {
    const api = robotApi();
    clearCountdown();
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    await api?.calibrateStop?.();
    setCaptureState("idle");
  }, []);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      clearCountdown();
      if (unsubRef.current) unsubRef.current();
      robotApi()?.calibrateStop?.();
    };
  }, []);

  // ─── Render : non-desktop ─────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-primary" />
            Calibration canal robot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Disponible uniquement dans l'application desktop Asclion (Windows).
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────
  const lgoFound = (snapshot?.lgoProcs || []).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          Calibration canal robot
          <Badge variant="outline" className="text-[10px]">Terrain</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Détecte automatiquement comment le LGO communique avec le robot automate
          (COM/RS232, fichier, pipe, TCP). En 2 étapes — moins de 5 minutes.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Étape 1 : Analyser ────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
              1
            </div>
            <span className="text-sm font-semibold">Analyser le LGO</span>
            <Button
              size="sm"
              variant={snapshot ? "outline" : "default"}
              onClick={runSnapshot}
              disabled={snapshotLoading}
              className="ml-auto gap-1.5 h-7"
            >
              {snapshotLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyse…</>
                : <><Search className="h-3.5 w-3.5" />{snapshot ? "Relancer" : "Analyser"}</>
              }
            </Button>
          </div>

          {snapshotError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {snapshotError}
            </div>
          )}

          {snapshot && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-3 text-xs">

              {/* Processus LGO */}
              <div>
                <SectionLabel>Processus LGO</SectionLabel>
                {(snapshot.lgoProcs || []).length === 0 ? (
                  <EmptyRow text="Aucun processus LGO détecté — LGO démarré ?" />
                ) : (
                  <div className="space-y-1">
                    {(snapshot.lgoProcs || []).map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-mono font-semibold">{p.name}.exe</span>
                          <span className="text-muted-foreground ml-2">(PID {p.pid})</span>
                          {p.installDir && (
                            <div className="text-muted-foreground truncate max-w-xs" title={p.installDir}>
                              {shortPath(p.installDir)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ports COM occupés */}
              <div>
                <SectionLabel>Ports COM occupés (candidats RS232)</SectionLabel>
                {(snapshot.busyCom || []).length === 0 ? (
                  <EmptyRow text="Aucun port COM occupé (pas de communication série détectée)" />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(snapshot.busyCom || []).map((port) => (
                      <span key={port} className="inline-flex items-center gap-1 rounded bg-orange-500/10 border border-orange-500/30 text-orange-700 px-2 py-0.5 font-mono font-semibold">
                        <Usb className="h-3 w-3" />
                        {port}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Connexions TCP */}
              <div>
                <SectionLabel>Connexions TCP du LGO</SectionLabel>
                {(snapshot.tcp || []).length === 0 ? (
                  <EmptyRow text="Aucune connexion TCP active (communication non-réseau)" />
                ) : (
                  <div className="space-y-0.5 font-mono">
                    {(snapshot.tcp || []).filter(c => c.state === "Established").slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Network className="h-3 w-3 text-blue-500 shrink-0" />
                        <span className="text-muted-foreground">:{c.localPort}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span>{c.remoteAddr}:{c.remotePort}</span>
                        <Badge variant="outline" className="text-[9px] h-4">{c.state}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Named Pipes */}
              {(snapshot.robotPipes || []).length > 0 && (
                <div>
                  <SectionLabel>Named Pipes robot détectés</SectionLabel>
                  <div className="space-y-0.5 font-mono">
                    {(snapshot.robotPipes || []).map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Cable className="h-3 w-3 text-purple-500 shrink-0" />
                        <span className="truncate">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichiers récents */}
              <div>
                <SectionLabel>Fichiers actifs dans le répertoire LGO (5 min)</SectionLabel>
                {(snapshot.recentFiles || []).length === 0 ? (
                  <EmptyRow text="Aucun fichier modifié récemment" />
                ) : (
                  <div className="space-y-0.5">
                    {(snapshot.recentFiles || []).slice(0, 8).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono">
                        <span>{extIcon(f.ext)}</span>
                        <span className="truncate max-w-[240px]" title={f.path}>
                          {shortPath(f.path)}
                        </span>
                        <span className="text-muted-foreground ml-auto shrink-0">
                          il y a {f.modifiedAgo}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-muted-foreground pt-1">
                Scanné à {snapshot.scannedAt}
              </div>
            </div>
          )}
        </div>

        {/* ── Étape 2 : Capturer ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 ${lgoFound ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              2
            </div>
            <span className={`text-sm font-semibold ${!lgoFound ? "text-muted-foreground" : ""}`}>
              Capturer un appel robot
            </span>

            {captureState === "idle" || captureState === "done" ? (
              <Button
                size="sm"
                onClick={startCapture}
                disabled={!lgoFound}
                className="ml-auto gap-1.5 h-7"
              >
                <Play className="h-3.5 w-3.5" />
                {captureState === "done" ? "Relancer" : "Lancer la capture"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={stopCapture}
                className="ml-auto gap-1.5 h-7"
              >
                <Square className="h-3.5 w-3.5" />
                Arrêter
              </Button>
            )}
          </div>

          {/* État de la capture */}
          {captureState === "starting" && (
            <div className="rounded-lg bg-secondary p-3 flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              Démarrage du watcher…
            </div>
          )}

          {captureState === "ready" && (
            <div className="rounded-lg bg-primary/5 border-2 border-primary/30 p-3 text-sm">
              <div className="font-semibold text-primary flex items-center gap-2">
                <span className="animate-pulse">●</span>
                Capture active — {countdown}s restantes
              </div>
              <div className="text-muted-foreground mt-1">
                👉 Déclenchez maintenant une délivrance sur le robot depuis le LGO.
                Asclion détecte automatiquement ce qui change.
              </div>
            </div>
          )}

          {captureState === "capturing" && (
            <div className="rounded-lg bg-primary/5 border-2 border-primary/30 p-3 text-sm">
              <div className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Changements détectés — {countdown}s restantes
              </div>
            </div>
          )}

          {/* Événements temps réel */}
          {captureEvents.length > 0 && (
            <div className="rounded-lg border border-border bg-card font-mono text-xs max-h-48 overflow-y-auto">
              {captureEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 last:border-0">
                  <span>{extIcon(e.ext || "")}</span>
                  <span className="text-muted-foreground shrink-0">{e.time}</span>
                  <span className="truncate" title={e.path}>{shortPath(e.path || "")}</span>
                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">{e.changeType}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Résumé final */}
          {captureSummary && captureState === "done" && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Capture terminée — {captureSummary.uniqueFiles ?? 0} fichier(s) modifié(s)
              </div>

              {(captureSummary.files || []).length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Aucun changement détecté. La communication passe peut-être par un autre canal
                  (COM/RS232 ou named pipe) — consultez l'analyse ci-dessus.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground mb-2">
                    Ces fichiers ont été modifiés pendant l'appel robot :
                  </div>
                  {(captureSummary.files || []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded bg-background border border-border/50 px-2 py-1.5">
                      <span className="text-base">{extIcon(f.ext)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate font-semibold" title={f.path}>
                          {shortPath(f.path)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {f.ext} · {(f.sizeBytes / 1024).toFixed(1)} Ko
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 shrink-0"
                        onClick={() => {
                          toast.success("Canal sélectionné", {
                            description: `Asclion surveillera ${shortPath(f.path)}`,
                          });
                        }}
                      >
                        Utiliser
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!lgoFound && !snapshotLoading && snapshot && (
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Lancez d'abord l'Étape 1 pour détecter le LGO.
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

export default RobotCalibrationPanel;
