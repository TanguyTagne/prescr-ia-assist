import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Send, AlertCircle } from "lucide-react";
import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import type { AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { trackDemoSession } from "@/lib/demoTracking";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/components/DemoLeadForm";
import { getStoredAttribution } from "@/lib/trackingAttribution";
import { toast } from "sonner";
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
  const { t, lp } = useI18n();
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const pendingQuery = useRef<string>("");

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

  // Le lead/CTA apparaît automatiquement 20 s après l'affichage des résultats.
  // À partir du 2ᵉ test sans email connu, on demande l'email (après les résultats).
  useEffect(() => {
    if (phase !== "result") return;
    const tm = setTimeout(() => {
      const uses = Number(localStorage.getItem(USES_KEY) || "0");
      const savedEmail = localStorage.getItem(EMAIL_KEY);
      if (uses >= 2 && !savedEmail) {
        trackEvent("demo_email_gate_shown", { medicament: pendingQuery.current });
        setPhase("gate");
      } else {
        trackEvent("demo_lead_auto_shown", { delay_s: 20 });
        setPhase("lead");
      }
    }, 20_000);
    return () => clearTimeout(tm);
  }, [phase]);

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

      setResult({
        medicaments: [res.medicament],
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
    pendingQuery.current = med;
    // Les résultats s'affichent toujours ; l'email est demandé après (phase "lead").
    runAnalysis(med);
  };

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setGateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-demo-lead", {
        body: {
          session_id: getSessionId(),
          nom: t("demo.gate.leadName"),
          officine: t("demo.gate.leadOfficine"),
          email: value,
          tracking_link_id: getStoredAttribution(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error("invalid");
      localStorage.setItem(EMAIL_KEY, value);
      trackEvent("demo_email_gate_submitted", {});
      runAnalysis(pendingQuery.current || query);
    } catch (err) {
      console.error(err);
      toast.error(t("demo.gate.error"));
    } finally {
      setGateLoading(false);
    }
  };

  const handleReset = () => setPhase("lead");

  const handleNewDemoFromLead = () => {
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

  if (phase === "gate") {
    return (
      <div className={`${c.wrap} animate-fade-in`}>
        <button
          onClick={() => setPhase("search")}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("demo.preview.back")}
        </button>
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Mail className="h-3.5 w-3.5" />
            {t("demo.gate.title")}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{t("demo.gate.desc")}</p>
        </div>
        <form onSubmit={handleGateSubmit} className="space-y-1.5">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("demo.lead.emailPh")}
            maxLength={255}
            className="w-full h-9 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={gateLoading}
            className="w-full h-9 rounded pharmacy-gradient text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity disabled:opacity-60"
          >
            {gateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t("demo.gate.submit")}
          </button>
        </form>
        <p className="text-[9px] text-muted-foreground leading-snug">
          {t("demo.lead.disclaimer")}{" "}
          <a href={lp("/confidentialite")} target="_blank" rel="noopener" className="underline hover:text-foreground">
            {t("demo.lead.privacyLink")}
          </a>
        </p>
      </div>
    );
  }

  if (phase === "lead") {
    const handleGoToForm = () => {
      trackEvent("demo_cta_to_form_clicked", { source: "widget_lead" });
      onClose?.();
      setTimeout(() => {
        const el = document.getElementById("demande-acces");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.location.href = "#demande-acces";
        }
      }, 50);
    };

    return (
      <div className={`${c.wrap} animate-fade-in`}>
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {t("demo.lead.intro")}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{t("demo.lead.desc")}</p>
        </div>
        <button
          onClick={handleGoToForm}
          className="w-full h-10 rounded-md pharmacy-gradient text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Send className="h-3.5 w-3.5" />
          {t("demo.lead.ctaForm")}
        </button>
        <button
          onClick={handleNewDemoFromLead}
          className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {t("demo.search.tryAnother")}
        </button>
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
