import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill, RotateCcw, AlertTriangle, MessageSquare, Loader2, Sparkles, Database, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";
import { trackEvent } from "@/hooks/useAnalytics";
import { toast } from "sonner";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisResults = ({ result, onReset }: AnalysisResultsProps) => {
  const [orderedItems, setOrderedItems] = useState<Set<string>>(new Set());
  const [expandedConseils, setExpandedConseils] = useState<Set<number>>(new Set());
  const [conseilGlobalOpen, setConseilGlobalOpen] = useState(false);

  const toggleConseil = (index: number) => {
    setExpandedConseils(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

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

  const handleOrder = (medNom: string, produit: string) => {
    const key = `${medNom}::${produit}`;
    setOrderedItems(prev => new Set(prev).add(key));
    trackEvent("product_ordered", { medicament: medNom, produit });
    toast.success(`${produit} ajouté à la commande`);
  };

  const isOrdered = (medNom: string, produit: string) => orderedItems.has(`${medNom}::${produit}`);

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Alertes doublons / historique patient */}
      {result.duplicate_warning && (
        <div className="rounded-lg border border-pharmacy-warm/50 bg-pharmacy-warm/10 p-2.5 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-pharmacy-warm shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Ordonnance déjà analysée</p>
            <p className="text-[10px] text-muted-foreground">
              Vue {result.duplicate_warning.count} fois — dernière le {new Date(result.duplicate_warning.last_seen).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}

      {result.patient_history && result.patient_history.previous_analyses > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Patient connu</p>
            <p className="text-[10px] text-muted-foreground">
              {result.patient_history.previous_analyses} analyse(s) précédente(s) depuis le {new Date(result.patient_history.first_seen).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      )}

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

      {/* Médicaments + Recommandations directes */}
      {result.medicaments.map((med, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Pill className="h-3 w-3 text-primary shrink-0" />
            <span className="font-semibold text-xs">{med.nom}</span>
            {med.code_atc && <span className="text-[8px] text-muted-foreground/60">[{med.code_atc}]</span>}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {med.molecule && <span>{med.molecule} — </span>}{med.classe}
          </p>

          {med.conseil_associe && (
            <p className="text-[10px] text-foreground/90 leading-relaxed">
              <span className="font-semibold">Conseil :</span> {med.conseil_associe}
            </p>
          )}

          {/* Recommendations for this medication */}
          {med.recommendations && med.recommendations.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1 text-[9px] text-primary font-semibold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" />
                Produits complémentaires
              </div>
              {med.recommendations.map((rec, j) => {
                const ordered = isOrdered(med.nom, rec.produit);
                return (
                  <div key={j} className="flex items-center gap-2 py-1 px-1.5 rounded-md bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-[11px]">{rec.produit}</span>
                        {rec.priorite >= 80 && (
                          <Badge className="bg-primary/20 text-primary text-[8px] px-1 py-0">prioritaire</Badge>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground block leading-tight">
                        {rec.categorie}{rec.pathologie ? ` · ${rec.pathologie}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleOrder(med.nom, rec.produit)}
                      disabled={ordered}
                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                        ordered
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-primary/10 hover:bg-primary/20 text-primary"
                      }`}
                    >
                      {ordered ? (
                        <>
                          <Check className="h-3 w-3" />
                          Ajouté
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3 w-3" />
                          Commander
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Conseil */}
      <div className="rounded-lg border border-primary/20 p-2.5 animate-fade-in">
        <div className="flex items-center gap-1.5 mb-1">
          <MessageSquare className="h-3 w-3 text-primary" />
          <span className="font-semibold text-xs">Phrase conseil</span>
        </div>
        <p className="text-[11px] leading-relaxed italic text-foreground">
          "{result.conseil || "Un accompagnement adapté peut aider à améliorer le confort au quotidien."}"
        </p>
      </div>

      {/* Reset + disclaimer */}
      <div className="flex items-center gap-2">
        <Button onClick={onReset} variant="outline" size="sm" className="h-7 text-[11px] gap-1">
          <RotateCcw className="h-3 w-3" />
          Nouvelle ordonnance
        </Button>
        {orderedItems.size > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {orderedItems.size} produit(s) commandé(s)
          </Badge>
        )}
      </div>
      <LegalDisclaimer />
    </div>
  );
};

export default AnalysisResults;
