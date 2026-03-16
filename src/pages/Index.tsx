import { useState, useEffect } from "react";
import { Pill, Loader2, BarChart3, LogOut, Download } from "lucide-react";
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
import type { ScanEvent } from "@/hooks/useScanQueue";

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
  const { user, signOut } = useAuth();
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
        toast.success("PrescrIA installée !");
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
      trackEvent("ordonnance_analyzed", { input_type: "image", response_time: responseTime, medicaments: analysis.medicaments.map(m => m.nom) });
      trackEvent("widget_shown", {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse OCR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => setResult(null);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Fixed header */}
      <header className="pharmacy-gradient px-3 py-1.5 shrink-0 sticky top-0 z-10">
        <div className="container max-w-xl mx-auto flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-bold text-primary-foreground tracking-tight">PrescrIA</span>
        </div>
      </header>

      <main className="container max-w-xl mx-auto px-3 py-1 flex-1 overflow-y-auto">
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

      {/* Footer actions */}
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
