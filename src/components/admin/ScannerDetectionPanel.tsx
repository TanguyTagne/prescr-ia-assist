import { useCallback, useEffect, useState } from "react";
import {
  Usb,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Plug,
  PlugZap,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  Wifi,
  Clipboard,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

type HidDevice = {
  path: string;
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
  manufacturer: string | null;
  product: string | null;
  usagePage?: number;
  usage?: number;
  interface?: number;
  likelyScanner: boolean;
  bound: boolean;
};

type ScanStatus = {
  mode: "hid-direct" | "uiohook" | "none";
  hidLoaded: boolean;
  hidLoadError: string | null;
  uiohookLoaded: boolean;
  uiohookLoadError: string | null;
  uiohookStarted: boolean;
  bound: {
    vendorId: number;
    productId: number;
    path: string;
    product: string | null;
    manufacturer: string | null;
  } | null;
  lastReportAt: number | null;
  lastEnterAt: number | null;
  lastError: string | null;
  bufferLen: number;
  allowGeneric: boolean;
  // Global keyboard diagnostic (uiohook path)
  lastGlobalKeyAt: number | null;
  globalBufferLen: number;
  lastRejection: { raw: string; reason: string; at: number } | null;
  // Clipboard scanner
  clipboardEnabled: boolean;
  // WebHID flag (always true in Electron, activation depends on scanner mode)
  webHidEnabled?: boolean;
  // Raw Input Win32 subprocess
  rawInputStarted: boolean;
  rawInputError: string | null;
};

type DeviceTestResult = {
  ok: boolean;
  count: number;
  decoded: string;
  barcodeDetected: string | null;
  error?: string;
};

const MODE_BADGE: Record<ScanStatus["mode"], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  "hid-direct": {
    label: "HID direct (optimal)",
    cls: "bg-green-500/10 text-green-700 border-green-500/30",
    icon: CheckCircle2,
  },
  uiohook: {
    label: "Capture clavier (fallback)",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    icon: Activity,
  },
  none: {
    label: "Aucune source active",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    icon: AlertCircle,
  },
};

const formatBytes = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");

const ScannerDetectionPanel = () => {
  const isDesktop = isAsclionDesktopRuntime();
  const api = (typeof window !== "undefined" ? (window.electronAPI as any)?.scanner : null) as {
    list: () => Promise<HidDevice[]>;
    status: () => Promise<ScanStatus>;
    bind: (path: string) => Promise<{ ok: boolean; error?: string }>;
    unbind: () => Promise<{ ok: boolean }>;
    testCapture: (ms: number) => Promise<{ count: number; reports: { at: number; bytes: number[] }[] }>;
    testDevice: (path: string, ms: number) => Promise<DeviceTestResult>;
    setAllowGeneric: (allow: boolean) => Promise<ScanStatus>;
    reload: () => Promise<ScanStatus>;
    requestWebHID: () => Promise<{ ok: boolean; error?: string }>;
    clipboardStart: () => Promise<ScanStatus>;
    clipboardStop: () => Promise<ScanStatus>;
  } | null;

  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [devices, setDevices] = useState<HidDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ count: number; reports: { at: number; bytes: number[] }[] } | null>(
    null,
  );
  const [deviceTesting, setDeviceTesting] = useState<string | null>(null); // path being tested
  const [deviceTestResults, setDeviceTestResults] = useState<Record<string, DeviceTestResult>>({});
  const [togglingGeneric, setTogglingGeneric] = useState(false);
  const [requestingWebHID, setRequestingWebHID] = useState(false);
  const [togglingClipboard, setTogglingClipboard] = useState(false);

  const refresh = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const [s, ds] = await Promise.all([api.status(), api.list()]);
      setStatus(s);
      setDevices(ds);
    } catch (e) {
      console.error("[SCAN-PANEL] refresh failed:", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [api, refresh]);

  const handleBind = async (devicePath: string) => {
    if (!api) return;
    const res = await api.bind(devicePath);
    if (res.ok) toast.success("Douchette liée");
    else toast.error("Échec de liaison", { description: res.error });
    refresh();
  };

  const handleUnbind = async () => {
    if (!api) return;
    await api.unbind();
    toast.message("Liaison supprimée");
    refresh();
  };

  const handleReload = async () => {
    if (!api) return;
    const s = await api.reload();
    setStatus(s);
    toast.message("Pilotes scanner rechargés");
    refresh();
  };

  const handleTest = async () => {
    if (!api) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testCapture(10000);
      setTestResult({ count: res.count, reports: res.reports.slice(-20) });
      if (res.count === 0) {
        toast.error("Aucun rapport HID reçu en 10 s — scannez maintenant pour tester");
      } else {
        toast.success(`${res.count} rapports HID capturés`);
      }
    } catch (e) {
      toast.error("Test échoué", { description: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleTestDevice = async (devicePath: string) => {
    if (!api) return;
    setDeviceTesting(devicePath);
    setDeviceTestResults((prev) => {
      const next = { ...prev };
      delete next[devicePath];
      return next;
    });
    try {
      const res = await api.testDevice(devicePath, 5000);
      setDeviceTestResults((prev) => ({ ...prev, [devicePath]: res }));
      if (!res.ok) {
        toast.error("Impossible d'ouvrir ce périphérique", { description: res.error });
      } else if (res.barcodeDetected) {
        toast.success(`Code-barres détecté : ${res.barcodeDetected}`);
      } else if (res.count === 0) {
        toast.message("Aucun rapport reçu — scannez pendant le test");
      } else {
        toast.message(`${res.count} rapport(s) — "${res.decoded || "—"}" — code non reconnu`);
      }
    } catch (e) {
      toast.error("Test échoué", { description: String(e) });
    } finally {
      setDeviceTesting(null);
    }
  };

  const handleToggleGeneric = async () => {
    if (!api) return;
    setTogglingGeneric(true);
    try {
      const newVal = !(status?.allowGeneric ?? false);
      const s = await api.setAllowGeneric(newVal);
      setStatus(s);
      if (newVal) {
        toast.message("Mode douchette générique activé — tous les claviers HID sont essayés");
      } else {
        toast.message("Mode douchette générique désactivé");
      }
      refresh();
    } catch (e) {
      toast.error("Erreur", { description: String(e) });
    } finally {
      setTogglingGeneric(false);
    }
  };

  const handleRequestWebHID = async () => {
    if (!api) return;
    setRequestingWebHID(true);
    try {
      const res = await api.requestWebHID();
      if (res.ok) {
        toast.success("Demande WebHID envoyée — accordez l'accès dans la fenêtre de sélection si elle apparaît.");
      } else {
        toast.error("Échec WebHID", { description: res.error });
      }
    } catch (e) {
      toast.error("Erreur", { description: String(e) });
    } finally {
      setRequestingWebHID(false);
    }
  };

  const handleToggleClipboard = async () => {
    if (!api) return;
    setTogglingClipboard(true);
    try {
      const isEnabled = status?.clipboardEnabled ?? false;
      const s = isEnabled ? await api.clipboardStop() : await api.clipboardStart();
      setStatus(s);
      if (!isEnabled) {
        toast.message(
          "Surveillance presse-papiers activée — configurez la douchette en mode « keyboard wedge + clipboard »",
        );
      } else {
        toast.message("Surveillance presse-papiers désactivée");
      }
    } catch (e) {
      toast.error("Erreur", { description: String(e) });
    } finally {
      setTogglingClipboard(false);
    }
  };

  if (!isDesktop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Usb className="h-5 w-5 text-primary" />
            Détection matérielle douchette
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            La détection HID directe n'est disponible que sur Asclion Desktop (Electron). En mode navigateur web, la
            lecture passe uniquement par les frappes clavier quand l'onglet a le focus.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!api) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Usb className="h-5 w-5 text-primary" />
            Détection matérielle douchette
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">
            API scanner indisponible — l'application Desktop installée est probablement antérieure à la v1.1. Mettez à
            jour Asclion Desktop pour activer la lecture HID directe.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine effective capture state across all methods
  const hasAnyCapture = !!(status?.mode === "hid-direct" || status?.mode === "uiohook" || status?.rawInputStarted);
  const badge = status ? MODE_BADGE[status.mode] : MODE_BADGE.none;
  const BadgeIcon = badge.icon;
  // Only show the AV banner if NO method is active (not even Raw Input)
  const showAvBanner = !!status && !hasAnyCapture;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Usb className="h-5 w-5 text-primary" />
            Détection matérielle douchette
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-1.5 h-7">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReload} className="gap-1.5 h-7">
              <PlugZap className="h-3.5 w-3.5" />
              Recharger pilotes
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode actif */}
        <div className={`rounded-lg border p-3 ${badge.cls}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BadgeIcon className="h-4 w-4" />
            Mode actif : {badge.label}
          </div>
          {status && (
            <div className="mt-2 text-[11px] space-y-0.5 opacity-90">
              {/* Raw Input Win32 — most robust, shown first */}
              <div className={status.rawInputStarted ? "text-green-700 dark:text-green-400" : ""}>
                Raw Input Win32 :{" "}
                {status.rawInputStarted
                  ? "✓ actif (meilleure méthode — pas un hook)"
                  : status.rawInputError
                    ? `✗ ${status.rawInputError}`
                    : process.platform === "win32" || (window as any).electronAPI?.platform === "win32"
                      ? "démarrage…"
                      : "non-Windows"}
              </div>
              <div>
                HID direct :{" "}
                {status.hidLoaded
                  ? status.bound
                    ? `✓ lié (${status.bound.product || "?"})`
                    : "chargé, aucun scanner lié"
                  : `✗ ${status.hidLoadError || "indisponible"}`}
              </div>
              <div>
                uiohook (hook clavier) :{" "}
                {status.uiohookLoaded
                  ? status.uiohookStarted
                    ? "✓ démarré (peut être bloqué AV)"
                    : "chargé, non démarré"
                  : `✗ ${status.uiohookLoadError || "indisponible"}`}
              </div>
              <div>WebHID : ✓ disponible (nécessite mode HID POS sur la douchette)</div>
              {status.lastReportAt && (
                <div>Dernier rapport HID direct : {new Date(status.lastReportAt).toLocaleTimeString()}</div>
              )}
              {status.lastError && <div className="text-destructive">Erreur HID : {status.lastError}</div>}
            </div>
          )}
          {/* ── Diagnostic clavier global (uiohook) ─────────────────── */}
          {status && (
            <div className="mt-3 border-t border-current/20 pt-2 text-[11px] space-y-0.5">
              <div className="font-semibold mb-1 opacity-80">Diagnostic clavier global</div>
              <div>
                Dernier event clavier :{" "}
                {status.lastGlobalKeyAt ? (
                  new Date(status.lastGlobalKeyAt).toLocaleTimeString()
                ) : (
                  <span className="opacity-60">aucun — douchette non vue</span>
                )}
              </div>
              <div>Buffer global en cours : {status.globalBufferLen ?? 0} car.</div>
              {status.lastRejection ? (
                <div className="text-amber-700 dark:text-amber-400">
                  Dernier rejet : <span className="font-semibold">{status.lastRejection.reason}</span> @{" "}
                  {new Date(status.lastRejection.at).toLocaleTimeString()} —{" "}
                  <code className="font-mono opacity-80">
                    {status.lastRejection.raw.slice(0, 24)}
                    {status.lastRejection.raw.length > 24 ? "…" : ""}
                  </code>
                </div>
              ) : (
                <div className="opacity-60">Aucun rejet enregistré</div>
              )}
              <div className="opacity-60 mt-1">
                Raisons : <em>too_short</em> buffer trop court · <em>cannot_parse</em> code non reconnu ·{" "}
                <em>timeout</em> inter-touches trop lent · <em>key_break</em> touche parasite
              </div>
            </div>
          )}
        </div>

        {showAvBanner && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="font-semibold mb-1">Aucune source de scan active</div>
            <ol className="list-decimal list-inside space-y-0.5 text-destructive/90">
              <li>Vérifiez que la douchette est branchée (port USB).</li>
              <li>
                Si la douchette est en mode <em>USB COM série</em>, reconfigurez-la en <em>USB-HID Keyboard</em> avec le
                code-barres du manuel constructeur.
              </li>
              <li>
                Si rien n'apparaît dans la liste ci-dessous, l'antivirus bloque probablement HIDAPI : ajoutez{" "}
                <code>Asclion.exe</code> et <code>%LOCALAPPDATA%\Programs\asclion-desktop\</code> en exception.
              </li>
            </ol>
          </div>
        )}

        {/* ── WebHID (HID POS mode) ─────────────────────────────────── */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-[11px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-semibold text-blue-700 dark:text-blue-400">WebHID — mode HID POS</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 shrink-0 border-blue-500/40 text-blue-700 hover:bg-blue-500/10"
              onClick={handleRequestWebHID}
              disabled={requestingWebHID}
            >
              {requestingWebHID ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              Autoriser WebHID
            </Button>
          </div>
          <div className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Sans antivirus, sans focus, sans hook clavier.</strong> Fonctionne
            uniquement si la douchette est en mode <em>HID POS (usage page 0x8C)</em>. La plupart des douchettes bon
            marché sortent d'usine en mode <em>USB Keyboard</em> — scannez le code-barres « HID POS » ou « USB-COM » du
            manuel constructeur pour basculer.
          </div>
          <details className="text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground/80">
              Comment passer ma douchette en mode HID POS ?
            </summary>
            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-blue-300/40">
              <div>
                <strong>Honeywell / Metrologic</strong> : scanner le code « USB HID POS » dans le guide d'installation
                rapide (généralement page 3-2).
              </div>
              <div>
                <strong>Zebra / Symbol</strong> : scanner « USB HID POS Bar Code Scanner » dans le manuel de référence
                (section Interface).
              </div>
              <div>
                <strong>Datalogic</strong> : scanner le code « USB COM Port Emulation » ou « USB HID POS » selon le
                modèle (manuel Aladdin/Heron).
              </div>
              <div>
                <strong>Newland / OEM chinois</strong> : scanner « USB-HID » puis « HID-POS » dans le livret de
                configuration inclus dans la boîte.
              </div>
              <div className="text-[10px] opacity-70 mt-1">
                Après le passage en mode HID POS, cliquez « Autoriser WebHID » puis scannez un code pour vérifier. Pour
                revenir au mode clavier : scanner le code « USB Keyboard » du même manuel.
              </div>
            </div>
          </details>
        </div>

        {/* ── Clipboard scanner ─────────────────────────────────────── */}
        <div
          className={`rounded-lg border p-3 text-[11px] ${status?.clipboardEnabled ? "border-purple-500/40 bg-purple-500/5" : "border-border bg-muted/30"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Clipboard
                className={`h-3.5 w-3.5 ${status?.clipboardEnabled ? "text-purple-600" : "text-muted-foreground"}`}
              />
              <span
                className={`font-semibold ${status?.clipboardEnabled ? "text-purple-700 dark:text-purple-400" : ""}`}
              >
                Surveillance presse-papiers
              </span>
            </div>
            <Button
              variant={status?.clipboardEnabled ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 shrink-0"
              onClick={handleToggleClipboard}
              disabled={togglingClipboard}
            >
              {togglingClipboard ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : status?.clipboardEnabled ? (
                <ToggleRight className="h-3.5 w-3.5" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5" />
              )}
              {status?.clipboardEnabled ? "Activé" : "Désactivé"}
            </Button>
          </div>
          <div className="mt-1.5 text-muted-foreground">
            Asclion surveille le presse-papiers toutes les 120 ms. Utile si la douchette est configurée en{" "}
            <em>keyboard wedge + clipboard</em> — le code scanné est copié dans le presse-papiers <strong>avant</strong>{" "}
            d'être tapé dans le LGO. Méthode 100 % AV-safe, sans driver, sans focus.
          </div>
          {status?.clipboardEnabled && (
            <div className="mt-1.5 text-purple-700 dark:text-purple-400 font-medium">
              ✓ Surveillance active — tout code-barres copié dans le presse-papiers déclenchera une recherche Asclion.
            </div>
          )}
          {!status?.clipboardEnabled && (
            <div className="mt-1 text-muted-foreground text-[10px]">
              Configuration douchette requise : cherchez « clipboard mode » ou « prefix/suffix » dans le manuel
              constructeur.
            </div>
          )}
        </div>

        {/* Mode douchette générique */}
        <div
          className={`rounded-lg border p-3 text-[11px] ${status?.allowGeneric ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/30"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold">Mode douchette générique</span>
              <span className="text-muted-foreground ml-1.5">
                — essaie tous les claviers USB HID si aucun scanner reconnu
              </span>
            </div>
            <Button
              variant={status?.allowGeneric ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 shrink-0"
              onClick={handleToggleGeneric}
              disabled={togglingGeneric}
            >
              {togglingGeneric ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : status?.allowGeneric ? (
                <ToggleRight className="h-3.5 w-3.5" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5" />
              )}
              {status?.allowGeneric ? "Activé" : "Désactivé"}
            </Button>
          </div>
          {status?.allowGeneric && (
            <div className="mt-1.5 text-amber-700 dark:text-amber-400">
              ⚠ Tous les claviers USB sont lus. Désactivez si vous constatez des faux positifs lors de la saisie au
              clavier.
            </div>
          )}
          {!status?.allowGeneric && (
            <div className="mt-1 text-muted-foreground">
              Activez si votre douchette apparaît comme "USB Keyboard" et n'est pas détectée automatiquement.
            </div>
          )}
        </div>

        {/* Liste des périphériques HID */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            <span>Périphériques HID détectés ({devices.length})</span>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="h-7 gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Tester 10 s (scanner lié)
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Cliquez sur <strong>Tester 5 s</strong> à côté de chaque périphérique, puis scannez un code : le résultat
            identifie votre douchette.
          </p>
          {devices.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun périphérique HID détecté.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-semibold">Produit</th>
                      <th className="text-left px-2 py-1.5 font-semibold font-mono whitespace-nowrap">VID:PID</th>
                      <th className="text-left px-2 py-1.5 font-semibold">Usage</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => {
                      const testRes = deviceTestResults[d.path];
                      const isTesting = deviceTesting === d.path;
                      return (
                        <>
                          <tr key={d.path} className={`border-t border-border ${d.bound ? "bg-primary/5" : ""}`}>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                {d.likelyScanner && (
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                    scanner
                                  </Badge>
                                )}
                                {d.bound && <Badge className="h-4 px-1 text-[9px]">lié</Badge>}
                                <span className="truncate">
                                  {d.product || <em className="text-muted-foreground">Sans nom</em>}
                                </span>
                              </div>
                              {d.manufacturer && (
                                <div className="text-[10px] text-muted-foreground">{d.manufacturer}</div>
                              )}
                            </td>
                            <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                              {d.vendorIdHex.slice(2)}:{d.productIdHex.slice(2)}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {d.usagePage}/{d.usage}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] gap-1"
                                  onClick={() => handleTestDevice(d.path)}
                                  disabled={isTesting || !!deviceTesting}
                                  title="Tester ce périphérique 5 s sans le lier"
                                >
                                  {isTesting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <FlaskConical className="h-3 w-3" />
                                  )}
                                  {isTesting ? "Test…" : "Test 5s"}
                                </Button>
                                {d.bound ? (
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleUnbind}>
                                    Délier
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] gap-1"
                                    onClick={() => handleBind(d.path)}
                                  >
                                    <Plug className="h-3 w-3" />
                                    Lier
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {testRes && (
                            <tr
                              key={`${d.path}-result`}
                              className="border-t border-dashed border-primary/20 bg-primary/3"
                            >
                              <td colSpan={4} className="px-3 py-2">
                                {!testRes.ok ? (
                                  <span className="text-destructive font-semibold text-[10px]">
                                    ✗ Impossible d'ouvrir — {testRes.error}
                                  </span>
                                ) : testRes.barcodeDetected ? (
                                  <span className="text-green-700 font-semibold text-[10px]">
                                    ✓ Code-barres détecté : <code>{testRes.barcodeDetected}</code> — c'est votre
                                    douchette → cliquez Lier
                                  </span>
                                ) : testRes.count > 0 ? (
                                  <span className="text-amber-700 text-[10px]">
                                    ⚠ {testRes.count} rapport(s) reçu(s) — chars décodés : "
                                    <code>{testRes.decoded || "—"}</code>" — code non reconnu
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">
                                    Périphérique ouvert, aucun rapport reçu en 5 s — scannez pendant le test
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {testResult && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Test HID brut — {testResult.count} rapports
            </div>
            {testResult.reports.length === 0 ? (
              <p className="text-xs text-destructive">
                Aucun rapport reçu pendant 10 s. Si vous avez scanné : la douchette n'est pas lue par HID direct (mode
                COM série, ou périphérique pas dans la liste ci-dessus).
              </p>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-2 max-h-[180px] overflow-y-auto font-mono text-[10px] space-y-0.5">
                {testResult.reports.map((r, i) => (
                  <div key={i}>
                    <span className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</span>{" "}
                    {formatBytes(r.bytes)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScannerDetectionPanel;
