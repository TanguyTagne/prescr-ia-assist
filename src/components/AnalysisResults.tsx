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
      <div className="text-center space-y-4 animate-fade-in py-8">
        <div className="text-5xl">🔍</div>
        <p className="text-lg text-muted-foreground">Aucun médicament reconnu.</p>
        <Button onClick={onReset} variant="outline" size="lg" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Nouvelle analyse
        </Button>
      </div>
    );
  }

  const niveauColor = (niveau: string) => {
    switch (niveau) {
      case "majeure": return "bg-destructive text-destructive-foreground";
      case "modérée": return "bg-pharmacy-warm text-primary-foreground";
      case "mineure": return "bg-muted text-muted-foreground";
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
    <div className="space-y-4 animate-fade-in">
      {/* Médicaments détectés - compact */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Pill className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Médicaments détectés</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.medicaments.map((med, i) => (
            <Badge key={i} variant="secondary" className="text-xs py-1 px-2.5">
              {med.nom} <span className="text-muted-foreground ml-1">({med.classe})</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Interactions - only if present */}
      {result.interactions && result.interactions.length > 0 && (
        <div className="glass-card rounded-xl p-4 border border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold text-sm text-destructive">Interactions</h2>
          </div>
          {result.interactions.map((inter, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-sm">
              <Badge className={`${niveauColor(inter.niveau)} text-xs shrink-0`}>{inter.niveau}</Badge>
              <span className="text-muted-foreground">{inter.medicaments.join(" + ")} — {inter.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Questions (max 2) */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Questions à poser</h2>
        </div>
        <ul className="space-y-1.5">
          {result.questions.slice(0, 2).map((q, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions (max 2) */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Suggestions</h2>
        </div>
        <div className="space-y-2">
          {result.suggestions.slice(0, 2).map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(sug.categorie)}
              className="w-full flex items-center gap-3 py-2 px-3 rounded-lg bg-secondary hover:bg-accent transition-colors text-left"
            >
              <span className="text-lg shrink-0">{sug.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm block">{sug.categorie}</span>
                <span className="text-xs text-muted-foreground">{sug.raison}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bouton Voir conseil */}
      {!showConseil ? (
        <Button
          onClick={handleConseilClick}
          size="lg"
          className="w-full h-12 text-base font-semibold pharmacy-gradient border-0 gap-2"
        >
          <MessageSquare className="h-5 w-5" />
          Voir conseil
        </Button>
      ) : (
        <div className="glass-card rounded-xl p-4 border-2 border-primary/20 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Phrase conseil</h2>
          </div>
          <p className="text-sm leading-relaxed italic text-foreground">
            "{result.conseil || "Un accompagnement adapté peut aider à améliorer le confort au quotidien. N'hésitez pas à en parler à votre pharmacien."}"
          </p>
        </div>
      )}

      {/* Reset */}
      <Button onClick={onReset} variant="outline" size="lg" className="w-full gap-2">
        <RotateCcw className="h-4 w-4" />
        Nouvelle ordonnance
      </Button>

      <LegalDisclaimer />
    </div>
  );
};

export default AnalysisResults;
