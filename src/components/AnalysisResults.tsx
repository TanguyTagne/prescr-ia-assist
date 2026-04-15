import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill, RotateCcw, AlertTriangle, MessageSquare, Loader2, Sparkles, Database, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";
import { trackEvent } from "@/hooks/useAnalytics";
import { usePcFeedback } from "@/hooks/usePcFeedback";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisResults = ({ result, onReset }: AnalysisResultsProps) => {
  const [orderedItems, setOrderedItems] = useState<Set<string>>(new Set());
  const [expandedConseils, setExpandedConseils] = useState<Set<number>>(new Set());
  const [expandedPCConseils, setExpandedPCConseils] = useState<Set<string>>(new Set());
  const [conseilGlobalOpen, setConseilGlobalOpen] = useState(false);
  const { recordFeedback } = usePcFeedback();

  // Escape key resets to new prescription
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onReset();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReset]);

  const toggleConseil = (index: number) => {
    setExpandedConseils((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);else
      next.add(index);
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
      </div>);

  }

  const niveauColor = (niveau: string) => {
    switch (niveau) {
      case "majeure":return "bg-destructive text-destructive-foreground";
      case "modérée":return "bg-pharmacy-warm text-primary-foreground";
      default:return "bg-muted text-muted-foreground";
    }
  };

  const handleOrder = (medNom: string, produit: string, categorie?: string) => {
    const key = `${medNom}::${produit}`;
    setOrderedItems((prev) => new Set(prev).add(key));
    trackEvent("product_ordered", { medicament: medNom, produit });
    recordFeedback(medNom, produit, "accepted", categorie);

    // Try to push to LGO
    supabase.functions.invoke("lgo-push-cart", {
      body: { products: [{ name: produit, category: categorie }] },
    }).catch(() => {});

    toast.success(`${produit} ajouté à la commande`);
  };

  const isOrdered = (medNom: string, produit: string) => orderedItems.has(`${medNom}::${produit}`);

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Alertes doublons / historique patient */}
      {result.duplicate_warning &&
      <div className="rounded-lg border border-pharmacy-warm/50 bg-pharmacy-warm/10 p-2.5 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-pharmacy-warm shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Ordonnance déjà analysée</p>
            <p className="text-[10px] text-muted-foreground">
              Vue {result.duplicate_warning.count} fois — dernière le {new Date(result.duplicate_warning.last_seen).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      }

      {result.patient_history && result.patient_history.previous_analyses > 0 &&
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Patient connu</p>
            <p className="text-[10px] text-muted-foreground">
              {result.patient_history.previous_analyses} analyse(s) précédente(s) depuis le {new Date(result.patient_history.first_seen).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      }


      {/* Interactions */}
      {result.interactions.length > 0 &&
      <div className="rounded-lg border border-destructive/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="font-semibold text-xs text-destructive">Interactions</span>
          </div>
          {result.interactions.map((inter, i) =>
        <div key={i} className="flex items-start gap-1.5 py-0.5 text-[11px]">
              <Badge className={`${niveauColor(inter.niveau)} text-[9px] px-1 py-0 shrink-0`}>{inter.niveau}</Badge>
              <span className="text-muted-foreground">{inter.medicaments.join(" + ")} — {inter.description}</span>
            </div>
        )}
        </div>
      }

      {/* Médicaments + Recommandations directes */}
      {result.medicaments.map((med, i) =>
      <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5 animate-fade-in my-0 mt-0 py-[3px]">
          <div className="flex items-center gap-1.5">
            <Pill className="h-3 w-3 text-primary shrink-0" />
            <span className="font-semibold text-xs">{med.nom}</span>
            {med.code_atc && <span className="text-[8px] text-muted-foreground/60">[{med.code_atc}]</span>}
          </div>

          {med.conseil_associe &&
        <button
          onClick={() => toggleConseil(i)}
          className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors w-full text-left">
          
              {expandedConseils.has(i) ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
              <span className="font-semibold">Conseil</span>
            </button>
        }
          {med.conseil_associe && expandedConseils.has(i) &&
        <p className="text-[10px] text-foreground/90 leading-relaxed pl-4 animate-fade-in">
              {med.conseil_associe}
            </p>
        }

          {/* Recommendations for this medication */}
          {med.recommendations && med.recommendations.length > 0 &&
        <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1 text-[9px] text-primary font-semibold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" />
                Produits complémentaires
              </div>
              {med.recommendations.map((rec, j) => {
            const ordered = isOrdered(med.nom, rec.produit);
            return (
              <div key={j} className="px-1.5 rounded-md bg-secondary/50 py-[3px] space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-[11px]">{rec.produit}</span>
                          {rec.priorite >= 80 &&
                      <Badge className="bg-primary/20 text-primary text-[8px] px-1 py-0">prioritaire</Badge>
                      }
                        </div>
                      </div>
                      <button
                    onClick={() => handleOrder(med.nom, rec.produit, rec.categorie)}
                    disabled={ordered}
                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    ordered ?
                    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    "bg-primary/10 hover:bg-primary/20 text-primary"}`
                    }>
                    
                        {ordered ?
                    <>
                            <Check className="h-3 w-3" />
                            Ajouté
                          </> :

                    <>
                            <ShoppingCart className="h-3 w-3" />
                            Commander
                          </>
                    }
                      </button>
                    </div>
                    {rec.phrase_conseil && (() => {
                      const pcKey = `${i}-${j}`;
                      const isOpen = expandedPCConseils.has(pcKey);
                      return (
                        <>
                          <button
                            onClick={() => setExpandedPCConseils((prev) => {
                              const next = new Set(prev);
                              if (next.has(pcKey)) next.delete(pcKey); else next.add(pcKey);
                              return next;
                            })}
                            className="text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5 pl-0.5"
                          >
                            {isOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                            Conseil
                          </button>
                          {isOpen &&
                            <p className="text-[10px] text-muted-foreground italic leading-snug pl-3 animate-fade-in">
                              💬 "{rec.phrase_conseil}"
                            </p>
                          }
                        </>
                      );
                    })()
                    }
                  </div>);

          })}
            </div>
        }
        </div>
      )}


      {/* Reset + disclaimer */}
      <div className="flex items-center gap-2">
        <Button onClick={onReset} variant="outline" size="sm" className="h-7 text-[11px] gap-1">
          <RotateCcw className="h-3 w-3" />
          Nouvelle ordonnance
        </Button>
        {orderedItems.size > 0 &&
        <Badge variant="secondary" className="text-[10px]">
            {orderedItems.size} produit(s) commandé(s)
          </Badge>
        }
      </div>
      <LegalDisclaimer />
    </div>);

};

export default AnalysisResults;