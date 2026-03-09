import { useState } from "react";
import { Pill, MessageCircleQuestion, ShoppingBag, RotateCcw, AlertTriangle, MessageSquare, ThumbsUp, ThumbsDown, Loader2, Sparkles, Database, Package, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult, RefinedResult } from "@/lib/prescriptionAnalyzer";
import { refinePrescription } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";
import { trackEvent } from "@/hooks/useAnalytics";
import { toast } from "sonner";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisResults = ({ result, onReset }: AnalysisResultsProps) => {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [refined, setRefined] = useState<RefinedResult | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [showConseil, setShowConseil] = useState(false);

  if (result.medicaments.length === 0) {
    return (
      <div className="text-center space-y-3 animate-fade-in py-6">
        <p className="text-sm text-muted-foreground">🔍 Aucun médicament reconnu.</p>
        <Button onClick={onReset} variant="outline" size="sm" className="gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" />
          Nouvelle analyse
        </Button>
      </div>
    );
  }

  const niveauColor = (niveau: string) => {
    switch (niveau) {
      case "majeure": return "bg-destructive text-destructive-foreground";
      case "modérée": return "bg-pharmacy-warm text-primary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleAnswer = (qIndex: number, answer: boolean) => {
    setAnswers(prev => ({ ...prev, [qIndex]: answer }));
    trackEvent("question_answered", { question_index: qIndex, answer: answer ? "oui" : "non" });
  };

  const allQuestionsAnswered = result.questions.length > 0 && result.questions.every((_, i) => answers[i] !== undefined);

  const handleRefine = async () => {
    setIsRefining(true);
    try {
      const refinedData = await refinePrescription(result, answers);
      setRefined(refinedData);
      trackEvent("recommendations_refined", { 
        answers_count: Object.keys(answers).length,
        suggestions_count: refinedData.suggestions.length 
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'affinage");
    } finally {
      setIsRefining(false);
    }
  };

  const handleSuggestionClick = (categorie: string) => {
    trackEvent("suggestion_used", { categorie });
  };

  const conseil = refined?.conseil || result.conseil;

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Sources de données */}
      {result.sources && result.sources.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Database className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          {result.sources.map((src, i) => (
            <Badge key={i} variant="outline" className="text-[8px] py-0 px-1 text-muted-foreground">
              {src}
            </Badge>
          ))}
        </div>
      )}

      {/* Médicaments */}
      <div className="rounded-lg border border-border p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Pill className="h-3 w-3 text-primary" />
          <span className="font-semibold text-xs">Médicaments</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {result.medicaments.map((med, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] py-0.5 px-1.5">
              {med.nom} <span className="text-muted-foreground ml-0.5">({med.classe})</span>
              {med.code_atc && <span className="text-muted-foreground/60 ml-0.5 text-[8px]">[{med.code_atc}]</span>}
            </Badge>
          ))}
        </div>
      </div>

      {/* Interactions */}
      {result.interactions.length > 0 && (
        <div className="rounded-lg border border-destructive/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="font-semibold text-xs text-destructive">Interactions</span>
          </div>
          {result.interactions.map((inter, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5 text-[11px]">
              <Badge className={`${niveauColor(inter.niveau)} text-[9px] px-1 py-0 shrink-0`}>{inter.niveau}</Badge>
              <span className="text-muted-foreground">{inter.medicaments.join(" + ")} — {inter.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Questions interactives */}
      {!refined && (
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageCircleQuestion className="h-3 w-3 text-primary" />
            <span className="font-semibold text-xs">Questions à poser au patient</span>
            <Badge variant="outline" className="text-[9px] ml-auto">
              {Object.keys(answers).length}/{result.questions.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {result.questions.map((q, i) => (
              <div key={i} className="space-y-1 animate-fade-in">
                <p className="text-[11px] leading-tight">{q.question}</p>
                {q.contexte && (
                  <p className="text-[9px] text-muted-foreground italic">{q.contexte}</p>
                )}
                {answers[i] === undefined ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAnswer(i, true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Oui
                    </button>
                    <button
                      onClick={() => handleAnswer(i, false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-muted-foreground text-[10px] font-medium transition-colors"
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Non
                    </button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[9px] py-0">
                    {answers[i] ? "✓ Oui" : "✗ Non"}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {allQuestionsAnswered && !isRefining && (
            <Button
              onClick={handleRefine}
              size="sm"
              className="w-full h-8 text-xs font-semibold pharmacy-gradient border-0 gap-1.5 mt-3"
            >
              <Sparkles className="h-3 w-3" />
              Obtenir les recommandations
            </Button>
          )}
          {isRefining && (
            <div className="flex items-center justify-center py-3 gap-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Analyse des réponses...</p>
            </div>
          )}
        </div>
      )}

      {/* AI Refined Suggestions */}
      {refined && refined.suggestions.length > 0 && (
        <div className="rounded-lg border border-primary/30 p-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag className="h-3 w-3 text-primary" />
            <span className="font-semibold text-xs">Recommandations personnalisées</span>
          </div>
          <div className="space-y-1">
            {refined.suggestions.map((sug, i) => (
              <div
                key={i}
                className="w-full space-y-1 py-1.5 px-2 rounded-md bg-secondary animate-fade-in"
              >
                <button
                  onClick={() => handleSuggestionClick(sug.categorie)}
                  className="w-full flex items-center gap-2 hover:bg-accent transition-colors text-left rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-[11px] leading-tight">{sug.categorie}</span>
                      {sug.priorite === "haute" && (
                        <Badge className="bg-primary/20 text-primary text-[8px] px-1 py-0">prioritaire</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">{sug.raison}</span>
                  </div>
                </button>
                {/* LGO Products */}
                {sug.produits_lgo && sug.produits_lgo.length > 0 && (
                  <div className="ml-2 space-y-0.5 border-l-2 border-primary/20 pl-2">
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                      <Package className="h-2.5 w-2.5" />
                      En stock
                    </div>
                    {sug.produits_lgo.map((prod, j) => (
                      <div key={j} className="flex items-center justify-between text-[10px] py-0.5">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <Check className="h-2.5 w-2.5 text-green-600 shrink-0" />
                          <span className="truncate">{prod.nom}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          {prod.prix > 0 && (
                            <span className="font-semibold text-foreground">{prod.prix.toFixed(2)}€</span>
                          )}
                          <Badge variant="outline" className="text-[8px] py-0 px-1">
                            {prod.stock} dispo
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conseil */}
      {(refined || showConseil) && (
        <div className="rounded-lg border border-primary/20 p-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="h-3 w-3 text-primary" />
            <span className="font-semibold text-xs">Phrase conseil</span>
          </div>
          <p className="text-[11px] leading-relaxed italic text-foreground">
            "{conseil || "Un accompagnement adapté peut aider à améliorer le confort au quotidien."}"
          </p>
        </div>
      )}

      {!refined && !showConseil && (
        <Button onClick={() => { setShowConseil(true); trackEvent("conseil_clicked"); }} size="sm" className="w-full h-8 text-xs font-semibold pharmacy-gradient border-0 gap-1.5">
          <MessageSquare className="h-3 w-3" />
          Voir conseil
        </Button>
      )}

      {/* Reset + disclaimer */}
      <div className="flex items-center gap-2">
        <Button onClick={onReset} variant="outline" size="sm" className="h-7 text-[11px] gap-1">
          <RotateCcw className="h-3 w-3" />
          Nouvelle ordonnance
        </Button>
      </div>
      <LegalDisclaimer />
    </div>
  );
};

export default AnalysisResults;
