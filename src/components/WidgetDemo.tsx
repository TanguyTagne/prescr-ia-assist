import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { trackDemoSession } from "@/lib/demoTracking";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";

type Phase = "search" | "analyzing" | "result" | "lead";

const USES_KEY = "asclion_demo_uses";



interface WidgetDemoProps {
  onClose?: () => void;
  /** "compact" = floating widget (320px). "full" = in-page panel. */
  size?: "compact" | "full";
}

const WidgetDemo = ({ onClose, size = "compact" }: WidgetDemoProps) => {
  const full = size === "full";
  const c = {
    wrap: full ? "p-5 md:p-7 space-y-4" : "p-4 space-y-3",
    title: full ? "text-base md:text-lg font-bold" : "text-xs font-semibold",
    sub: full ? "text-sm text-muted-foreground" : "text-[10px] text-muted-foreground",
    input: full
      ? "w-full h-12 pl-10 pr-3 text-base rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      : "w-full h-9 pl-7 pr-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary",
    icon: full ? "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" : "absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground",
    sugg: full ? "w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors" : "w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent transition-colors",
    cta: full
      ? "w-full h-12 rounded-lg pharmacy-gradient text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      : "w-full h-10 rounded-md pharmacy-gradient text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    chip: full
      ? "px-3 py-1.5 rounded-full border border-border bg-card text-sm hover:border-primary hover:bg-accent transition-colors"
      : "px-2 py-1 rounded-full border border-border bg-card text-[10px] hover:border-primary hover:bg-accent transition-colors",
  };
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  // ── Liste des médicaments de la base avec suggestions pertinentes ──
  const [medList, setMedList] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (phase !== "search" || medList.length > 0 || listLoading) return;
    setListLoading(true);
    supabase.functions
      .invoke("demo-med-lookup", { body: { mode: "list" } })
      .then(({ data }) => setMedList(((data as any)?.medications || []).slice(0, 6)))
      .catch(() => setMedList([]))
      .finally(() => setListLoading(false));
  }, [phase, medList.length, listLoading]);

  // Démo illimitée : aucune porte email, on reste sur les résultats tant que
  // l'utilisateur ne relance pas une recherche.

  const runAnalysis = async (med: string) => {
    setNotFound(false);
    setResult(null);
    setPhase("analyzing");
    trackEvent("demo_analyzed", { medicament: med });
    trackDemoSession(med);

    const started = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("demo-med-lookup", {
        body: { mode: "lookup", query: med },
      });
      if (error) throw error;
      const res = data as any;

      // Minimum perceived analysis time for a smooth demo feel
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await new Promise((r) => setTimeout(r, 1400 - elapsed));

      if (!res?.found) {
        setNotFound(true);
        setPhase("search");
        return;
      }

      const uses = Number(localStorage.getItem(USES_KEY) || "0") + 1;
      localStorage.setItem(USES_KEY, String(uses));
      window.dispatchEvent(new Event("asclion:demo-tested"));

      // Démo : uniquement les 2 PC suggérés, avec leur phrase conseil exacte
      // issue de la base (aucune reformulation côté client).
      const med = {
        ...res.medicament,
        recommendations: (res.medicament?.recommendations || []).slice(0, 2),
      };
      setResult({
        medicaments: [med],
        interactions: [],
        contextes: [],
        conseil: res.medicament?.conseil_associe || "",
        structuredData: true,
      });
      setPhase("result");
    } catch (e) {
      console.error(e);
      setNotFound(true);
      setPhase("search");
    }
  };

  const handleSubmitSearch = (value?: string) => {
    const med = (value ?? query).trim();
    if (med.length < 2) return;
    setQuery(med);
    // Démo illimitée : les résultats s'affichent directement, sans porte email.
    runAnalysis(med);
  };

  // Retour à la liste des médicaments — démo illimitée.
  const handleReset = () => {
    setResult(null);
    setQuery("");
    setPhase("search");
  };

  if (phase === "analyzing") {
    return (
      <div className={full ? "p-5 md:p-7" : "p-4"}>
        <AnalysisSkeleton />
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className={full ? "p-5 md:p-7" : "p-4"}>
        <AnalysisResults result={result} demoMode onReset={handleReset} />
      </div>
    );
  }


  // ── Search phase ──
  return (
    <div className={c.wrap}>
      <div className={full ? "space-y-1" : "flex items-center gap-1.5"}>
        <span className={`inline-flex items-center gap-1.5 ${c.title}`}>
          <Sparkles className={full ? "h-4 w-4 text-primary" : "h-3.5 w-3.5 text-primary"} />
          {t("demo.list.title")}
        </span>{" "}
        <span className={c.sub}>{t("demo.search.subtitle")}</span>
      </div>

      {notFound && (
        <p className="flex items-start gap-1 text-[10px] text-destructive leading-snug">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          {t("demo.search.notFound")}
        </p>
      )}

      {listLoading && medList.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("demo.list.loading")}
        </div>
      ) : (
        <ul className="rounded border border-border bg-card divide-y divide-border overflow-hidden">
          {medList.map((med) => (
            <li key={med}>
              <button
                type="button"
                onClick={() => handleSubmitSearch(med)}
                className={`${c.sugg} flex items-center gap-2 w-full`}
              >
                <Sparkles className={full ? "h-3.5 w-3.5 text-primary shrink-0" : "h-3 w-3 text-primary shrink-0"} />
                <span className="flex-1 truncate">{med}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <LegalDisclaimer />
    </div>
  );
};

export default WidgetDemo;
