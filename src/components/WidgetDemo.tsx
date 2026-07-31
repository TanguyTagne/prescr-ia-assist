import { useState, useEffect, useRef } from "react";
import { Sparkles, Search, Loader2, ArrowLeft, Send, Mail, AlertCircle } from "lucide-react";
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

type Phase = "search" | "gate" | "analyzing" | "result" | "lead";

const USES_KEY = "asclion_demo_uses";
const EMAIL_KEY = "asclion_demo_email";

const EXAMPLES = ["Amoxicilline", "Doliprane", "Ventoline", "Levothyrox", "Ibuprofène"];

interface WidgetDemoProps {
  onClose?: () => void;
}

const WidgetDemo = ({ onClose }: WidgetDemoProps) => {
  const { t, lp } = useI18n();
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const pendingQuery = useRef<string>("");

  // ── Autocomplete (public edge function) ──
  useEffect(() => {
    if (phase !== "search" || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const tm = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("demo-med-lookup", {
          body: { mode: "suggest", query: query.trim() },
        });
        setSuggestions(((data as any)?.suggestions || []).slice(0, 5));
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(tm);
  }, [query, phase]);

  // Le lead/CTA apparaît automatiquement 20 s après l'affichage des résultats.
  useEffect(() => {
    if (phase !== "result") return;
    const tm = setTimeout(() => {
      trackEvent("demo_lead_auto_shown", { delay_s: 20 });
      setPhase("lead");
    }, 20_000);
    return () => clearTimeout(tm);
  }, [phase]);

  const runAnalysis = async (med: string) => {
    setNotFound(false);
    setResult(null);
    setSuggestions([]);
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

    const uses = Number(localStorage.getItem(USES_KEY) || "0");
    const savedEmail = localStorage.getItem(EMAIL_KEY);
    // À partir du 2ᵉ test, l'email est obligatoire
    if (uses >= 1 && !savedEmail) {
      pendingQuery.current = med;
      trackEvent("demo_email_gate_shown", { medicament: med });
      setPhase("gate");
      return;
    }
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

  if (phase === "gate") {
    return (
      <div className="p-4 space-y-3 animate-fade-in">
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
      <div className="p-4 space-y-3 animate-fade-in">
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
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">{t("demo.list.title")}</span>
        <span className="text-[10px] text-muted-foreground">{t("demo.search.subtitle")}</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitSearch();
        }}
        className="space-y-1.5"
      >
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound(false);
            }}
            placeholder={t("demo.search.placeholder")}
            maxLength={120}
            aria-label={t("demo.search.placeholder")}
            className="w-full h-9 pl-7 pr-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {suggestions.length > 0 && (
          <ul className="rounded border border-border bg-card divide-y divide-border overflow-hidden">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => handleSubmitSearch(s)}
                  className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        {notFound && (
          <p className="flex items-start gap-1 text-[10px] text-destructive leading-snug">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            {t("demo.search.notFound")}
          </p>
        )}

        <button
          type="submit"
          disabled={query.trim().length < 2}
          className="w-full h-10 rounded-md pharmacy-gradient text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("demo.search.analyze")}
        </button>
      </form>

      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{t("demo.search.examples")}</div>
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => handleSubmitSearch(ex)}
              className="px-2 py-1 rounded-full border border-border bg-card text-[10px] hover:border-primary hover:bg-accent transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <LegalDisclaimer />
    </div>
  );
};

export default WidgetDemo;
