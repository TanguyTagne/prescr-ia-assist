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
    <div className="min-h-screen bg-background">
      {/* Compact header */}
      <header className="pharmacy-gradient px-3 py-2">
        <div className="container max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Pill className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-bold text-primary-foreground tracking-tight">PrescrIA</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-primary-foreground hover:bg-primary-foreground/10 h-7 w-7">
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            {!isInstalled && (
              <Button variant="ghost" size="icon" onClick={handleInstall} className="text-primary-foreground hover:bg-primary-foreground/10 h-7 w-7">
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10 h-7 w-7">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-xl mx-auto px-3 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 animate-fade-in">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
          </div>
        ) : !result ? (
          <div className="space-y-3">
            <div className="text-center space-y-0.5">
              <h2 className="text-base font-bold">Analyser une ordonnance</h2>
              <p className="text-xs text-muted-foreground">Entrez les médicaments pour obtenir questions et suggestions.</p>
            </div>
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
    </div>
  );
};

export default Index;
