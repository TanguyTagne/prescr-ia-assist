import { useRef, useState } from "react";
import { Network, Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Panneau "Test manuel d'une IP / port" pour les Paramètres › Robot.
//
// L'utilisateur tape l'IP + le port du robot, clique « Tester », puis déclenche
// une vraie délivrance DEPUIS ce PC. Asclion sonde en passif (probeCandidate,
// WinDivert) pendant 20 s et dit :
//   - code capté            → succès, propose d'enregistrer la config.
//   - trafic mais pas de code → port bon, format non reconnu (ou TLS).
//   - rien                  → lance un diagnostic (admin ? WinDivert ? une
//                             connexion vers cette IP existe-t-elle ?) et donne
//                             la raison la plus probable.
// 100 % passif, réutilise les IPC existants (aucun changement backend requis).

const PROBE_MS = 20_000;
const BRAND = "rowa"; // Omnicell / Rowa parlent WWKS2 ; la sonde est de toute façon agnostique.
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

type Result =
  | { kind: "success"; ean: string; frame?: string }
  | { kind: "traffic"; packets: number; payloadBytes?: number }
  | { kind: "empty"; message: string; needsAdmin?: boolean }
  | { kind: "error"; message: string; needsAdmin?: boolean };

interface Props {
  /** Appelé après enregistrement d'une config validée, pour recharger l'UI parente. */
  onSaved?: () => void;
}

export default function RobotManualTest({ onSaved }: Props) {
  const robotApi = (typeof window !== "undefined" ? (window as any).electronAPI?.robot : null) as any;
  const systemApi = (typeof window !== "undefined" ? (window as any).electronAPI?.system : null) as any;

  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const validate = (): string | null => {
    if (!IPV4.test(ip.trim())) return "Adresse IP invalide (format attendu : 172.31.231.95).";
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return "Port invalide (un entier entre 1 et 65535).";
    return null;
  };

  // Capture vide → pourquoi ? On interroge les IPC déjà exposés (admin,
  // disponibilité WinDivert, et présence d'une connexion TCP vers l'IP saisie).
  const diagnose = async (): Promise<Result> => {
    let elevated: boolean | null = null;
    let windivertOk: boolean | null = null;
    let hasConn = false;
    try {
      const elev = await systemApi?.isElevated?.();
      elevated = typeof elev === "boolean" ? elev : elev?.elevated ?? null;
    } catch { /* ignore */ }
    try {
      const st = await robotApi.status();
      windivertOk = st?.sniffer?.windivertAvailable ?? null;
    } catch { /* ignore */ }
    try {
      const disc = await robotApi.discoverPort?.();
      if (disc?.ok && Array.isArray(disc.candidates)) {
        hasConn = disc.candidates.some(
          (c: any) => c.robotServerIp === ip.trim() || c.remoteAddress === ip.trim(),
        );
      }
    } catch { /* ignore */ }

    if (elevated === false) {
      return {
        kind: "empty",
        needsAdmin: true,
        message: "Asclion n'est pas en administrateur → le driver de capture WinDivert ne démarre pas. Relance en admin puis reteste.",
      };
    }
    if (windivertOk === false) {
      return {
        kind: "empty",
        message: "Binaires WinDivert absents de l'installation. Réinstalle Asclion depuis l'installeur le plus récent.",
      };
    }
    if (!hasConn) {
      return {
        kind: "empty",
        message: `Aucune connexion TCP vers ${ip.trim()} détectée depuis ce PC pendant le test. Soit la délivrance n'a pas été déclenchée dans les 20 s, soit ce poste ne parle pas directement à cette IP (le robot est peut-être derrière un serveur).`,
      };
    }
    return {
      kind: "empty",
      message: `Une connexion vers ${ip.trim()}:${port} existe, mais aucun paquet n'a été capté. Probablement du trafic loopback non vu par WinDivert, ou une liaison chiffrée (TLS) — illisible en capture passive.`,
    };
  };

  const runTest = async () => {
    const err = validate();
    if (err) {
      setResult({ kind: "error", message: err });
      return;
    }
    if (!robotApi?.probeCandidate) {
      setResult({ kind: "error", message: "Test disponible uniquement dans l'application desktop Asclion." });
      return;
    }

    setResult(null);
    setTesting(true);
    setProgress(0);
    clearTimer();
    const started = Date.now();
    timerRef.current = setInterval(() => {
      setProgress(Math.min(97, ((Date.now() - started) / PROBE_MS) * 100));
    }, 250);

    let res: any;
    try {
      res = await robotApi.probeCandidate({ port: Number(port), robotServerIp: ip.trim(), durationMs: PROBE_MS });
    } catch (e: any) {
      res = { ok: false, error: String(e?.message || e) };
    }
    clearTimer();
    setProgress(100);
    // Trace dans la console DevTools — sert de "log quelque part".
    // eslint-disable-next-line no-console
    console.log("[Asclion] test manuel robot", { ip: ip.trim(), port, result: res });

    let final: Result;
    if (res?.ok && res.eanFound) {
      final = { kind: "success", ean: res.eanFound, frame: res.frame };
    } else if (!res?.ok) {
      const e = String(res?.error || "").toLowerCase();
      const needsAdmin = e.includes("win32=5") || e.includes("access") || e.includes("denied") || e.includes("admin");
      final = { kind: "error", needsAdmin, message: res?.error || "Erreur inconnue pendant le test." };
    } else if ((res.packets || 0) > 0) {
      final = { kind: "traffic", packets: res.packets, payloadBytes: res.payloadBytes };
    } else {
      final = await diagnose();
    }
    setResult(final);
    setTesting(false);
  };

  const relaunchAdmin = async () => {
    try {
      await systemApi?.relaunchAsAdmin?.();
    } catch (e: any) {
      toast.error("Relance admin impossible", { description: String(e?.message || e).slice(0, 160) });
    }
  };

  const saveConfig = async () => {
    try {
      const res = await robotApi.setConfig({
        robot: {
          enabled: true,
          brand: BRAND,
          port: Number(port),
          robotServerIp: ip.trim(),
          captureDirection: "both",
          captureBackend: "auto",
          passiveOnly: true,
          useNpcap: true,
        },
      });
      if (!res?.ok) {
        toast.error("Enregistrement échoué", { description: res?.error || "Erreur inconnue" });
        return;
      }
      toast.success("Configuration enregistrée", { description: `${ip.trim()}:${port} en capture passive.` });
      onSaved?.();
    } catch (e: any) {
      toast.error("Erreur", { description: String(e?.message || e).slice(0, 160) });
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
      <Label className="text-[11px] font-semibold flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5" />
        Test manuel d'une IP / port
      </Label>
      <p className="text-[10px] text-muted-foreground leading-tight">
        Saisis l'IP et le port du robot, clique « Tester », puis fais une <strong>vraie délivrance depuis ce PC</strong> dans les 20 s. Asclion te dit s'il capte le code — ou pourquoi pas.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Adresse IP du robot</Label>
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="172.31.231.95"
            className="h-8 text-xs font-mono"
            spellCheck={false}
            disabled={testing}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Port</Label>
          <Input
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="5010"
            inputMode="numeric"
            className="h-8 text-xs font-mono"
            disabled={testing}
          />
        </div>
      </div>

      <Button size="sm" className="w-full h-8 gap-1.5 text-xs" onClick={runTest} disabled={testing || !robotApi}>
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Network className="h-3.5 w-3.5" />}
        {testing ? "Test en cours (20 s) — fais une délivrance…" : "Tester cette IP / port (20 s)"}
      </Button>

      {testing && (
        <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}

      {result?.kind === "success" && (
        <div className="rounded-md border border-green-500/40 bg-green-500/5 p-2.5 space-y-2 text-xs">
          <p className="font-medium flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Délivrance captée !
          </p>
          <p>
            Code : <span className="font-mono font-semibold">{result.ean}</span>
            {result.frame === "wwks2" && <Badge variant="outline" className="ml-2 text-[10px]">WWKS2</Badge>}
          </p>
          <Button size="sm" className="w-full h-7 gap-1.5 text-[11px]" onClick={saveConfig}>
            <Save className="h-3.5 w-3.5" />
            Enregistrer cette configuration
          </Button>
        </div>
      )}

      {result?.kind === "traffic" && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-2.5 text-xs">
          <p className="flex items-start gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>{result.packets} paquet(s) capté(s)</strong>, mais aucun code extrait. Le port est bon, mais le format n'est pas reconnu (autre marque, ou liaison chiffrée TLS). Essaie de capturer en mode diagnostic pour voir la trame brute.
            </span>
          </p>
        </div>
      )}

      {(result?.kind === "empty" || result?.kind === "error") && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 space-y-2 text-xs">
          <p className="flex items-start gap-2 text-destructive">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{result.message}</span>
          </p>
          {result.needsAdmin && (
            <Button size="sm" className="gap-1.5 h-7 text-[11px]" onClick={relaunchAdmin}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Relancer en administrateur
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
