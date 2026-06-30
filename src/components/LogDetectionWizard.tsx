import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Wand2, CheckCircle2, AlertTriangle, FileSearch, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * Wizard générique de détection du log LGO/robot.
 *
 * 1. Snapshot des .log/.txt récents du PC
 * 2. Le pharmacien effectue UNE délivrance robot
 * 3. On détecte le(s) fichier(s) qui ont grossi + extraction de CIP13 dans
 *    l'ajout. Marche pour Léo, Winpharma, LGPI, Smart-Rx, etc.
 * 4. Le pharmacien valide → on enregistre le chemin dans la config et le
 *    watcher Asclion est redémarré dessus.
 */

type Phase = "idle" | "discover" | "waiting" | "done" | "error";

const DURATION_MS = 30_000;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

function shortPath(p: string, max = 70): string {
  if (p.length <= max) return p;
  return "…" + p.slice(p.length - max + 1);
}

export default function LogDetectionWizard({ onApplied }: { onApplied?: (filePath: string) => void }) {
  const api = typeof window !== "undefined" ? window.electronAPI?.leo : undefined;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [rootCount, setRootCount] = useState(0);
  const [result, setResult] = useState<LogScanResult | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const offRef = useRef<null | (() => void)>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    try { offRef.current?.(); } catch { /* noop */ }
    offRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!api?.scanStart) {
      toast.error("Wizard indisponible sur cette plateforme");
      return;
    }
    cleanup();
    setResult(null);
    setPhase("discover");
    setRemaining(DURATION_MS);

    offRef.current = api.onScanEvent?.((evt) => {
      if (evt.phase === "discover") {
        setPhase("discover");
      } else if (evt.phase === "ready") {
        setPhase("waiting");
        setFileCount(evt.fileCount);
        setRootCount(evt.rootCount);
        const deadline = evt.deadlineMs;
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setRemaining(Math.max(0, deadline - Date.now()));
        }, 250);
      } else if (evt.phase === "done") {
        setPhase("done");
        setResult(evt);
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      }
    }) ?? null;

    const r = await api.scanStart(DURATION_MS);
    if (!r?.ok) {
      setPhase("error");
      toast.error("Échec du démarrage", { description: r?.error });
      cleanup();
    } else {
      setFileCount(r.fileCount ?? 0);
      setRootCount(r.rootCount ?? 0);
    }
  }, [api, cleanup]);

  const stopNow = useCallback(async () => {
    if (!api?.scanStop) return;
    await api.scanStop();
  }, [api]);

  const apply = useCallback(async (filePath: string) => {
    if (!api?.setClientLogPath) return;
    setApplying(filePath);
    try {
      const r = await api.setClientLogPath(filePath);
      if (r?.ok) {
        toast.success("Log enregistré", { description: shortPath(filePath) });
        onApplied?.(filePath);
        setOpen(false);
      } else {
        toast.error("Échec", { description: r?.error });
      }
    } finally {
      setApplying(null);
    }
  }, [api, onApplied]);

  const close = useCallback(() => {
    cleanup();
    setOpen(false);
    setPhase("idle");
    setResult(null);
  }, [cleanup]);

  if (!api?.scanStart) return null;

  const seconds = Math.ceil(remaining / 1000);
  const withCip = result?.candidates.filter((c) => c.frCipMatches.length > 0) || [];
  const others = result?.candidates.filter((c) => c.frCipMatches.length === 0) || [];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="w-full gap-1.5">
          <Wand2 className="h-3.5 w-3.5" />
          Détecter automatiquement le log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Détection du log LGO/robot
          </DialogTitle>
          <DialogDescription>
            Asclion va surveiller les fichiers .log et .txt actifs sur ce PC.
            Effectuez <strong>une seule délivrance robot</strong> pendant la fenêtre de détection,
            puis nous vous proposerons le bon fichier à utiliser.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Compatible avec Léo, Winpharma, LGPI, Smart-Rx et tout LGO qui écrit le CIP13
              du produit délivré dans un fichier log local.
            </p>
            <Button onClick={start} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Démarrer la détection (30 s)
            </Button>
          </div>
        )}

        {phase === "discover" && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Recensement des fichiers log du PC…
          </div>
        )}

        {phase === "waiting" && (
          <div className="space-y-3">
            <div className="rounded border bg-primary/5 p-3 text-sm">
              <div className="font-medium mb-1">⚡ À vous : effectuez UNE délivrance robot maintenant</div>
              <div className="text-muted-foreground text-xs">
                {fileCount} fichiers surveillés sur {rootCount} emplacements.
                Reste : <strong>{seconds} s</strong>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${100 - (remaining / DURATION_MS) * 100}%` }}
              />
            </div>
            <Button size="sm" variant="outline" onClick={stopNow}>
              Délivrance déjà effectuée — analyser maintenant
            </Button>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-3 text-sm max-h-[55vh] overflow-y-auto">
            {withCip.length === 0 && others.length === 0 ? (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  Aucun fichier log n'a été modifié pendant la détection.
                  Vérifiez que la délivrance robot a bien été déclenchée, puis relancez.
                </div>
              </div>
            ) : (
              <>
                {withCip.length > 0 && (
                  <div>
                    <div className="font-medium mb-1.5 text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {withCip.length} fichier{withCip.length > 1 ? "s" : ""} contiennent un CIP13
                    </div>
                    <div className="space-y-2">
                      {withCip.map((c) => (
                        <CandidateRow key={c.path} c={c} highlight onPick={() => apply(c.path)} applying={applying === c.path} />
                      ))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <details className="rounded border bg-muted/30 p-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {others.length} autre{others.length > 1 ? "s" : ""} fichier{others.length > 1 ? "s" : ""} modifié{others.length > 1 ? "s" : ""} (sans CIP13 détecté)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {others.slice(0, 10).map((c) => (
                        <CandidateRow key={c.path} c={c} onPick={() => apply(c.path)} applying={applying === c.path} />
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => { setPhase("idle"); setResult(null); }}>
                Recommencer
              </Button>
              <Button size="sm" variant="ghost" onClick={close}>Fermer</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="text-sm text-destructive">Erreur lors du démarrage du wizard.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CandidateRow({
  c, highlight, onPick, applying,
}: { c: LogScanCandidate; highlight?: boolean; onPick: () => void; applying: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? "border-emerald-300 bg-emerald-50/50" : "bg-background"}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <code className="text-[11px] break-all">{c.path}</code>
          <div className="mt-1 text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Δ {fmtBytes(c.sizeDelta)}</span>
            {c.frCipMatches.length > 0 && (
              <span className="text-emerald-700">
                CIP13 FR : <code>{c.frCipMatches.slice(0, 3).join(", ")}</code>
              </span>
            )}
            {c.cipMatches.length > c.frCipMatches.length && (
              <span>autres 13-digits : {c.cipMatches.length - c.frCipMatches.length}</span>
            )}
            <span>score {c.score}</span>
          </div>
          {c.snippet && (
            <pre className="mt-1 max-h-20 overflow-auto rounded bg-muted/50 p-1.5 text-[10px] leading-snug whitespace-pre-wrap">
              {c.snippet}
            </pre>
          )}
        </div>
        <Button size="sm" variant={highlight ? "default" : "outline"} onClick={onPick} disabled={applying} className="gap-1 shrink-0">
          {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          Utiliser
        </Button>
      </div>
    </div>
  );
}
