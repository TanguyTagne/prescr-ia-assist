import { useState } from "react";
import { Pill, Loader2, BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import PrescriptionInput from "@/components/PrescriptionInput";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { analyzePrescription, analyzePrescriptionImage, type AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
      <header className="pharmacy-gradient px-4 py-3">
        <div className="container max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-9 w-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Pill className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground tracking-tight">PrescrIA</h1>
              <p className="text-[10px] text-primary-foreground/70">Copilote pharmacie</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Analyse en cours...</p>
          </div>
        ) : !result ? (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Analyser une ordonnance</h2>
              <p className="text-sm text-muted-foreground">Entrez les médicaments pour obtenir questions et suggestions.</p>
            </div>
            <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
            <LegalDisclaimer />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Essayer :</p>
              <div className="flex flex-wrap gap-2">
                {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole", "Metformine, Ramipril"].map((ex) => (
                  <button key={ex} onClick={() => handleAnalyze(ex)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AnalysisResults result={result} onReset={handleReset} />
        )}
      </main>
      <PWAInstallPrompt />
    </div>
  );
};

export default Index;
