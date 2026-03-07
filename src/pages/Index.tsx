import { useState } from "react";
import { Pill, Loader2 } from "lucide-react";
import PrescriptionInput from "@/components/PrescriptionInput";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { analyzePrescription, analyzePrescriptionImage, type AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { toast } from "sonner";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescription(text);
      setResult(analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescriptionImage(imageBase64);
      setResult(analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse OCR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground tracking-tight">PrescrIA</h1>
            <p className="text-xs text-primary-foreground/70">Assistant pharmacie intelligent</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-lg font-medium text-muted-foreground">Analyse en cours par l'IA...</p>
            <p className="text-sm text-muted-foreground">Gemini 2.5 Pro analyse votre ordonnance</p>
          </div>
        ) : !result ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Analyser une ordonnance</h2>
              <p className="text-muted-foreground">Entrez les médicaments pour obtenir contextes, questions et suggestions.</p>
            </div>
            <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
            <LegalDisclaimer />

            {/* Quick examples */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Essayer avec :</p>
              <div className="flex flex-wrap gap-2">
                {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole", "Metformine, Ramipril, Atorvastatine"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleAnalyze(ex)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                  >
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
    </div>
  );
};

export default Index;
