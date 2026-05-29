import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill, RotateCcw, AlertTriangle, MessageSquare, Loader2, Sparkles, Database, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";
import LineageBadge from "./LineageBadge";
import ReportButton from "./ReportButton";
import { trackEvent } from "@/hooks/useAnalytics";
import { usePcFeedback } from "@/hooks/usePcFeedback";
import { useProductLineage } from "@/hooks/useProductLineage";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { SCANNER } from "@/constants/scanner";


interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
  demoMode?: boolean;
}

// Fenêtre d'attribution HID : un scan dans les 5 min suivant l'analyse
// est considéré comme une vente du PC correspondant.
const HID_ATTRIBUTION_WINDOW_MS = 5 * 60 * 1000;

const AnalysisResults = ({ result, onReset, demoMode = false }: AnalysisResultsProps) => {
  const { t } = useI18n();
  const [orderedItems, setOrderedItems] = useState<Map<string, "manual_click" | "hid_auto">>(new Map());
  const [expandedConseils, setExpandedConseils] = useState<Set<number>>(new Set());
  const [conseilGlobalOpen, setConseilGlobalOpen] = useState(false);
  const { recordFeedback } = usePcFeedback();


  // Lineage : précharge la traçabilité (source officielle, validation) pour
  // tous les produits affichés afin d'alimenter le badge "Source" sous chaque PC.
  const allProductNames = useMemo(
    () =>
      result.medicaments
        .flatMap((m) => m.recommendations || [])
        .map((r) => r.produit),
    [result.medicaments]
  );
  const { lineage } = useProductLineage(allProductNames);

  // Flatten recommandations triées par priorité — utilisé pour raccourcis F1/F2/F3.
  const flatRecs = useMemo(() => {
    const all = result.medicaments.flatMap((m) =>
      (m.recommendations || []).map((r) => ({ medNom: m.nom, rec: r }))
    );
    return all.sort((a, b) => (b.rec.priorite || 0) - (a.rec.priorite || 0)).slice(0, 3);
  }, [result.medicaments]);

  // ── Auto-attribution HID ────────────────────────────────────────────────
  // Charge les CIP des PC proposés. Pendant 5 min après l'analyse, tout
  // scan douchette dont le CIP correspond à un PC proposé est marqué
  // accepté automatiquement (source = hid_auto). Évite la sous-attribution
  // quand le pharmacien oublie de cliquer sur "Accepter".
  const proposedCipMapRef = useRef<Map<string, { medNom: string; produit: string; categorie?: string }>>(new Map());
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    mountedAtRef.current = Date.now();
    proposedCipMapRef.current = new Map();

    if (demoMode || allProductNames.length === 0) return;

    // Récupère les CIP via medicaments.nom_commercial (match exact prioritaire)
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("medicaments")
        .select("nom_commercial, cip_code")
        .in("nom_commercial", allProductNames)
        .not("cip_code", "is", null);
      if (cancelled || !data) return;
      const nameToCip = new Map<string, string>();
      for (const row of data as any[]) {
        if (row.cip_code) nameToCip.set(row.nom_commercial, row.cip_code);
      }
      const cipMap = new Map<string, { medNom: string; produit: string; categorie?: string }>();
      for (const med of result.medicaments) {
        for (const rec of med.recommendations || []) {
          const cip = nameToCip.get(rec.produit);
          if (cip) cipMap.set(cip, { medNom: med.nom, produit: rec.produit, categorie: rec.categorie });
        }
      }
      proposedCipMapRef.current = cipMap;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ ean: string; at: number }>).detail;
      if (!detail?.ean) return;
      // Fenêtre d'attribution 5 min
      if (Date.now() - mountedAtRef.current > HID_ATTRIBUTION_WINDOW_MS) return;
      const match = proposedCipMapRef.current.get(detail.ean);
      if (!match) return;
      handleOrder(match.medNom, match.produit, match.categorie, "hid_auto");
    };
    window.addEventListener(SCANNER.DOM_EVENT, handler);
    return () => window.removeEventListener(SCANNER.DOM_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);


  // Raccourcis : Esc = nouvelle ordonnance, F1/F2/F3 = accepter top 1/2/3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target as any)?.isContentEditable;
      if (e.key === "Escape") {
        e.preventDefault();
        onReset();
        return;
      }
      if (inField) return;
      const map: Record<string, number> = { F1: 0, F2: 1, F3: 2 };
      if (e.key in map) {
        const item = flatRecs[map[e.key]];
        if (item) {
          e.preventDefault();
          handleOrder(item.medNom, item.rec.produit, item.rec.categorie);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset, flatRecs]);

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
        <p className="text-sm text-muted-foreground">{t("results.empty")}</p>
        <Button onClick={onReset} variant="outline" size="sm" className="gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" />
          {t("results.newAnalysis")}
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

  const handleOrder = (
    medNom: string,
    produit: string,
    categorie?: string,
    source: "manual_click" | "hid_auto" = "manual_click"
  ) => {
    const key = `${medNom}::${produit}`;
    // Anti double-comptage : si déjà accepté (clic ou auto), on ignore
    if (orderedItems.has(key)) return;
    setOrderedItems((prev) => {
      const next = new Map(prev);
      next.set(key, source);
      return next;
    });

    if (demoMode) {
      toast.info(t("results.demoToast"));
      return;
    }

    trackEvent("product_accepted", { medicament: medNom, produit, source });

    const medicaments_analyses = result.medicaments.map((m) => m.nom);
    const pcs_proposes = result.medicaments.flatMap((m) =>
      (m.recommendations || []).map((r) => r.produit)
    );
    recordFeedback(
      medNom,
      produit,
      "accepted",
      categorie,
      undefined,
      { medicaments_analyses, pcs_proposes },
      source
    );

    // Push silencieux au LGO si configuré (best-effort) — uniquement pour clic manuel
    if (source === "manual_click") {
      supabase.functions.invoke("lgo-push-cart", {
        body: { products: [{ name: produit, category: categorie }] },
      }).catch(() => {});
      toast.success(`${produit} ${t("results.acceptedToast")}`);
    } else {
      // Auto-détecté via scan douchette : toast discret 1.5s
      toast.success(`⚡ ${produit} détecté via scan`, { duration: 1500 });
    }
  };

  const isOrdered = (medNom: string, produit: string) => orderedItems.has(`${medNom}::${produit}`);
  const getOrderSource = (medNom: string, produit: string) => orderedItems.get(`${medNom}::${produit}`);


  return (
    <div className="space-y-2 animate-fade-in">
      {/* Interactions */}
      {result.interactions.length > 0 &&
      <div className="rounded-lg border border-destructive/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="font-semibold text-xs text-destructive">{t("results.interactions")}</span>
          </div>
          {result.interactions.map((inter, i) =>
        <div key={i} className="flex items-start gap-1.5 py-0.5 text-xs">
              <Badge className={`${niveauColor(inter.niveau)} text-[10px] px-1 py-0 shrink-0`}>{inter.niveau}</Badge>
              <span className="text-foreground/80">{inter.medicaments.join(" + ")} — {inter.description}</span>
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
            {med.code_atc && <span className="text-[10px] text-muted-foreground">[{med.code_atc}]</span>}
            {!demoMode && (
              <div className="ml-auto">
                <ReportButton
                  type="medicament_different"
                  medicamentNom={med.nom}
                  context={{ classe: med.classe, code_atc: med.code_atc, molecule: med.molecule }}
                />
              </div>
            )}
          </div>

          {med.conseil_associe &&
        <button
          onClick={() => toggleConseil(i)}
          aria-expanded={expandedConseils.has(i)}
          aria-label={`${expandedConseils.has(i) ? t("results.hide") : t("results.show")} ${t("results.adviceFor")} ${med.nom}`}
          className="flex items-center gap-1 text-xs text-primary/90 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-colors w-full text-left">
          
              {expandedConseils.has(i) ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
              <span className="font-semibold">{t("results.advice")}</span>
            </button>
        }
          {med.conseil_associe && expandedConseils.has(i) &&
        <p className="text-xs text-foreground leading-relaxed pl-4 animate-fade-in">
              {med.conseil_associe}
            </p>
        }

          {/* Recommendations for this medication */}
          {med.recommendations && med.recommendations.length > 0 &&
        <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" />
                {t("results.complementary")}
              </div>
              {med.recommendations.map((rec, j) => {
            const ordered = isOrdered(med.nom, rec.produit);
            return (
              <div key={j} className="px-1.5 rounded-md bg-secondary/50 py-[3px] space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">{rec.produit}</span>
                          {rec.priorite >= 80 &&
                      <Badge className="bg-primary/20 text-primary text-[10px] px-1 py-0">{t("results.priority")}</Badge>
                      }
                        </div>
                      </div>
                      <button
                    onClick={() => handleOrder(med.nom, rec.produit, rec.categorie)}
                    disabled={ordered}
                    aria-label={ordered ? `${rec.produit} ${t("results.acceptedAria")}` : `${t("results.acceptAria")} ${rec.produit}`}
                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    ordered ?
                    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    "bg-primary/10 hover:bg-primary/20 text-primary"}`
                    }>
                    
                        {ordered ?
                    <>
                            <Check className="h-3 w-3" />
                            {t("results.accepted")}
                          </> :

                    <>
                            <Check className="h-3 w-3" />
                            {t("results.accept")}
                          </>
                    }
                      </button>
                      {!demoMode && (
                        <ReportButton
                          type="pc_inadapte"
                          medicamentNom={med.nom}
                          pcNom={rec.produit}
                          pcCategorie={rec.categorie}
                          context={{ priorite: rec.priorite, pathologie: rec.pathologie }}
                        />
                      )}
                    </div>
                    {rec.phrase_conseil && (
                      <p className="text-[13px] font-medium text-foreground leading-snug pl-0.5 pt-0.5 animate-fade-in">
                        💬 « {rec.phrase_conseil} »
                      </p>
                    )}
                    {/* Badge de traçabilité (source officielle, validation) */}
                    <div className="pt-0.5">
                      <LineageBadge
                        productName={rec.produit}
                        info={lineage.get(rec.produit?.trim().toLowerCase())}
                      />
                    </div>
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
          {t("results.newPrescription")}
        </Button>
        {orderedItems.size > 0 &&
        <Badge variant="secondary" className="text-[10px]">
            {orderedItems.size} {t("results.productsAccepted")}
          </Badge>
        }
      </div>
      {flatRecs.length > 0 && (
        <p className="text-[10px] text-foreground/60 leading-tight">
          <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">F1</kbd>
          {flatRecs.length > 1 && <> · <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">F2</kbd></>}
          {flatRecs.length > 2 && <> · <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">F3</kbd></>}
          {" "}accepter · <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">Échap</kbd> nouvelle
        </p>
      )}
      {demoMode &&
        <div className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-[11px] text-foreground/80 leading-snug">
          <span className="font-semibold text-primary">{t("results.demoBannerLabel")}</span>
          {t("results.demoBannerText")}
        </div>
      }
      <LegalDisclaimer />
    </div>);

};

export default AnalysisResults;