import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ShieldCheck, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

// Diagnostic one-click pour la capture robot (WinDivert).
// Lit electronAPI.robot.status() + system.isElevated() et traduit les erreurs
// win32 cryptiques en messages FR actionnables pour le pharmacien.

type SnifferStatus = {
  started: boolean;
  mode: "idle" | "windivert" | "npcap" | "tcp-listen" | "disabled" | string;
  brand: string;
  port: number;
  lastError: string | null;
  lastEan: string | null;
  lastEanAt: string | null;
  triggersSent: number;
  packetsSeen: number;
  npcapAvailable: boolean;
  windivertAvailable: boolean;
  windivertRunning: boolean;
};

type RobotStatus = {
  listener: unknown;
  sniffer: SnifferStatus | null;
};

// Traduit le `lastError` brut du sniffer en explication + remède FR.
function explainError(err: string | null, elevated: boolean | null): { title: string; remedy: string; severity: "error" | "warn" | "info" } {
  if (!err) {
    return { title: "Aucune erreur", remedy: "Le sniffer tourne normalement.", severity: "info" };
  }
  const e = err.toLowerCase();
  if (e.includes("win32=5") || e.includes("access denied") || e.includes("access is denied")) {
    return {
      title: "Asclion n'est pas en administrateur",
      remedy: "WinDivert installe un driver kernel au premier lancement → droits admin obligatoires. Clique sur \"Relancer en admin\" ci-dessous, ou clic droit sur l'icône Asclion → \"Exécuter en tant qu'administrateur\".",
      severity: "error",
    };
  }
  if (e.includes("win32=2") || e.includes("not found") || e.includes(".sys") || e.includes("windivert.dll")) {
    return {
      title: "Binaires WinDivert manquants",
      remedy: "Les fichiers WinDivert.dll + WinDivert64.sys doivent être présents dans resources\\app.asar.unpacked\\native\\windivert\\. Réinstalle Asclion depuis l'installeur le plus récent.",
      severity: "error",
    };
  }
  if (e.includes("npcap")) {
    return {
      title: "Tentative de fallback Npcap (Npcap non installé)",
      remedy: "Pas grave — Npcap n'est PAS requis. Le vrai problème est que WinDivert n'a pas démarré (voir ci-dessus). Corrige WinDivert d'abord.",
      severity: "warn",
    };
  }
  if (e.includes("tls") || e.includes("encrypted")) {
    return {
      title: "Liaison LGO ↔ robot chiffrée (TLS)",
      remedy: "Aucun sniffer ne peut lire du TLS. Utilise le mode TCP-listen (proxy MITM) en reconfigurant l'IP/port du robot dans le LGO pour qu'il pointe vers ce PC.",
      severity: "error",
    };
  }
  if (e.includes("invalid port")) {
    return {
      title: "Port robot invalide ou non configuré",
      remedy: "Va dans Paramètres → Robot et renseigne le port que le LGO utilise pour parler au robot (souvent 8000, 9100, 9200…). Utilise le bouton \"Rechercher le port\" si tu ne sais pas.",
      severity: "error",
    };
  }
  if (e.includes("unknown brand")) {
    return {
      title: "Marque de robot non reconnue",
      remedy: "Va dans Paramètres → Robot et sélectionne la marque (BD Rowa, Mach4, Pharmathek, Tecny-Farma…) ou choisis \"diagnostic\" pour faire un dump brut.",
      severity: "error",
    };
  }
  return {
    title: "Erreur sniffer",
    remedy: `Code brut : ${err}`,
    severity: "warn",
  };
}

const StatusRow = ({
  label,
  ok,
  okText,
  koText,
  hint,
}: {
  label: string;
  ok: boolean | null;
  okText: string;
  koText: string;
  hint?: string;
}) => {
  const Icon = ok === null ? AlertCircle : ok ? CheckCircle2 : XCircle;
  const color = ok === null ? "text-muted-foreground" : ok ? "text-green-600" : "text-destructive";
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{label}</span>
          <Badge variant={ok ? "default" : ok === null ? "secondary" : "destructive"} className="text-[10px]">
            {ok === null ? "Inconnu" : ok ? okText : koText}
          </Badge>
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
};

const RobotSnifferDiagnosticTab = () => {
  const isDesktop = isAsclionDesktopRuntime();
  const electronAPI = (typeof window !== "undefined" ? (window as any).electronAPI : null) as any;

  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!electronAPI?.robot?.status) return;
    setLoading(true);
    try {
      const [s, elev] = await Promise.all([
        electronAPI.robot.status().catch(() => null),
        electronAPI.system?.isElevated?.().catch(() => null) ?? Promise.resolve(null),
      ]);
      setStatus(s as RobotStatus);
      setElevated(typeof elev === "boolean" ? elev : elev?.elevated ?? null);
    } finally {
      setLoading(false);
    }
  }, [electronAPI]);

  useEffect(() => {
    if (!isDesktop) return;
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [isDesktop, refresh]);

  const relaunchAsAdmin = useCallback(async () => {
    try {
      await electronAPI.system.relaunchAsAdmin();
    } catch (e: any) {
      toast.error("Impossible de relancer en admin", { description: e?.message ?? String(e) });
    }
  }, [electronAPI]);

  const runCaptureTest = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    const before = status?.sniffer?.packetsSeen ?? 0;
    toast.info("Test de capture lancé", { description: "Fais un scan / une vente sur la caisse pendant 20 secondes…" });
    await new Promise((r) => setTimeout(r, 20000));
    await refresh();
    const after = (await electronAPI.robot.status())?.sniffer?.packetsSeen ?? before;
    capturingRef.current = false;
    setCapturing(false);
    const delta = after - before;
    if (delta > 0) {
      toast.success(`✅ ${delta} paquet(s) capturé(s)`, { description: "La capture fonctionne. Si aucun EAN n'est extrait, vérifie la marque du robot." });
    } else {
      toast.error("❌ Aucun paquet capturé", { description: "Vérifie : port robot correct, Asclion en admin, et que le LGO a bien envoyé une dispense pendant le test." });
    }
  }, [status, refresh, electronAPI]);

  const sniffer = status?.sniffer ?? null;
  const explanation = useMemo(() => explainError(sniffer?.lastError ?? null, elevated), [sniffer?.lastError, elevated]);

  if (!isDesktop) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Ce diagnostic n'est disponible que dans l'application desktop Asclion (Windows).
          </p>
        </CardContent>
      </Card>
    );
  }

  const modeLabel: Record<string, { label: string; color: string }> = {
    windivert: { label: "WinDivert (optimal)", color: "bg-green-500/10 text-green-700 border-green-500/30" },
    npcap: { label: "Npcap (legacy)", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    "tcp-listen": { label: "TCP-listen (fallback)", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    idle: { label: "Inactif", color: "bg-secondary text-secondary-foreground" },
    disabled: { label: "Désactivé", color: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const mode = sniffer?.mode ?? "idle";
  const modeCfg = modeLabel[mode] ?? { label: mode, color: "bg-secondary" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Diagnostic capture robot (WinDivert)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Vérifie que ce poste peut lire les ordres de dispense envoyés au serveur du robot.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          <StatusRow
            label="Asclion en mode administrateur"
            ok={elevated}
            okText="OK"
            koText="Non — REQUIS"
            hint={elevated === false ? "WinDivert ne peut pas installer son driver sans droits admin." : undefined}
          />
          <Separator />
          <StatusRow
            label="Binaires WinDivert présents"
            ok={sniffer?.windivertAvailable ?? null}
            okText="OK"
            koText="Manquants"
            hint={sniffer?.windivertAvailable === false ? "WinDivert.dll + WinDivert64.sys absents du dossier d'install." : undefined}
          />
          <Separator />
          <StatusRow
            label="Sniffer démarré"
            ok={sniffer?.started ?? null}
            okText="Actif"
            koText="Arrêté"
            hint={`Marque : ${sniffer?.brand ?? "—"} · Port : ${sniffer?.port || "non configuré"}`}
          />
          <Separator />
          <div className="flex items-start gap-3 py-2">
            <Activity className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">Backend de capture actif</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${modeCfg.color}`}>
                  {modeCfg.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paquets vus : <span className="font-mono">{sniffer?.packetsSeen ?? 0}</span> · Triggers envoyés : <span className="font-mono">{sniffer?.triggersSent ?? 0}</span>
                {sniffer?.lastEan && (
                  <> · Dernier EAN : <span className="font-mono">{sniffer.lastEan}</span></>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {sniffer?.lastError && (
        <Card className={
          explanation.severity === "error" ? "border-destructive/40 bg-destructive/5"
          : explanation.severity === "warn" ? "border-amber-400/40 bg-amber-50/50"
          : ""
        }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${explanation.severity === "error" ? "text-destructive" : "text-amber-600"}`} />
              {explanation.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{explanation.remedy}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Voir le code brut</summary>
              <pre className="mt-1 p-2 bg-muted rounded font-mono whitespace-pre-wrap break-all">{sniffer.lastError}</pre>
            </details>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {elevated === false && (
            <Button onClick={relaunchAsAdmin} size="sm" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Relancer Asclion en administrateur
            </Button>
          )}
          <Button onClick={runCaptureTest} size="sm" variant="outline" disabled={capturing || !sniffer?.started} className="gap-1.5">
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {capturing ? "Capture en cours (20s)…" : "Lancer un test de capture (20s)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aide rapide</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• <strong>Npcap n'est PAS requis</strong> — l'app utilise WinDivert (driver Microsoft-signed, embarqué dans l'installeur).</p>
          <p>• Le poste doit être <strong>lancé en administrateur</strong> au moins une fois pour que le driver s'installe.</p>
          <p>• Si la liaison LGO ↔ robot est <strong>chiffrée (TLS)</strong>, aucun sniffer ne fonctionne — bascule sur le mode TCP-listen.</p>
          <p>• <strong>Antivirus managé</strong> (Bitdefender, Sentinel…) : whitelister Asclion.exe + le dossier native\windivert.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RobotSnifferDiagnosticTab;
