import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill, RotateCcw, AlertTriangle, MessageSquare, Loader2, Sparkles, Database, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import LegalDisclaimer from "./LegalDisclaimer";

import ReportButton from "./ReportButton";
import { trackEvent } from "@/hooks/useAnalytics";
import { usePcFeedback } from "@/hooks/usePcFeedback";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { SCANNER } from "@/constants/scanner";


interface AnalysisResultsProps {
  result: AnalysisResult;
  onReset: () => void;
  demoMode?: boolean;
}

// Fenêtre d'attribution HID : un scan dans les 10 min suivant l'analyse
// est considéré comme une vente du PC correspondant. La fenêtre est aussi
// réinitialisée automatiquement à chaque nouvelle ordonnance (changement de `result`).
// Note : l'auto-reset de session (Widget.tsx) reste à 2 min, mais ne se déclenche
// QUE si le nouveau scan n'est PAS un PC suggéré — donc l'auto-attribution
// 10 min reste valide tant que le pharmacien ne sert pas un nouveau client.
const HID_ATTRIBUTION_WINDOW_MS = 10 * 60 * 1000;

// Normalisation pour matching de noms : lowercase, sans accents, sans dosage
// ni unité ni forme galénique. Permet de matcher "Magnésium bisglycinate 300mg"
// avec "MAGNESIUM BISGLYCINATE 300MG NUTERGIA" malgré les variations.
function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+\s*(mg|g|ml|ui|µg|comprim|gelule|gel|sachet|patch|cp|cpr|gel|tube|flacon)\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const AnalysisResults = ({ result, onReset, demoMode = false }: AnalysisResultsProps) => {
  const { t } = useI18n();
  const [orderedItems, setOrderedItems] = useState<Map<string, "manual_click" | "hid_auto">>(new Map());
  const [expandedConseils, setExpandedConseils] = useState<Set<number>>(new Set());
  const [conseilGlobalOpen, setConseilGlobalOpen] = useState(false);
  const { recordFeedback } = usePcFeedback();



  // Flatten recommandations triées par priorité — utilisé pour raccourcis F1/F2/F3.
  const flatRecs = useMemo(() => {
    const all = result.medicaments.flatMap((m) =>
      (m.recommendations || []).map((r) => ({ medNom: m.nom, rec: r }))
    );
    return all.sort((a, b) => (b.rec.priorite || 0) - (a.rec.priorite || 0)).slice(0, 3);
  }, [result.medicaments]);

  // ── Auto-attribution HID ────────────────────────────────────────────────
  // Charge les CIP des PC proposés. Pendant 10 min après l'analyse, tout
  // scan douchette dont le CIP correspond à un PC proposé est marqué
  // accepté automatiquement (source = hid_auto). Évite la sous-attribution
  // quand le pharmacien oublie de cliquer sur "Accepter".
  //
  // Double matching pour fiabilité :
  //   1) proposedCipMapRef : CIP scanné → PC suggéré (direct, rapide)
  //   2) proposedNamesMapRef : nom normalisé → PC suggéré (fallback
  //      quand le CIP du produit n'est pas dans nos tables, mais que le
  //      nom commercial associé à l'EAN matche)
  const proposedCipMapRef   = useRef<Map<string, { medNom: string; produit: string; categorie?: string }>>(new Map());
  const proposedNamesMapRef = useRef<Map<string, { medNom: string; produit: string; categorie?: string }>>(new Map());
  const mountedAtRef = useRef<number>(Date.now());
  // EAN auto-détectés depuis le dernier reset, pour permettre l'annulation par re-scan
  const autoDetectedEansRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedAtRef.current = Date.now();
    proposedCipMapRef.current = new Map();
    proposedNamesMapRef.current = new Map();
    autoDetectedEansRef.current = new Set();

    if (demoMode || allProductNames.length === 0) return;

    // ── Construction des index de matching ───────────────────────────────
    // Pour chaque PC proposé, on essaie de résoudre son CIP via 3 stratégies.
    // En parallèle on remplit proposedNamesMapRef pour permettre un fallback
    // par nom commercial quand le CIP scanné n'existe pas dans nos tables.
    let cancelled = false;
    (async () => {
      const normalize = normalizeName;

      // Pass 1+2 : medicaments — récupère exact + normalisé en une seule query
      const firstWords = [...new Set(
        allProductNames.map(n => n.split(/[\s/(]/)[0]).filter(w => w.length >= 3),
      )];
      const orClauses = firstWords.map(w => `nom_commercial.ilike.${w}%`).join(",");
      const { data: meds } = await supabase
        .from("medicaments")
        .select("nom_commercial, cip_code")
        .or(orClauses)
        .not("cip_code", "is", null)
        .limit(500);

      // Pass 3 : medicament_cip (BDPM) — pour les produits OTC souvent absents de medicaments
      const { data: bdpm } = await supabase
        .from("medicament_cip")
        .select("cip13, medicament_nom")
        .or(orClauses.split("nom_commercial").join("medicament_nom"))
        .limit(500);

      if (cancelled) return;

      // Construit l'index de matching : pour chaque CIP en base, ses formes normalisées
      type Entry = { cip: string; rawName: string };
      const normIndex = new Map<string, Entry[]>();
      const exactIndex = new Map<string, Entry>();

      for (const row of (meds || []) as any[]) {
        if (!row.cip_code) continue;
        const entry = { cip: row.cip_code, rawName: row.nom_commercial };
        exactIndex.set(row.nom_commercial, entry);
        const norm = normalize(row.nom_commercial);
        if (!normIndex.has(norm)) normIndex.set(norm, []);
        normIndex.get(norm)!.push(entry);
      }
      for (const row of (bdpm || []) as any[]) {
        if (!row.cip13) continue;
        const entry = { cip: row.cip13, rawName: row.medicament_nom };
        if (!exactIndex.has(row.medicament_nom)) exactIndex.set(row.medicament_nom, entry);
        const norm = normalize(row.medicament_nom);
        if (!normIndex.has(norm)) normIndex.set(norm, []);
        normIndex.get(norm)!.push(entry);
      }

      const cipMap   = new Map<string, { medNom: string; produit: string; categorie?: string }>();
      const namesMap = new Map<string, { medNom: string; produit: string; categorie?: string }>();
      const missed: string[] = [];

      for (const med of result.medicaments) {
        for (const rec of med.recommendations || []) {
          const target = rec.produit;
          const entry  = { medNom: med.nom, produit: rec.produit, categorie: rec.categorie };

          // Map "nom normalisé → PC" toujours peuplée (fallback indépendant du CIP)
          namesMap.set(normalize(target), entry);

          // Map "CIP → PC" — résolution multi-stratégies
          let resolved: Entry | null = null;

          // Étape 1 : match exact
          resolved = exactIndex.get(target) || null;

          // Étape 2 : match normalisé
          if (!resolved) {
            const norm = normalize(target);
            const candidates = normIndex.get(norm);
            if (candidates && candidates.length > 0) resolved = candidates[0];
          }

          // Étape 3 : match flexible (le 1er mot du PC commence un nom en base)
          if (!resolved) {
            const firstWord = normalize(target.split(/[\s/(]/)[0]);
            for (const [norm, entries] of normIndex.entries()) {
              if (norm.startsWith(firstWord) && firstWord.length >= 4) {
                resolved = entries[0];
                break;
              }
            }
          }

          if (resolved) {
            cipMap.set(resolved.cip, entry);
          } else {
            missed.push(rec.produit);
          }
        }
      }
      proposedCipMapRef.current   = cipMap;
      proposedNamesMapRef.current = namesMap;

      if (missed.length > 0) {
        // Log analytics — permet d'identifier les PCs sans CIP résoluble.
        // Ces PCs peuvent quand même être auto-acceptés via le fallback nom commercial.
        // eslint-disable-next-line no-console
        console.debug("[auto-accept] PCs sans CIP direct (fallback nom commercial actif):", missed);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ ean: string; at: number }>).detail;
      if (!detail?.ean) return;
      // Fenêtre d'attribution 10 min
      if (Date.now() - mountedAtRef.current > HID_ATTRIBUTION_WINDOW_MS) return;

      // ── Étape 1 : match direct par CIP ─────────────────────────────────
      let match = proposedCipMapRef.current.get(detail.ean) || null;

      // ── Étape 2 : fallback par nom commercial ──────────────────────────
      // Si aucun match CIP, on résout le nom du produit scanné via medicaments
      // puis medicament_cip (BDPM), et on compare avec les noms normalisés
      // des PC proposés. Permet d'attraper les cas où le CIP du scan n'est
      // pas dans nos tables mais le nom commercial l'est.
      if (!match && proposedNamesMapRef.current.size > 0) {
        let scannedName: string | null = null;

        const { data: m1 } = await supabase
          .from("medicaments")
          .select("nom_commercial")
          .eq("cip_code", detail.ean)
          .maybeSingle();
        scannedName = (m1 as any)?.nom_commercial ?? null;

        if (!scannedName) {
          const { data: m2 } = await supabase
            .from("medicament_cip")
            .select("medicament_nom")
            .eq("cip13", detail.ean)
            .maybeSingle();
          scannedName = (m2 as any)?.medicament_nom ?? null;
        }

        if (scannedName) {
          const normScanned = normalizeName(scannedName);
          // 2a — match exact normalisé
          match = proposedNamesMapRef.current.get(normScanned) || null;
          // 2b — match par préfixe (1er mot ≥ 4 chars)
          if (!match) {
            const firstWord = normScanned.split(" ")[0];
            if (firstWord && firstWord.length >= 4) {
              for (const [normPc, entry] of proposedNamesMapRef.current.entries()) {
                if (normPc.startsWith(firstWord) || normScanned.startsWith(normPc.split(" ")[0])) {
                  match = entry;
                  // eslint-disable-next-line no-console
                  console.debug(`[auto-accept] Match fallback nom : "${scannedName}" → "${entry.produit}"`);
                  break;
                }
              }
            }
          }
        }
      }

      if (!match) return;

      // Toggle anti faux-positif : si l'EAN a déjà été auto-détecté dans la
      // fenêtre, le re-scan annule l'auto-acceptation (retour rayon, refus client…)
      if (autoDetectedEansRef.current.has(detail.ean)) {
        handleCancelAuto(match.medNom, match.produit, match.categorie, detail.ean);
        return;
      }
      autoDetectedEansRef.current.add(detail.ean);
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

  const handleCancelAuto = (medNom: string, produit: string, categorie: string | undefined, ean: string) => {
    const key = `${medNom}::${produit}`;
    // On n'annule que les auto-détections (le clic manuel reste prioritaire)
    if (orderedItems.get(key) !== "hid_auto") return;
    setOrderedItems((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    autoDetectedEansRef.current.delete(ean);
    trackEvent("product_auto_cancelled", { medicament: medNom, produit, ean });
    // Log feedback "refused" pour invalider la conversion dans les KPI
    recordFeedback(medNom, produit, "refused", categorie, "cancelled_by_rescan", undefined, "hid_auto");
    toast.info(`Annulé : ${produit}`, { duration: 1500 });
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
                  context={{
                    classe: med.classe,
                    code_atc: med.code_atc,
                    molecule: med.molecule,
                    cip_scanned: med.cip_scanned ?? null,
                  }}
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
          {med.recommendations && med.recommendations.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" />
                {t("results.complementary")}
              </div>
              {med.recommendations.map((rec, j) => {
                const ordered = isOrdered(med.nom, rec.produit);
                const orderSource = getOrderSource(med.nom, rec.produit);
                const isAuto = orderSource === "hid_auto";
                const shortHint = rec.phrase_conseil?.trim() || null;
                const dotColors = ["bg-primary", "bg-blue-400", "bg-amber-400"];
                return (
                  <div
                    key={j}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                      ordered
                        ? "bg-primary/10 border-primary/25"
                        : "bg-secondary/40 border-border hover:border-primary/20"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[j] ?? "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold text-xs text-foreground">{rec.produit}</span>
                        {shortHint && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground font-normal truncate">{shortHint}</span>
                          </>
                        )}
                        {rec.priorite >= 80 && (
                          <Badge className="bg-primary/20 text-primary text-[9px] px-1 py-0">{t("results.priority")}</Badge>
                        )}
                        {isAuto && (
                          <Badge
                            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1 py-0 gap-0.5"
                            title="Vente détectée automatiquement via scan douchette"
                          >
                            <Zap className="h-2 w-2" />auto
                          </Badge>
                        )}
                      </div>
                      <LineageBadge
                        productName={rec.produit}
                        info={lineage.get(rec.produit?.trim().toLowerCase())}
                      />
                    </div>
                    <button
                      onClick={() => handleOrder(med.nom, rec.produit, rec.categorie)}
                      disabled={ordered}
                      aria-label={ordered ? `${rec.produit} ${t("results.acceptedAria")}` : `${t("results.acceptAria")} ${rec.produit}`}
                      className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        ordered
                          ? "bg-primary text-white"
                          : "bg-primary/15 hover:bg-primary/30 text-primary"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
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
                );
              })}
            </div>
          )}
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
