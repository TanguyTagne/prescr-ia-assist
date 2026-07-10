import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TrendingUp, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const fmtEUR = (n: number, lang: string) =>
  new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const fmtCA = (n: number, lang: string) =>
  new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(n);

const GainSimulator = () => {
  const { t, lang } = useI18n();
  const [caM, setCaM] = useState(2.6); // millions €

  const { basse, haute, tpj } = useMemo(() => {
    const ca = caM * 1_000_000;
    // Hypothèse : ~300 jours ouvrés/an, panier moyen 42€
    const transactionsParJour = ca / 42 / 300;
    const monthlyTransactions = transactionsParJour * 25;
    const basse = monthlyTransactions * 0.05 * 7 * 0.3;
    const haute = monthlyTransactions * 0.12 * 8 * 0.3;
    return { basse, haute, tpj: Math.round(transactionsParJour) };
  }, [caM]);

  const scrollToForm = () => {
    document.getElementById("demande-acces")?.scrollIntoView({ behavior: "smooth" });
  };

  const hint = t("landing.sim.result.hint").replace("{n}", String(tpj));

  return (
    <div className="glass-card rounded-2xl p-6 md:p-7 shadow-2xl shadow-primary/10 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[11px] font-medium">
          <Sparkles className="h-3 w-3" />
          {t("landing.sim.badge")}
        </div>
      </div>

      <h3 className="text-xl font-bold tracking-tight">{t("landing.sim.title")}</h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t("landing.sim.ca")}
            </label>
            <span className="text-lg font-bold text-primary tabular-nums">
              {fmtCA(caM, lang)} M€
            </span>
          </div>
          <Slider
            value={[caM]}
            min={0.8}
            max={6}
            step={0.1}
            onValueChange={(v) => setCaM(v[0])}
            aria-label={t("landing.sim.ca")}
          />
        </div>

      </div>


      <div className="rounded-xl bg-accent/70 border border-accent-foreground/10 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-accent-foreground/80 uppercase tracking-wide">
          <TrendingUp className="h-4 w-4" />
          {t("landing.sim.result.label")}
        </div>
        <div className="text-2xl md:text-3xl font-extrabold text-foreground tabular-nums leading-tight">
          {fmtEUR(basse, lang)} – {fmtEUR(haute, lang)}{" "}
          <span className="text-base font-semibold text-muted-foreground">
            {t("landing.sim.result.unit")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <Button
        onClick={scrollToForm}
        className="w-full h-11 text-sm font-semibold pharmacy-gradient border-0"
      >
        {t("landing.sim.cta")}
      </Button>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {t("landing.sim.disclaimer")}
      </p>
    </div>
  );
};

export default GainSimulator;
