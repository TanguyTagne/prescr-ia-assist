import { useEffect, useState } from "react";
import { useScanQueue, type ScanEvent } from "@/hooks/useScanQueue";
import { useFolderWatcher } from "@/hooks/useFolderWatcher";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { SCANNER } from "@/constants/scanner";
import {
  X, Wifi, WifiOff, ShoppingCart, FileText, Package,
  Settings, Check, Key,
  FolderSearch, Loader2, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
        <button
          onClick={onDismiss}
          aria-label="Fermer la notification de scan"
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
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

      <Button size="sm" className="w-full h-7 text-xs" onClick={() => onViewResult(scan)}>
        Voir les détails
      </Button>
    </div>
  );
};

type RobotBrand = "none" | "rowa" | "pharmathek" | "generic" | "diagnostic";
interface RobotConfigForm {
  enabled: boolean;
  brand: RobotBrand;
  port: number;
  regex: string;
  useNpcap: boolean;
  httpPort: number;
}

const ROBOT_BRAND_LABELS: Record<RobotBrand, string> = {
  none: "Aucun",
  rowa: "Rowa / BD Rowa",
  pharmathek: "Pharmathek",
  generic: "Générique (regex)",
  diagnostic: "Diagnostic (capture)",
};

interface ScannerStatusProps {
  onViewResult: (scan: ScanEvent) => void;
  onNewFile: (file: File) => void;
  onBarcodeScan: (code: string) => void;
}

export const ScannerStatus = ({ onViewResult, onNewFile, onBarcodeScan }: ScannerStatusProps) => {
  const { latestScan, isListening, pharmacyId, dismissScan } = useScanQueue();
  const { signOut } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [lgoForm, setLgoForm] = useState({ lgo_type: "winpharma", api_base_url: "", api_key: "" });
  const [lgoSaving, setLgoSaving] = useState(false);
  const [lgoLoaded, setLgoLoaded] = useState(false);
  const [lgoConnected, setLgoConnected] = useState(false);
  const [adminMode, setAdminMode] = useState<"unknown" | "admin" | "user" | "web">("unknown");
  const [adminActivating, setAdminActivating] = useState(false);
  const [activationScriptPath, setActivationScriptPath] = useState<string | null>(null);
  const [robotForm, setRobotForm] = useState<RobotConfigForm>({
    enabled: false,
    brand: "none",
    port: 9876,
    regex: "EAN>(\\d{8,14})<",
    useNpcap: true,
    httpPort: 5150,
  });
  const [robotSaving, setRobotSaving] = useState(false);
  const [robotLoaded, setRobotLoaded] = useState(false);
  const [robotStatus, setRobotStatus] = useState<{ listening?: boolean; mode?: string; lastEan?: string | null } | null>(null);

  const isFolderApiSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
  const isDesktopRuntime = typeof window !== "undefined" && !!(window as any).electronAPI?.isDesktop;

  useEffect(() => {
    if (!isDesktopRuntime) {
      setAdminMode("web");
      return;
    }
    let cancelled = false;
    const refreshAdminMode = async () => {
      try {
        const result = await (window as any).electronAPI?.system?.isElevated?.();
        if (!cancelled) setAdminMode(result?.elevated ? "admin" : "user");
      } catch {
        if (!cancelled) setAdminMode("unknown");
      }
    };
    refreshAdminMode();
    const timer = setInterval(refreshAdminMode, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isDesktopRuntime]);

  const handleActivateAdmin = async () => {
    const api = (window as any).electronAPI?.autolaunch;
    if (!api?.reinstall) return;
    setAdminActivating(true);
    try {
      const result = await api.reinstall();
      const scriptPath = result?.repair?.scriptPath || result?.state?.activationScript?.path || null;
      setActivationScriptPath(scriptPath);
      toast.success("Activation admin lancée", {
        description: scriptPath
          ? "Cliquez Oui dans Windows. Si rien n’apparaît, ouvrez le script affiché sur le Bureau."
          : "Cliquez Oui dans la fenêtre Windows, puis laissez Asclion se relancer.",
      });
    } catch (err: any) {
      toast.error("Activation admin impossible", { description: String(err?.message || err).slice(0, 180) });
    } finally {
      setAdminActivating(false);
    }
  };

  const handleOpenAdminScript = async () => {
    const api = (window as any).electronAPI?.autolaunch;
    if (!api?.openAdminScript && !api?.createAdminScript) return;
    try {
      const result = api.openAdminScript ? await api.openAdminScript() : await api.createAdminScript();
      if (result?.path) setActivationScriptPath(result.path);
      toast.success("Script d’activation ouvert", {
        description: "Faites clic droit dessus, puis Exécuter en tant qu’administrateur si la fenêtre Windows ne s’ouvre pas.",
      });
    } catch (err: any) {
      toast.error("Impossible d’ouvrir le script", { description: String(err?.message || err).slice(0, 180) });
    }
  };

  // Folder watcher for document scanner
  const { isWatching, folderName, startWatching, stopWatching } = useFolderWatcher({
    onNewFile,
  });

  // HID barcode scanner detection (keyboard path — used on web and when Electron
  // global hook is unavailable). We dispatch SCANNER.DOM_EVENT in addition to
  // invoking onBarcodeScan so AnalysisResults' auto-attribution listener also
  // sees the scan (it only listens to the DOM event). Widget's dedup window
  // (SCANNER.DEDUP_WINDOW_MS) absorbs the resulting double-fire.
  useBarcodeScanner({
    onScan: (code) => {
      try {
        window.dispatchEvent(
          new CustomEvent(SCANNER.DOM_EVENT, { detail: { ean: code, at: Date.now() } }),
        );
      } catch {
        /* noop */
      }
      onBarcodeScan(code);
    },
    enabled: true,
  });

  const robotApi = (typeof window !== "undefined" ? (window as any).electronAPI?.robot : null);

  const loadRobotConfig = async () => {
    if (!robotApi) {
      // Web build — robot config only exists in the Electron desktop runtime.
      setRobotLoaded(true);
      return;
    }
    try {
      const cfg = await robotApi.getConfig();
      if (cfg && cfg.robot) {
        setRobotForm({
          enabled: !!cfg.robot.enabled,
          brand: (cfg.robot.brand || "none") as RobotBrand,
          port: Number(cfg.robot.port) || 9876,
          regex: cfg.robot.regex || "EAN>(\\d{8,14})<",
          useNpcap: cfg.robot.useNpcap !== false,
          httpPort: Number(cfg.httpPort) || 5150,
        });
      }
      const st = await robotApi.status();
      setRobotStatus({
        listening: st?.listener?.listening,
        mode: st?.sniffer?.mode,
        lastEan: st?.sniffer?.lastEan ?? null,
      });
    } catch {
      /* ignore — UI degrades silently */
    } finally {
      setRobotLoaded(true);
    }
  };

  const handleSaveRobot = async () => {
    if (!robotApi) {
      toast.error("La configuration robot n'est disponible que dans l'application desktop Asclion.");
      return;
    }
    setRobotSaving(true);
    try {
      const res = await robotApi.setConfig({
        httpPort: robotForm.httpPort,
        robot: {
          enabled: robotForm.enabled,
          brand: robotForm.brand,
          port: robotForm.port,
          regex: robotForm.regex,
          useNpcap: robotForm.useNpcap,
        },
      });
      if (!res?.ok) {
        toast.error("Échec de la sauvegarde", { description: res?.error || "Erreur inconnue" });
        return;
      }
      toast.success("Configuration robot enregistrée");
      const st = await robotApi.status();
      setRobotStatus({
        listening: st?.listener?.listening,
        mode: st?.sniffer?.mode,
        lastEan: st?.sniffer?.lastEan ?? null,
      });
    } catch (err: any) {
      toast.error("Erreur", { description: String(err?.message || err).slice(0, 180) });
    } finally {
      setRobotSaving(false);
    }
  };

  const loadLgoConfig = async () => {
    if (!pharmacyId || lgoLoaded) return;
    try {
      const { data } = await supabase
        .from("pharmacy_lgo_config")
        .select("id, lgo_type, api_base_url, enabled, pharmacy_id")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();
      if (data) {
        setLgoForm({ lgo_type: data.lgo_type || "winpharma", api_base_url: data.api_base_url || "", api_key: "" });
        setLgoConnected(data.enabled);
      }
      setLgoLoaded(true);
    } catch { /* ignore */ }
  };

  const handleSaveLgo = async () => {
    if (!pharmacyId) return;
    setLgoSaving(true);
    try {
      const { data: existing } = await supabase
        .from("pharmacy_lgo_config")
        .select("id")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      if (existing) {
        const updateData: any = {
          lgo_type: lgoForm.lgo_type,
          api_base_url: lgoForm.api_base_url,
          updated_at: new Date().toISOString(),
        };
        if (lgoForm.api_key) updateData.api_key = lgoForm.api_key;
        await supabase.from("pharmacy_lgo_config").update(updateData).eq("id", existing.id);
      } else {
        await supabase.from("pharmacy_lgo_config").insert({
          pharmacy_id: pharmacyId,
          lgo_type: lgoForm.lgo_type,
          api_base_url: lgoForm.api_base_url,
          api_key: lgoForm.api_key || null,
        });
      }
      setLgoConnected(true);
      setLgoForm(f => ({ ...f, api_key: "" }));
      toast.success("Configuration LGO enregistrée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setLgoSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Scanner status bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Folder watcher status */}
          {isWatching ? (
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="relative">
                <FolderSearch className="h-3 w-3 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <span className="text-foreground font-medium truncate">Scanner actif — {folderName}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[11px] text-muted-foreground"
                onClick={stopWatching}
                aria-label="Arrêter la surveillance du dossier scanner"
              >
                Stop
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {isListening ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>Scanner prêt</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Connect scanner button (folder picker) */}
          {isFolderApiSupported && !isWatching && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={startWatching}
            >
              <FolderSearch className="h-3 w-3" />
              Connecter scanner
            </Button>
          )}
          {/* Paramètres */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
            onClick={() => { setShowSetup(true); loadRobotConfig(); loadLgoConfig(); }}
            aria-label="Paramètres Asclion"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>


      {/* Latest scan notification */}
      {latestScan && latestScan.status === "completed" && (
        <ScanNotification scan={latestScan} onDismiss={dismissScan} onViewResult={onViewResult} />
      )}

      {/* Paramètres */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-primary" />
              Paramètres
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configuration du robot automate, du LGO et du poste.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Bloc 1 — Robot automate */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Robot automate
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Si la pharmacie est équipée d'un robot (Rowa, Pharmathek…), Asclion intercepte les délivrances pour suggérer les compléments. Sélectionnez "Aucun" sinon.
              </p>
              {!robotApi ? (
                <p className="text-[11px] text-destructive">
                  Disponible uniquement dans l'application desktop Asclion (pas dans le navigateur).
                </p>
              ) : (
                <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Ce PC est le serveur robot</Label>
                    <input
                      type="checkbox"
                      checked={robotForm.enabled}
                      onChange={(e) => setRobotForm((f) => ({ ...f, enabled: e.target.checked }))}
                      aria-label="Activer le mode serveur robot sur ce poste"
                      className="h-4 w-4 accent-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Marque</Label>
                      <select
                        value={robotForm.brand}
                        onChange={(e) => setRobotForm((f) => ({ ...f, brand: e.target.value as RobotBrand }))}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                        aria-label="Marque du robot automate"
                      >
                        {(Object.keys(ROBOT_BRAND_LABELS) as RobotBrand[]).map((b) => (
                          <option key={b} value={b}>{ROBOT_BRAND_LABELS[b]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Port TCP du robot</Label>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        value={robotForm.port}
                        onChange={(e) => setRobotForm((f) => ({ ...f, port: Number(e.target.value) || 0 }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {robotForm.brand === "generic" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Pattern regex (1<sup>er</sup> groupe = EAN)
                      </Label>
                      <Input
                        value={robotForm.regex}
                        onChange={(e) => setRobotForm((f) => ({ ...f, regex: e.target.value }))}
                        placeholder="EAN>(\d{8,14})<"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Port HTTP (listener local)</Label>
                      <Input
                        type="number"
                        min={1024}
                        max={65535}
                        value={robotForm.httpPort}
                        onChange={(e) => setRobotForm((f) => ({ ...f, httpPort: Number(e.target.value) || 0 }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <Label className="text-[10px] text-muted-foreground">Sniffer Npcap (passif)</Label>
                      <input
                        type="checkbox"
                        checked={robotForm.useNpcap}
                        onChange={(e) => setRobotForm((f) => ({ ...f, useNpcap: e.target.checked }))}
                        aria-label="Utiliser Npcap en mode sniffer passif si disponible"
                        className="h-4 w-4 accent-primary mb-1.5"
                      />
                    </div>
                  </div>

                  {robotStatus && (
                    <p className="text-[10px] text-muted-foreground">
                      Listener : {robotStatus.listening ? "actif" : "inactif"} ·
                      Sniffer : {robotStatus.mode || "idle"}
                      {robotStatus.lastEan ? ` · dernier EAN : ${robotStatus.lastEan}` : ""}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={handleSaveRobot}
                    disabled={robotSaving || !robotLoaded}
                  >
                    {robotSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Enregistrer
                  </Button>
                </div>
              )}
            </div>

            {/* Bloc 2 — Connexion LGO / Stocks (conservé tel quel) */}
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Connexion LGO — Stocks
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Connectez votre Logiciel de Gestion d'Officine pour synchroniser les stocks et enrichir les suggestions.
              </p>
              {!pharmacyId ? (
                <p className="text-[11px] text-destructive">Aucune pharmacie associée à votre compte.</p>
              ) : (
                <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
                  {lgoConnected && (
                    <Badge className="bg-primary/20 text-primary text-[10px] mb-1">
                      <Check className="h-2.5 w-2.5 mr-0.5" />
                      LGO connecté
                    </Badge>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Type de LGO</Label>
                      <select
                        value={lgoForm.lgo_type}
                        onChange={e => setLgoForm(f => ({ ...f, lgo_type: e.target.value }))}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                      >
                        <option value="winpharma">Winpharma</option>
                        <option value="lgpi">LGPI</option>
                        <option value="pharmagest">Pharmagest</option>
                        <option value="leo">Léo</option>
                        <option value="smart_rx">Smart Rx</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">URL API</Label>
                      <Input
                        placeholder="https://api.monlgo.fr/v1"
                        value={lgoForm.api_base_url}
                        onChange={e => setLgoForm(f => ({ ...f, api_base_url: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Clé API du LGO</Label>
                    <Input
                      type="password"
                      placeholder={lgoConnected ? "••••••• (laisser vide pour ne pas changer)" : "Entrez votre clé API"}
                      value={lgoForm.api_key}
                      onChange={e => setLgoForm(f => ({ ...f, api_key: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={handleSaveLgo}
                    disabled={lgoSaving || !lgoForm.api_base_url}
                  >
                    {lgoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {lgoConnected ? "Mettre à jour" : "Connecter le LGO"}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void signOut()}
                className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <X className="h-4 w-4" />
                Se déconnecter de ce poste
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Les autres postes de l'officine restent connectés au même compte pharmacie.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScannerStatus;
