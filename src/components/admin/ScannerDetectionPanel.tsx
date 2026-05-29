import { useCallback, useEffect, useState } from "react";
import { Usb, RefreshCw, Loader2, CheckCircle2, AlertCircle, Activity, Plug, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

const MODE_BADGE: Record<ScannerStatus["mode"], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  "hid-direct": { label: "HID direct (optimal)", cls: "bg-green-500/10 text-green-700 border-green-500/30", icon: CheckCircle2 },
  "uiohook":    { label: "Capture clavier (fallback)", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: Activity },
  "none":       { label: "Aucune source active", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
};

const formatBytes = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");

const ScannerDetectionPanel = () => {
  const isDesktop = isAsclionDesktopRuntime();
  const api = (typeof window !== "undefined" ? window.electronAPI?.scanner : null) ?? null;

  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [devices, setDevices] = useState<HidDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ count: number; reports: { at: number; bytes: number[] }[] } | null>(null);

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
            La détection HID directe n'est disponible que sur Asclion Desktop (Electron).
            En mode navigateur web, la lecture passe uniquement par les frappes clavier
            quand l'onglet a le focus.
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
            API scanner indisponible — l'application Desktop installée est probablement antérieure
            à la v1.1. Mettez à jour Asclion Desktop pour activer la lecture HID directe.
          </p>
        </CardContent>
      </Card>
    );
  }

  const badge = status ? MODE_BADGE[status.mode] : MODE_BADGE.none;
  const BadgeIcon = badge.icon;
  const showAvBanner = status?.mode === "none";

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
              <div>HID direct : {status.hidLoaded ? "✓ chargé" : `✗ ${status.hidLoadError || "indisponible"}`}</div>
              <div>uiohook (fallback) : {status.uiohookLoaded ? (status.uiohookStarted ? "✓ démarré" : "chargé, non démarré") : `✗ ${status.uiohookLoadError || "indisponible"}`}</div>
              {status.bound && (
                <div>
                  Douchette liée : <strong>{status.bound.product || "Sans nom"}</strong>{" "}
                  ({status.bound.vendorId.toString(16)}:{status.bound.productId.toString(16)})
                </div>
              )}
              {status.lastReportAt && (
                <div>Dernier rapport HID : {new Date(status.lastReportAt).toLocaleTimeString()}</div>
              )}
              {status.lastError && <div className="text-destructive">Erreur : {status.lastError}</div>}
            </div>
          )}
        </div>

        {showAvBanner && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="font-semibold mb-1">Aucune source de scan active</div>
            <ol className="list-decimal list-inside space-y-0.5 text-destructive/90">
              <li>Vérifiez que la douchette est branchée (port USB).</li>
              <li>Si la douchette est en mode <em>USB COM série</em>, reconfigurez-la en <em>USB-HID Keyboard</em> avec le code-barres du manuel constructeur.</li>
              <li>Si rien n'apparaît dans la liste ci-dessous, l'antivirus bloque probablement HIDAPI : ajoutez <code>Asclion.exe</code> et <code>%LOCALAPPDATA%\Programs\asclion-desktop\</code> en exception.</li>
            </ol>
          </div>
        )}

        {/* Liste des périphériques HID */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            <span>Périphériques HID détectés ({devices.length})</span>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="h-7 gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Tester 10 s (scanner brut)
            </Button>
          </div>
          {devices.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun périphérique HID détecté.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-semibold">Produit</th>
                      <th className="text-left px-2 py-1.5 font-semibold font-mono whitespace-nowrap">VID:PID</th>
                      <th className="text-left px-2 py-1.5 font-semibold">Usage</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.path} className={`border-t border-border ${d.bound ? "bg-primary/5" : ""}`}>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {d.likelyScanner && <Badge variant="secondary" className="h-4 px-1 text-[9px]">scanner</Badge>}
                            {d.bound && <Badge className="h-4 px-1 text-[9px]">lié</Badge>}
                            <span className="truncate">{d.product || <em className="text-muted-foreground">Sans nom</em>}</span>
                          </div>
                          {d.manufacturer && <div className="text-[10px] text-muted-foreground">{d.manufacturer}</div>}
                        </td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                          {d.vendorIdHex.slice(2)}:{d.productIdHex.slice(2)}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {d.usagePage}/{d.usage}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {d.bound ? (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleUnbind}>
                              Délier
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleBind(d.path)}>
                              <Plug className="h-3 w-3" />
                              Lier
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
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
                Aucun rapport reçu pendant 10 s. Si vous avez scanné : la douchette n'est pas lue par HID direct
                (mode COM série, ou périphérique pas dans la liste ci-dessus).
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
