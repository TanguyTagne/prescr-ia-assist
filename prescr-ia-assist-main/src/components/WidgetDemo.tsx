import { useState, useEffect, useMemo } from "react";
import { Sparkles, FileText, ArrowLeft } from "lucide-react";
import { getDemoPrescriptions } from "@/lib/demoPrescriptions";
import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { trackDemoSession } from "@/lib/demoTracking";
import DemoLeadForm from "@/components/DemoLeadForm";
import { useI18n } from "@/i18n/I18nProvider";

type Phase = "list" | "preview" | "analyzing" | "result" | "lead";

const WidgetDemo = () => {
  const { t, lang } = useI18n();
  const demos = useMemo(() => getDemoPrescriptions(lang), [lang]);
  const [phase, setPhase] = useState<Phase>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const selected = demos.find((d) => d.id === selectedId) || null;

  useEffect(() => {
    if (phase !== "analyzing" || !selected) return;
    const tm = setTimeout(() => {
      setResult(selected.result);
      setPhase("result");
    }, 2500);
    return () => clearTimeout(tm);
  }, [phase, selected]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setPhase("preview");
  };

  const handleAnalyze = () => {
    if (!selected) return;
    trackEvent("demo_analyzed", { ordonnance: selected.id });
    trackDemoSession(selected.id);
    setResult(null);
    setPhase("analyzing");
  };

  const handleReset = () => setPhase("lead");

  const handleNewDemoFromLead = () => {
    setResult(null);
    setSelectedId(null);
    setPhase("list");
  };

  if (phase === "analyzing") {
    return (
      <div className="p-4">
        <AnalysisSkeleton />
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="p-4">
        <AnalysisResults result={result} demoMode onReset={handleReset} />
      </div>
    );
  }

  if (phase === "lead") {
    return (
      <div className="p-4 space-y-3 animate-fade-in">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {t("demo.lead.intro")}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{t("demo.lead.desc")}</p>
        </div>
        <DemoLeadForm />
        <button
          onClick={handleNewDemoFromLead}
          className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {t("demo.lead.skip")}
        </button>
      </div>
    );
  }

  if (phase === "preview" && selected) {
    const Icon = selected.icon;
    return (
      <div className="p-4 space-y-3">
        <button
          onClick={() => setPhase("list")}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("demo.preview.back")}
        </button>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">{selected.label}</div>
            <div className="text-[10px] text-muted-foreground leading-snug mt-0.5 break-words whitespace-normal">
              {selected.description}
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          className="w-full h-10 rounded-md pharmacy-gradient text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("demo.preview.analyze")}
        </button>

        <LegalDisclaimer />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">{t("demo.list.title")}</span>
        <span className="text-[10px] text-muted-foreground whitespace-pre-line">{t("demo.list.subtitle")}</span>
      </div>

      <div className="grid gap-1.5">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <button
              key={demo.id}
              onClick={() => handleSelect(demo.id)}
              className="group flex items-start gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="h-8 w-8 rounded-md bg-accent group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-tight">{demo.label}</div>
                <div className="text-[10px] text-muted-foreground leading-snug mt-0.5 break-words whitespace-normal">
                  {demo.description}
                </div>
              </div>
              <FileText className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary shrink-0 mt-1 transition-colors" />
            </button>
          );
        })}
      </div>

      <LegalDisclaimer />
    </div>
  );
};

export default WidgetDemo;
