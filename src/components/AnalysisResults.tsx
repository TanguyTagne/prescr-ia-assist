import { useState } from "react";
import { Pill, MessageCircleQuestion, ShoppingBag, RotateCcw, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";
import { trackEvent } from "@/hooks/useAnalytics";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisResults = ({ result, onReset }: AnalysisResultsProps) => {
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

  const handleConseilClick = () => {
    setShowConseil(true);
    trackEvent("conseil_clicked", { medicaments: result.medicaments.map(m => m.nom) });
  };

  const handleSuggestionClick = (categorie: string) => {
    trackEvent("suggestion_used", { categorie });
  };

  return (
    <div className="space-y-2 animate-fade-in">
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

      {/* Questions */}
      <div className="rounded-lg border border-border p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <MessageCircleQuestion className="h-3 w-3 text-primary" />
          <span className="font-semibold text-xs">Questions à poser</span>
        </div>
        <ul className="space-y-0.5">
          {result.questions.slice(0, 2).map((q, i) => (
            <li key={i} className="text-[11px] flex items-start gap-1.5">
              <span className="text-primary font-bold">•</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions */}
      <div className="rounded-lg border border-border p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <ShoppingBag className="h-3 w-3 text-primary" />
          <span className="font-semibold text-xs">Suggestions</span>
        </div>
        <div className="space-y-1">
          {result.suggestions.slice(0, 2).map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(sug.categorie)}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md bg-secondary hover:bg-accent transition-colors text-left"
            >
              <span className="text-sm shrink-0">{sug.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-[11px] block leading-tight">{sug.categorie}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{sug.raison}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conseil */}
      {!showConseil ? (
        <Button onClick={handleConseilClick} size="sm" className="w-full h-8 text-xs font-semibold pharmacy-gradient border-0 gap-1.5">
          <MessageSquare className="h-3 w-3" />
          Voir conseil
        </Button>
      ) : (
        <div className="rounded-lg border border-primary/20 p-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="h-3 w-3 text-primary" />
            <span className="font-semibold text-xs">Phrase conseil</span>
          </div>
          <p className="text-[11px] leading-relaxed italic text-foreground">
            "{result.conseil || "Un accompagnement adapté peut aider à améliorer le confort au quotidien."}"
          </p>
        </div>
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
