import { useState, useEffect, useCallback } from "react";
import { Pill, Loader2, BarChart3, LogOut, Download, ShieldX, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PrescriptionInput from "@/components/PrescriptionInput";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { analyzePrescription, analyzePrescriptionImage, type AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ScannerStatus } from "@/components/ScannerStatus";
import { pdfToImageBase64 } from "@/lib/pdfToImage";
import { supabase } from "@/integrations/supabase/client";
import type { ScanEvent } from "@/hooks/useScanQueue";
import RegisterSelector from "@/components/RegisterSelector";
import SoundToggle from "@/components/SoundToggle";
import { notifyAnalysisDone } from "@/lib/notifyAnalysisDone";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PUBLISHED_URL = "https://prescr-ia-assist.lovable.app";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const { user, signOut, isAdmin, pharmacyStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installed = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        toast.success("Asclion installée !");
      }
    } else {
      window.open(PUBLISHED_URL, "_blank");
      toast.info("Ouvrez le lien dans Chrome ou Edge puis cliquez sur « Installer » dans la barre d'adresse.");
    }
  };

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    const start = Date.now();
    try {
      const analysis = await analyzePrescription(text);
      const responseTime = Date.now() - start;
      setResult(analysis);
      notifyAnalysisDone({ count: analysis.medicaments.length });
      trackEvent("ordonnance_analyzed", { input_type: "text", response_time: responseTime, medicaments: analysis.medicaments.map(m => m.nom) });
      trackEvent("widget_shown", {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    const start = Date.now();
    try {
      const analysis = await analyzePrescriptionImage(imageBase64);
      const responseTime = Date.now() - start;
      setResult(analysis);
      notifyAnalysisDone({ count: analysis.medicaments.length });
      trackEvent("ordonnance_analyzed", { input_type: "image", response_time: responseTime, medicaments: analysis.medicaments.map(m => m.nom) });
      trackEvent("widget_shown", {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse OCR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => setResult(null);

  // Auto-detect scanned files from folder watcher
  const handleNewFile = useCallback(async (file: File) => {
    // Notification sound
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}

    toast.info(`📄 Ordonnance détectée : ${file.name} — analyse en cours...`);
    
    try {
      let base64: string;
      if (file.type === "application/pdf") {
        base64 = await pdfToImageBase64(file);
      } else {
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      await handleAnalyzeImage(base64);
    } catch (err) {
      console.error("Scanner file error:", err);
      toast.error("Erreur lors du traitement du scan");
    }
  }, []);

  // HID barcode scanner: lookup CIP code directly
  const handleBarcodeScan = useCallback(async (code: string) => {
    toast.info(`🔍 Code scanné : ${code} — recherche...`);
    
    try {
      const { data: med } = await supabase
        .from("medicaments")
        .select("id, nom_commercial, cip_code, molecule_id, atc_code")
        .eq("cip_code", code)
        .maybeSingle();

      if (!med) {
        toast.warning(`Aucun médicament trouvé pour le code CIP ${code}`);
        return;
      }

      toast.success(`💊 ${med.nom_commercial} identifié`);

      // Lookup pathologies and complementary products
      const { data: pathLinks } = await supabase
        .from("medicament_pathologie")
        .select("pathologie_id")
        .eq("medicament_id", med.id);

      if (pathLinks && pathLinks.length > 0) {
        const pathIds = pathLinks.map(p => p.pathologie_id);
        const { data: produits } = await supabase
          .from("produits_complementaires")
          .select("produit, categorie, description")
          .in("pathologie_id", pathIds)
          .order("priorite", { ascending: false })
          .limit(5);

        if (produits && produits.length > 0) {
          // Build a simple analysis result to display suggestions
          setResult({
            medicaments: [{
              nom: med.nom_commercial,
              classe: "",
              recommendations: produits.map(p => ({
                produit: p.produit,
                categorie: p.categorie || "",
                description: p.description || undefined,
                priorite: 90,
              })),
            }],
            interactions: [],
            contextes: [],
            conseil: `Produits complémentaires suggérés pour ${med.nom_commercial}`,
            structuredData: true,
            sources: [],
          });
          notifyAnalysisDone({ count: 1 });
        }
      }
    } catch (err) {
      console.error("Barcode lookup error:", err);
      toast.error("Erreur lors de la recherche du produit");
    }
  }, []);

  const handleScanResult = (scan: ScanEvent) => {
    if (scan.scan_type === "prescription" && scan.result) {
      setResult({
        medicaments: scan.result.medicaments || [],
        interactions: scan.result.interactions || [],
        contextes: scan.result.contextes || [],
        conseil: scan.result.conseil || "",
        structuredData: scan.result.structuredData || false,
        sources: scan.result.sources || [],
      });
      notifyAnalysisDone({ count: (scan.result.medicaments || []).length });
    }
  };

  // Block access for paused/disabled pharmacies (admins bypass)
  if (user && !isAdmin && (pharmacyStatus === "paused" || pharmacyStatus === "disabled")) {
    const isPaused = pharmacyStatus === "paused";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          {isPaused ? (
            <PauseCircle className="h-16 w-16 text-yellow-500 mx-auto" />
          ) : (
            <ShieldX className="h-16 w-16 text-destructive mx-auto" />
          )}
          <h1 className="text-xl font-bold">
            {isPaused ? "Accès temporairement suspendu" : "Accès désactivé"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isPaused
              ? "L'accès de votre pharmacie a été mis en pause par l'administrateur. Contactez le support pour plus d'informations."
              : "L'accès de votre pharmacie a été supprimé. Contactez le support si vous pensez qu'il s'agit d'une erreur."}
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="pharmacy-gradient px-3 py-1.5 shrink-0 sticky top-0 z-10">
        <div className="container max-w-xl mx-auto flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-bold text-primary-foreground tracking-tight">Asclion</span>
          <div className="flex-1" />
          <SoundToggle />
          <RegisterSelector />
        </div>
      </header>

      <main className="container max-w-xl mx-auto px-3 py-1 flex-1 overflow-y-auto">
        <ScannerStatus
          onViewResult={handleScanResult}
          onNewFile={handleNewFile}
          onBarcodeScan={handleBarcodeScan}
        />
        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 animate-fade-in">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
          </div>
        ) : !result ? (
          <div className="space-y-3">
            <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
            <LegalDisclaimer />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Essayer :</span>
              {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole", "Metformine, Ramipril"].map((ex) => (
                <button key={ex} onClick={() => handleAnalyze(ex)} className="text-[11px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnalysisResults result={result} onReset={handleReset} />
        )}
      </main>

      <footer className="container max-w-xl mx-auto px-3 py-2 flex items-center justify-center gap-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground h-7 text-xs gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Dashboard
        </Button>
        {!isInstalled && (
          <Button variant="ghost" size="sm" onClick={handleInstall} className="text-muted-foreground h-7 text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            Installer
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground h-7 text-xs gap-1">
          <LogOut className="h-3.5 w-3.5" />
          Déconnexion
        </Button>
      </footer>
    </div>
  );
};

export default Index;
