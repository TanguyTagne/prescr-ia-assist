import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageToggle from "@/i18n/LanguageToggle";
import type { TranslationKey } from "@/i18n/translations";

export default function VsLgo() {
  const { t, lp } = useI18n();

  const differentiators = Array.from({ length: 7 }, (_, i) => {
    const n = i + 1;
    return {
      title: t(`vslgo.d${n}.title` as TranslationKey),
      lgo: t(`vslgo.d${n}.lgo` as TranslationKey),
      asclion: t(`vslgo.d${n}.asclion` as TranslationKey),
      pitch: t(`vslgo.d${n}.pitch` as TranslationKey),
    };
  });

  const comparisonRows: { criteria: string; lgo: string | boolean; asclion: string | boolean }[] = [
    { criteria: t("vslgo.row.logic"), lgo: t("vslgo.row.logic.lgo"), asclion: t("vslgo.row.logic.asclion") },
    { criteria: t("vslgo.row.funding"), lgo: t("vslgo.row.funding.lgo"), asclion: t("vslgo.row.funding.asclion") },
    { criteria: t("vslgo.row.phrase"), lgo: false, asclion: true },
    { criteria: t("vslgo.row.kpi"), lgo: t("vslgo.row.kpi.lgo"), asclion: t("vslgo.row.kpi.asclion") },
    { criteria: t("vslgo.row.learning"), lgo: false, asclion: true },
    { criteria: t("vslgo.row.portability"), lgo: false, asclion: t("vslgo.row.portability.asclion") },
    { criteria: t("vslgo.row.delay"), lgo: t("vslgo.row.delay.lgo"), asclion: t("vslgo.row.delay.asclion") },
    { criteria: t("vslgo.row.interactions"), lgo: t("vslgo.row.interactions.lgo"), asclion: t("vslgo.row.interactions.asclion") },
    { criteria: t("vslgo.row.latent"), lgo: false, asclion: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo title={t("seo.vslgo.title")} description={t("seo.vslgo.desc")} path="/vs-lgo" />

      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to={lp("/")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t("vslgo.back")}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <span className="font-semibold tracking-tight">Asclion</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-16">
        <p className="mono-label mb-8">{t("vslgo.badge")}</p>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.02em] leading-[1.05]">
          Asclion <span className="text-muted-foreground/50">vs</span> LGO
        </h1>
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          {t("vslgo.subtitle")}
        </p>
      </section>

      {/* PITCH */}
      <section className="border-y border-border bg-secondary/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-lg sm:text-xl leading-relaxed border-l-2 border-primary pl-6 text-foreground/90">
            {t("vslgo.pitch")}
          </p>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-baseline justify-between mb-12 border-b border-border pb-3">
          <h2 className="text-xl font-semibold tracking-tight">{t("vslgo.diff.title")}</h2>
          <span className="mono-label">07 points</span>
        </div>
        <p className="text-sm text-muted-foreground mb-10 max-w-2xl">{t("vslgo.diff.subtitle")}</p>

        <div className="space-y-12">
          {differentiators.map((d, i) => (
            <article key={i} className="grid grid-cols-[48px_1fr] gap-x-4 sm:gap-x-6">
              <div className="mono-label text-primary pt-1">{String(i + 1).padStart(2, "0")}</div>
              <div className="space-y-4">
                <h3 className="text-lg font-medium tracking-tight">{d.title}</h3>
                <dl className="grid sm:grid-cols-2 gap-px bg-border border border-border">
                  <div className="bg-background p-4 space-y-1.5">
                    <dt className="mono-label flex items-center gap-1.5">
                      <X className="h-3 w-3" /> {t("vslgo.classic")}
                    </dt>
                    <dd className="text-sm text-muted-foreground leading-relaxed">{d.lgo}</dd>
                  </div>
                  <div className="bg-background p-4 space-y-1.5">
                    <dt className="mono-label text-primary flex items-center gap-1.5">
                      <Check className="h-3 w-3" /> Asclion
                    </dt>
                    <dd className="text-sm text-foreground leading-relaxed">{d.asclion}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground italic">{d.pitch}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="border-t border-border bg-secondary/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
          <div className="flex items-baseline justify-between mb-8 border-b border-border pb-3">
            <h2 className="text-xl font-semibold tracking-tight">{t("vslgo.table.title")}</h2>
            <span className="mono-label">tableau</span>
          </div>
          <p className="text-sm text-muted-foreground mb-8">{t("vslgo.table.subtitle")}</p>

          <div className="overflow-x-auto border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left p-4 font-medium mono-label">{t("vslgo.table.criteria")}</th>
                  <th className="text-left p-4 font-medium mono-label">{t("vslgo.table.lgo")}</th>
                  <th className="text-left p-4 font-medium mono-label text-primary">Asclion</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="p-4 font-medium">{row.criteria}</td>
                    <td className="p-4 text-muted-foreground">
                      {typeof row.lgo === "boolean"
                        ? (row.lgo ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-muted-foreground/60" />)
                        : row.lgo}
                    </td>
                    <td className="p-4">
                      {typeof row.asclion === "boolean"
                        ? (row.asclion ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-muted-foreground/60" />)
                        : <span className="font-medium">{row.asclion}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
        <p className="mono-label mb-6">Étape suivante</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-4">{t("vslgo.cta.title")}</h2>
        <p className="text-muted-foreground mb-10">{t("vslgo.cta.subtitle")}</p>
        <Link to={lp("/")}>
          <Button size="lg" className="h-11 px-6 text-sm font-medium gap-2">
            {t("vslgo.cta.button")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-border py-8 text-center mono-label">
        {t("vslgo.footer")}
      </footer>
    </div>
  );
}
