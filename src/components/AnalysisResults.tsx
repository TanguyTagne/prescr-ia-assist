import { useState } from "react";
import { Pill, MessageCircleQuestion, ShoppingBag, RotateCcw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisResults = ({ result, onReset }: AnalysisResultsProps) => {
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<number, "oui" | "non">>({});
  const [step, setStep] = useState<"overview" | "questions" | "suggestions">("overview");

  const handleAnswer = (idx: number, answer: "oui" | "non") => {
    setAnsweredQuestions((prev) => ({ ...prev, [idx]: answer }));
  };

  const allQuestionsAnswered = result.questions.length > 0 && Object.keys(answeredQuestions).length >= Math.min(result.questions.length, 3);

  if (result.medicaments.length === 0) {
    return (
      <div className="text-center space-y-4 animate-fade-in py-8">
        <div className="text-5xl">🔍</div>
        <p className="text-lg text-muted-foreground">Aucun médicament reconnu. Vérifiez l'orthographe ou essayez un autre nom.</p>
        <Button onClick={onReset} variant="outline" size="lg" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Nouvelle analyse
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => setStep("overview")} className={`px-3 py-1 rounded-full transition-all ${step === "overview" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary"}`}>
          1. Ordonnance
        </button>
        <span>→</span>
        <button onClick={() => setStep("questions")} className={`px-3 py-1 rounded-full transition-all ${step === "questions" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary"}`}>
          2. Questions
        </button>
        <span>→</span>
        <button onClick={() => setStep("suggestions")} className={`px-3 py-1 rounded-full transition-all ${step === "suggestions" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary"}`}>
          3. Suggestions
        </button>
      </div>

      {/* STEP 1: Overview */}
      {step === "overview" && (
        <div className="space-y-4 animate-fade-in">
          {/* Medications */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Médicaments détectés</h2>
            </div>
            <div className="space-y-2">
              {result.medicaments.map((med, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary animate-slide-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="font-medium">{med.nom}</span>
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">{med.classe}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Contextes */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Contextes souvent associés</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.contextes.map((ctx, i) => (
                <Badge key={i} variant="outline" className="text-sm py-1.5 px-3 border-primary/30 text-foreground">
                  {ctx}
                </Badge>
              ))}
            </div>
          </div>

          <Button onClick={() => setStep("questions")} size="lg" className="w-full h-13 text-base font-semibold pharmacy-gradient border-0">
            Voir les questions à poser →
          </Button>
        </div>
      )}

      {/* STEP 2: Questions */}
      {step === "questions" && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircleQuestion className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Questions à poser au patient</h2>
            </div>
            <div className="space-y-3">
              {result.questions.slice(0, 5).map((q, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg bg-secondary animate-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="text-sm font-medium flex-1">{q}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAnswer(i, "oui")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        answeredQuestions[i] === "oui"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-card border border-border hover:border-primary"
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      onClick={() => handleAnswer(i, "non")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        answeredQuestions[i] === "non"
                          ? "bg-muted text-muted-foreground"
                          : "bg-card border border-border hover:border-border"
                      }`}
                    >
                      Non
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => setStep("suggestions")} size="lg" className="w-full h-13 text-base font-semibold pharmacy-gradient border-0">
            <ShoppingBag className="h-5 w-5 mr-2" />
            Voir les suggestions produits →
          </Button>
        </div>
      )}

      {/* STEP 3: Suggestions */}
      {step === "suggestions" && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Suggestions produits complémentaires</h2>
            </div>
            <div className="space-y-3">
              {result.suggestions.map((sug, i) => (
                <div key={i} className="flex items-start gap-4 py-4 px-4 rounded-lg bg-secondary animate-slide-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="text-2xl shrink-0">{sug.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">{sug.categorie}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{sug.raison}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={onReset} variant="outline" size="lg" className="w-full h-13 gap-2 text-base">
            <RotateCcw className="h-4 w-4" />
            Nouvelle ordonnance
          </Button>
        </div>
      )}

      <LegalDisclaimer />
    </div>
  );
};

export default AnalysisResults;
