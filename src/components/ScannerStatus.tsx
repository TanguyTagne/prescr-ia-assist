import { useState, useCallback } from "react";
import { useScanQueue, type ScanEvent } from "@/hooks/useScanQueue";
import { useFolderWatcher } from "@/hooks/useFolderWatcher";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  X, Wifi, WifiOff, ShoppingCart, FileText, Package,
  Settings, Copy, Check, Plus, Trash2, Monitor, ScanBarcode,
  FolderSearch, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
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

interface ScannerKey {
  id: string;
  api_key: string;
  label: string | null;
  active: boolean;
  created_at: string;
}

interface ScannerStatusProps {
  onViewResult: (scan: ScanEvent) => void;
  onNewFile: (file: File) => void;
  onBarcodeScan: (code: string) => void;
}

export const ScannerStatus = ({ onViewResult, onNewFile, onBarcodeScan }: ScannerStatusProps) => {
  const { latestScan, isListening, pharmacyId, dismissScan } = useScanQueue();
  const [showSetup, setShowSetup] = useState(false);
  const [scannerKeys, setScannerKeys] = useState<ScannerKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [lgoForm, setLgoForm] = useState({ lgo_type: "winpharma", api_base_url: "", api_key: "" });
  const [lgoSaving, setLgoSaving] = useState(false);
  const [lgoLoaded, setLgoLoaded] = useState(false);
  const [lgoConnected, setLgoConnected] = useState(false);

  const isFolderApiSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

  // Folder watcher for document scanner
  const { isWatching, folderName, startWatching, stopWatching } = useFolderWatcher({
    onNewFile,
  });

  // HID barcode scanner detection
  useBarcodeScanner({
    onScan: onBarcodeScan,
    enabled: true,
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scanner-webhook`;

  const loadKeys = async () => {
    if (!pharmacyId) return;
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from("pharmacy_scanner_keys")
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setScannerKeys((data as ScannerKey[]) || []);
    } catch {
      toast.error("Impossible de charger les clés scanner");
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCreateKey = async () => {
    if (!pharmacyId) return;
    setCreatingKey(true);
    try {
      const { data, error } = await supabase
        .from("pharmacy_scanner_keys")
        .insert({ pharmacy_id: pharmacyId, label: newLabel || "Scanner principal" })
        .select()
        .single();
      if (error) throw error;
      setScannerKeys((prev) => [data as ScannerKey, ...prev]);
      setNewLabel("");
      toast.success("Clé API créée !");
    } catch {
      toast.error("Erreur lors de la création de la clé");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const { error } = await supabase.from("pharmacy_scanner_keys").delete().eq("id", id);
      if (error) throw error;
      setScannerKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Clé supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadLgoConfig = async () => {
    if (!pharmacyId || lgoLoaded) return;
    try {
      const { data } = await supabase
        .from("pharmacy_lgo_config")
        .select("*")
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
        if (lgoForm.api_key) updateData.api_key_encrypted = lgoForm.api_key;
        await supabase.from("pharmacy_lgo_config").update(updateData).eq("id", existing.id);
      } else {
        await supabase.from("pharmacy_lgo_config").insert({
          pharmacy_id: pharmacyId,
          lgo_type: lgoForm.lgo_type,
          api_base_url: lgoForm.api_base_url,
          api_key_encrypted: lgoForm.api_key || null,
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
                className="h-5 px-1.5 text-[9px] text-muted-foreground"
                onClick={stopWatching}
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
          {/* Advanced config */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
            onClick={() => { setShowSetup(true); loadKeys(); loadLgoConfig(); }}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Latest scan notification */}
      {latestScan && latestScan.status === "completed" && (
        <ScanNotification scan={latestScan} onDismiss={dismissScan} onViewResult={onViewResult} />
      )}

      {/* Advanced setup dialog (webhook/API keys for POS systems) */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Configuration avancée — Caisse
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pour connecter un logiciel de caisse (Winpharma, LGPI…) via API webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                URL du Webhook
              </Label>
              <div className="flex gap-1.5">
                <Input readOnly value={webhookUrl} className="text-[11px] font-mono h-8 bg-muted" />
                <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={() => handleCopy(webhookUrl, "url")}>
                  {copiedId === "url" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* API Keys */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Clés API (x-scanner-key)</Label>
              {!pharmacyId ? (
                <p className="text-[11px] text-destructive">Aucune pharmacie associée à votre compte.</p>
              ) : (
                <>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Nom (ex: Caisse 1)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Button size="sm" className="h-8 gap-1 shrink-0 text-xs" onClick={handleCreateKey} disabled={creatingKey}>
                      <Plus className="h-3.5 w-3.5" />
                      Créer
                    </Button>
                  </div>
                  {loadingKeys ? (
                    <p className="text-[11px] text-muted-foreground">Chargement…</p>
                  ) : scannerKeys.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Aucune clé API.</p>
                  ) : (
                    <div className="space-y-2">
                      {scannerKeys.map((key) => (
                        <div key={key.id} className="border rounded-md p-2 space-y-1.5 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{key.label || "Sans nom"}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant={key.active ? "default" : "secondary"} className="text-[9px] h-4">
                                {key.active ? "Actif" : "Inactif"}
                              </Badge>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteKey(key.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Input readOnly value={key.api_key} className="text-[10px] font-mono h-7 bg-muted" />
                            <Button variant="outline" size="sm" className="h-7 px-2 shrink-0" onClick={() => handleCopy(key.api_key, key.id)}>
                              {copiedId === key.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

            {/* LGO Integration */}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScannerStatus;
