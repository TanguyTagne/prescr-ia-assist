import { useState } from "react";
import { useScanQueue, type ScanEvent } from "@/hooks/useScanQueue";
import { X, Wifi, WifiOff, ShoppingCart, FileText, Package, Settings, Copy, Check, Plus, Trash2, Monitor, ScanBarcode } from "lucide-react";
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

      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => onViewResult(scan)}
      >
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
}

export const ScannerStatus = ({ onViewResult }: ScannerStatusProps) => {
  const { latestScan, isListening, pharmacyId, dismissScan } = useScanQueue();
  const [showSetup, setShowSetup] = useState(false);
  const [scannerKeys, setScannerKeys] = useState<ScannerKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

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
    } catch (e) {
      toast.error("Impossible de charger les clés scanner");
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleOpenSetup = () => {
    setShowSetup(true);
    loadKeys();
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
    } catch (e) {
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

  return (
    <div className="space-y-2">
      {/* Connection status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {isListening ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span>Scanner connecté</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Scanner non connecté</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-2"
          onClick={handleOpenSetup}
        >
          <Settings className="h-3 w-3" />
          Configurer
        </Button>
      </div>

      {/* Latest scan notification */}
      {latestScan && latestScan.status === "completed" && (
        <ScanNotification
          scan={latestScan}
          onDismiss={dismissScan}
          onViewResult={onViewResult}
        />
      )}

      {/* Setup dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Connexion Scanner & Caisse
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configurez vos scanners d'ordonnances et caisses enregistreuses pour envoyer automatiquement les données à PrescrIA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                URL du Webhook (à configurer dans votre logiciel)
              </Label>
              <div className="flex gap-1.5">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="text-[11px] font-mono h-8 bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={() => handleCopy(webhookUrl, "url")}
                >
                  {copiedId === "url" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Collez cette URL dans la configuration webhook de votre logiciel de caisse ou scanner.
              </p>
            </div>

            {/* API Keys */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Clés API (x-scanner-key)</Label>

              {!pharmacyId && (
                <p className="text-[11px] text-destructive">
                  Aucune pharmacie associée à votre compte. Contactez un administrateur.
                </p>
              )}

              {pharmacyId && (
                <>
                  {/* Create new key */}
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Nom du scanner (ex: Caisse 1, Scanner comptoir)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1 shrink-0 text-xs"
                      onClick={handleCreateKey}
                      disabled={creatingKey}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Créer
                    </Button>
                  </div>

                  {/* Existing keys */}
                  {loadingKeys ? (
                    <p className="text-[11px] text-muted-foreground">Chargement…</p>
                  ) : scannerKeys.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Aucune clé API. Créez-en une pour connecter un scanner ou une caisse.
                    </p>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteKey(key.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Input
                              readOnly
                              value={key.api_key}
                              className="text-[10px] font-mono h-7 bg-muted"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 shrink-0"
                              onClick={() => handleCopy(key.api_key, key.id)}
                            >
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

            {/* Instructions */}
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold">Guide de connexion rapide</Label>
              <div className="text-[11px] text-muted-foreground space-y-1.5">
                <p><strong>1.</strong> Créez une clé API ci-dessus pour votre appareil.</p>
                <p><strong>2.</strong> Dans votre logiciel de caisse (Winpharma, LGPI, etc.), configurez le webhook avec l'URL ci-dessus.</p>
                <p><strong>3.</strong> Ajoutez le header <code className="bg-muted px-1 rounded text-[10px]">x-scanner-key</code> avec la clé API générée.</p>
                <p><strong>4.</strong> Envoyez un scan test pour vérifier la connexion.</p>
              </div>
              <div className="bg-muted rounded-md p-2">
                <p className="text-[10px] font-semibold mb-1">Exemple d'appel (ordonnance) :</p>
                <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{`POST ${webhookUrl}
Headers: x-scanner-key: VOTRE_CLE
Body: { "type": "prescription", "text": "..." }`}
                </pre>
                <p className="text-[10px] font-semibold mt-2 mb-1">Exemple d'appel (article scanné) :</p>
                <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{`POST ${webhookUrl}
Headers: x-scanner-key: VOTRE_CLE
Body: { "type": "article", "cip_code": "3400935240300" }`}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScannerStatus;
