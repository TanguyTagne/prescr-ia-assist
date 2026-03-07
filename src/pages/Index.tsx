import { useState } from "react";
import { Pill } from "lucide-react";
import PrescriptionInput from "@/components/PrescriptionInput";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { analyzePrescription, type AnalysisResult } from "@/lib/prescriptionAnalyzer";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = (text: string) => {
    const analysis = analyzePrescription(text);
    setResult(analysis);
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
        {!result ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Analyser une ordonnance</h2>
              <p className="text-muted-foreground">Entrez les médicaments pour obtenir contextes, questions et suggestions.</p>
            </div>
            <PrescriptionInput onAnalyze={handleAnalyze} />
            <LegalDisclaimer />

            {/* Quick examples */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Essayer avec :</p>
              <div className="flex flex-wrap gap-2">
                {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole", "Metformine"].map((ex) => (
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
