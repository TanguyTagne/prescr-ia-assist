import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Search, Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  Network, Cable, ArrowRight, RefreshCw, Wand2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  mergeDiscoveryResults,
  confidenceTone,
  type DiscoveryCandidate,
} from "@/lib/robotDiscovery";

// Assistant de connexion robot — fusionne l'ancien « Rechercher » (port) et
// l'ancien « Diagnostic robot (PC serveur) » en un seul parcours guidé :
//   Découverte  →  2-3 candidats classés par confiance  →  Sélection
//   →  Enregistrer + Tester (vraie délivrance, 60 s)  →  Confirmer.
//
// 100 % PASSIF : la capture (WinDivert/Npcap) observe le trafic sans jamais
// s'insérer entre le LGO et le robot. Aucun relais, aucun risque de couper la
// chaîne de dispensation. Le mode passif est forcé à l'enregistrement.

type Step =
  | "intro"
  | "discovering"
  | "results"
  | "testing"
  | "success"
  | "timeout"
  | "error";

type RobotBrand = "rowa" | "pharmathek" | "generic";

interface ProbeResult {
  ok: boolean;
  eanFound?: string | null;
  frame?: "wwks2" | "xml" | "raw";
  packets?: number;
  payloadBytes?: number;
  note?: string;
  error?: string;
}

interface RobotConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a candidate is confirmed & persisted, so the parent can reload. */
  onConfigSaved?: () => void;
}

const DISCOVERY_CAPTURE_MS = 20_000;
const PROBE_MS = 60_000;

const BRAND_LABELS: Record<RobotBrand, string> = {
  rowa: "Rowa / BD / Omnicell (WWKS2)",
  pharmathek: "Pharmathek",
  generic: "Générique (regex)",
};

// Map a WinDivert/admin failure to a friendly, actionable message + whether we
// should offer the "relaunch as admin" shortcut.
function explainProbeError(err: string | undefined): { message: string; needsAdmin: boolean } {
  const e = (err || "").toLowerCase();
  if (e.includes("win32=5") || e.includes("access") || e.includes("denied") || e.includes("administrat")) {
    return {
      message:
        "Asclion n'est pas en administrateur : le driver de capture WinDivert ne peut pas démarrer. Relance en admin puis recommence.",
      needsAdmin: true,
    };
  }
  if (e.includes("windivert manquant") || e.includes(".sys") || e.includes(".dll") || e.includes("win32=2")) {
    return {
      message: "Les binaires WinDivert sont absents de l'installation. Réinstalle Asclion depuis l'installeur le plus récent.",
      needsAdmin: false,
    };
  }
  if (e.includes("windows uniquement")) {
    return { message: "La capture n'est disponible que dans l'application desktop Asclion (Windows).", needsAdmin: false };
  }
  return { message: err || "Erreur inconnue pendant le test.", needsAdmin: false };
}

const toneClasses: Record<"high" | "medium" | "low", string> = {
  high: "bg-green-500/10 text-green-700 border-green-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  low: "bg-secondary text-secondary-foreground border-border",
};

export default function RobotConnectionWizard({ open, onOpenChange, onConfigSaved }: RobotConnectionWizardProps) {
  const robotApi = (typeof window !== "undefined" ? (window as any).electronAPI?.robot : null) as any;
  const systemApi = (typeof window !== "undefined" ? (window as any).electronAPI?.system : null) as any;

  const [step, setStep] = useState<Step>("intro");
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brand, setBrand] = useState<RobotBrand>("rowa");
  const [progress, setProgress] = useState(0);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ message: string; needsAdmin: boolean } | null>(null);
  const [discoveryNote, setDiscoveryNote] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? null,
    [candidates, selectedId],
  );

  const clearProgressTimer = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // Reset everything whenever the dialog is (re)opened, and stop timers on close.
  useEffect(() => {
    if (open) {
      cancelledRef.current = false;
      setStep("intro");
      setCandidates([]);
      setSelectedId(null);
      setBrand("rowa");
      setProgress(0);
      setProbe(null);
      setErrorInfo(null);
      setDiscoveryNote(null);
    } else {
      cancelledRef.current = true;
      clearProgressTimer();
    }
    return () => clearProgressTimer();
  }, [open]);

  // ───── Step 1 — Découverte ─────────────────────────────────────────
  const runDiscovery = useCallback(async () => {
    if (!robotApi?.autoDetectPort && !robotApi?.discoverPort) {
      toast.error("Découverte disponible uniquement dans l'application desktop Asclion.");
      return;
    }
    setStep("discovering");
    setProgress(0);
    setDiscoveryNote(null);
    clearProgressTimer();
    const startedAt = Date.now();
    progressTimer.current = setInterval(() => {
      const pct = Math.min(95, ((Date.now() - startedAt) / DISCOVERY_CAPTURE_MS) * 100);
      setProgress(pct);
    }, 300);

    // Run the three probes together. The live capture is authoritative but slow
    // (~20 s); the connection snapshot and pipe list are instant supplements.
    const [liveRes, connRes, pipeRes] = await Promise.allSettled([
      robotApi.autoDetectPort ? robotApi.autoDetectPort(DISCOVERY_CAPTURE_MS) : Promise.resolve(null),
      robotApi.discoverPort ? robotApi.discoverPort() : Promise.resolve(null),
      robotApi.discoverPipes ? robotApi.discoverPipes() : Promise.resolve(null),
    ]);
    clearProgressTimer();
    setProgress(100);
    if (cancelledRef.current) return;

    const live = liveRes.status === "fulfilled" && liveRes.value?.ok ? liveRes.value.candidates || [] : [];
    const conns = connRes.status === "fulfilled" && connRes.value?.ok ? connRes.value.candidates || [] : [];
    const pipes = pipeRes.status === "fulfilled" && pipeRes.value?.ok ? pipeRes.value.candidates || [] : [];

    const merged = mergeDiscoveryResults({ live, conns, pipes }, 6);
    setCandidates(merged);

    // Surface the first probe error (e.g. not admin) if everything came back empty.
    const liveErr = liveRes.status === "fulfilled" ? liveRes.value?.error : null;
    if (merged.length === 0) {
      setDiscoveryNote(
        liveErr
          ? explainProbeError(liveErr).message
          : "Aucun candidat détecté. Déclenche une vraie délivrance sur le LGO PENDANT la découverte, puis relance.",
      );
      if (liveErr) setErrorInfo(explainProbeError(liveErr));
    } else {
      setSelectedId(merged[0].id);
    }
    setStep("results");
  }, [robotApi]);

  // ───── Step 2/3 — Enregistrer + Tester un candidat (passif) ────────
  const testCandidate = useCallback(
    async (candidate: DiscoveryCandidate) => {
      if (candidate.kind !== "tcp" || !candidate.port) {
        toast.info("Ce candidat est un Named Pipe (piste informative). Choisis un candidat TCP pour le test de capture.");
        return;
      }
      setSelectedId(candidate.id);
      setProbe(null);
      setErrorInfo(null);
      setStep("testing");
      setProgress(0);

      // 1) Persist the selection in PASSIVE mode (captureBackend auto = WinDivert
      //    then Npcap, passiveOnly = never the tcp-listen relay). This both
      //    "enregistre" the choice and starts production capture immediately.
      try {
        const saveRes = await robotApi.setConfig({
          robot: {
            enabled: true,
            brand,
            port: candidate.port,
            robotServerIp: candidate.robotServerIp || null,
            captureDirection: candidate.captureDirection || "both",
            captureBackend: "auto",
            passiveOnly: true,
            useNpcap: true,
          },
        });
        if (!saveRes?.ok) {
          setErrorInfo({ message: saveRes?.error || "Échec de l'enregistrement de la configuration.", needsAdmin: false });
          setStep("error");
          return;
        }
      } catch (err: any) {
        setErrorInfo({ message: String(err?.message || err).slice(0, 200), needsAdmin: false });
        setStep("error");
        return;
      }

      // 2) Focused passive probe — resolves early on the first captured dispense.
      clearProgressTimer();
      const startedAt = Date.now();
      progressTimer.current = setInterval(() => {
        const pct = Math.min(97, ((Date.now() - startedAt) / PROBE_MS) * 100);
        setProgress(pct);
      }, 300);

      let res: ProbeResult;
      try {
        res = (await robotApi.probeCandidate({
          port: candidate.port,
          robotServerIp: candidate.robotServerIp || null,
          durationMs: PROBE_MS,
        })) as ProbeResult;
      } catch (err: any) {
        res = { ok: false, error: String(err?.message || err) };
      }
      clearProgressTimer();
      setProgress(100);
      if (cancelledRef.current) return;

      setProbe(res);
      if (!res.ok) {
        setErrorInfo(explainProbeError(res.error));
        setStep("error");
        return;
      }
      if (res.eanFound) {
        setStep("success");
      } else {
        setStep("timeout");
      }
    },
    [robotApi, brand],
  );

  // Next candidate in the ranked list (auto-advance on timeout).
  const nextCandidate = useMemo(() => {
    if (!selected) return null;
    const idx = candidates.findIndex((c) => c.id === selected.id);
    for (let i = idx + 1; i < candidates.length; i++) {
      if (candidates[i].kind === "tcp" && candidates[i].port) return candidates[i];
    }
    return null;
  }, [candidates, selected]);

  // ───── Final — Confirmer / persister ───────────────────────────────
  const confirmAndFinish = useCallback(async () => {
    // Config was already saved (enabled, passive) at the start of the test. If
    // the pharmacist changed the brand on the success screen, re-save it.
    try {
      if (selected?.port) {
        await robotApi.setConfig({
          robot: {
            enabled: true,
            brand,
            port: selected.port,
            robotServerIp: selected.robotServerIp || null,
            captureDirection: selected.captureDirection || "both",
            captureBackend: "auto",
            passiveOnly: true,
            useNpcap: true,
          },
        });
      }
      toast.success("Robot connecté", {
        description: `${selected?.label ?? "Candidat"} enregistré en capture passive. Asclion analysera les délivrances automatiquement.`,
      });
      onConfigSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erreur d'enregistrement", { description: String(err?.message || err).slice(0, 180) });
    }
  }, [robotApi, brand, selected, onConfigSaved, onOpenChange]);

  const relaunchAdmin = useCallback(async () => {
    try {
      await systemApi?.relaunchAsAdmin?.();
    } catch (err: any) {
      toast.error("Impossible de relancer en admin", { description: String(err?.message || err).slice(0, 160) });
    }
  }, [systemApi]);

  // ───── Render helpers ──────────────────────────────────────────────
  const ProgressBar = ({ pct }: { pct: number }) => (
    <div className="h-2 w-full rounded bg-muted overflow-hidden">
      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );

  const CandidateRow = ({ c }: { c: DiscoveryCandidate }) => {
    const tone = confidenceTone(c.confidence);
    const isSel = c.id === selectedId;
    const isPipe = c.kind === "pipe";
    return (
      <button
        type="button"
        onClick={() => setSelectedId(c.id)}
        className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
          isSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium truncate">
            {isPipe ? <Cable className="h-3.5 w-3.5 shrink-0" /> : <Network className="h-3.5 w-3.5 shrink-0" />}
            {c.label}
          </span>
          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${toneClasses[tone]}`}>
            {c.confidence}%
          </span>
        </div>
        {c.sublabel && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.sublabel}</p>}
        {c.reasons.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{c.reasons.join(" · ")}</p>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-5 w-5 text-primary" />
            Assistant de connexion au robot
          </DialogTitle>
          <DialogDescription className="text-xs">
            Détection automatique du lien LGO ↔ robot, test par une vraie délivrance, en capture 100&nbsp;% passive.
          </DialogDescription>
        </DialogHeader>

        {/* INTRO */}
        {step === "intro" && (
          <div className="space-y-3 mt-1">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="flex items-start gap-2">
                <Search className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>Asclion lance les commandes réseau et propose 2-3 chemins possibles (IP / port TCP, ou Named Pipe), classés par confiance.</span>
              </p>
              <p className="flex items-start gap-2">
                <Bot className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>Tu en sélectionnes un, tu l'enregistres, puis tu fais une délivrance test sur le LGO pour valider le bon chemin.</span>
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
                <span><strong>Aucun risque :</strong> écoute passive uniquement. Asclion n'intercepte jamais le flux — si Asclion s'arrête, le robot continue normalement.</span>
              </p>
            </div>
            <Button className="w-full gap-2" onClick={runDiscovery}>
              <Search className="h-4 w-4" />
              Lancer la découverte
            </Button>
          </div>
        )}

        {/* DISCOVERING */}
        {step === "discovering" && (
          <div className="space-y-3 mt-1">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Découverte en cours (~20&nbsp;s)…
            </div>
            <ProgressBar pct={progress} />
            <p className="text-xs text-muted-foreground">
              Astuce : déclenche une <strong>vraie délivrance</strong> sur le LGO pendant cette fenêtre — le bon port remontera en tête avec une confiance maximale.
            </p>
          </div>
        )}

        {/* RESULTS */}
        {step === "results" && (
          <div className="space-y-3 mt-1">
            {candidates.length === 0 ? (
              <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-xs space-y-2">
                <p className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{discoveryNote || "Aucun candidat détecté."}</span>
                </p>
                {errorInfo?.needsAdmin && (
                  <Button size="sm" className="gap-1.5" onClick={relaunchAdmin}>
                    <ShieldCheck className="h-4 w-4" />
                    Relancer Asclion en administrateur
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {candidates.length} chemin(s) possible(s). Sélectionne celui du robot, puis lance le test.
                </p>
                <div className="space-y-1.5">
                  {candidates.map((c) => (
                    <CandidateRow key={c.id} c={c} />
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={runDiscovery}>
                <RefreshCw className="h-3.5 w-3.5" />
                Relancer
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!selected || selected.kind !== "tcp"}
                onClick={() => selected && testCandidate(selected)}
              >
                Enregistrer et tester
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* TESTING */}
        {step === "testing" && (
          <div className="space-y-3 mt-1">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                En attente d'une délivrance…
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Déclenche maintenant une <strong>vraie sortie robot depuis le LGO</strong>. Test du candidat
                {" "}<span className="font-mono">{selected?.label}</span> pendant 60&nbsp;s.
              </p>
            </div>
            <ProgressBar pct={progress} />
            <p className="text-[11px] text-muted-foreground">
              Capture passive en cours — le robot reçoit son ordre normalement, Asclion ne fait qu'observer.
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && probe?.eanFound && (
          <div className="space-y-3 mt-1">
            <div className="rounded-md border border-green-500/40 bg-green-500/5 p-3 space-y-1.5">
              <p className="text-sm font-medium flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Délivrance captée — chemin validé&nbsp;!
              </p>
              <p className="text-xs">
                Code médicament capturé : <span className="font-mono font-semibold">{probe.eanFound}</span>
                {probe.frame === "wwks2" && <Badge variant="outline" className="ml-2 text-[10px]">WWKS2</Badge>}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">{selected?.label}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Marque du robot (pour l'extraction en production)</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as RobotBrand)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                {(Object.keys(BRAND_LABELS) as RobotBrand[]).map((b) => (
                  <option key={b} value={b}>{BRAND_LABELS[b]}</option>
                ))}
              </select>
            </div>

            <Button className="w-full gap-2" onClick={confirmAndFinish}>
              <CheckCircle2 className="h-4 w-4" />
              Confirmer et activer la connexion
            </Button>
          </div>
        )}

        {/* TIMEOUT — auto-advance to next candidate */}
        {step === "timeout" && (
          <div className="space-y-3 mt-1">
            <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Rien capté sur ce candidat
              </p>
              <p className="text-xs text-muted-foreground">
                {probe?.note || "Aucune délivrance détectée pendant les 60 s."}
                {typeof probe?.packets === "number" && probe.packets > 0 && (
                  <> ({probe.packets} paquet(s) vus mais aucun code extrait — la marque est peut-être différente.)</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => selected && testCandidate(selected)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Réessayer ce candidat
              </Button>
              {nextCandidate && (
                <Button size="sm" className="gap-1.5" onClick={() => testCandidate(nextCandidate)}>
                  Tester le suivant
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setStep("results")}>
                Retour à la liste
              </Button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && errorInfo && (
          <div className="space-y-3 mt-1">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                Test impossible
              </p>
              <p className="text-xs text-muted-foreground">{errorInfo.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {errorInfo.needsAdmin && (
                <Button size="sm" className="gap-1.5" onClick={relaunchAdmin}>
                  <ShieldCheck className="h-4 w-4" />
                  Relancer en administrateur
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setStep("results")}>
                Retour à la liste
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
