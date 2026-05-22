import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, Brain, ShieldCheck, MessageSquare, BarChart3, RefreshCw, Layers, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageToggle from "@/i18n/LanguageToggle";
import type { TranslationKey } from "@/i18n/translations";

const diffIcons = [ShieldCheck, Brain, MessageSquare, BarChart3, RefreshCw, Layers, Unlock];

export default function VsLgo() {
  const { t, lp } = useI18n();

  const differentiators = Array.from({ length: 7 }, (_, i) => {
    const n = i + 1;
    return {
      icon: diffIcons[i],
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
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/30 to-background relative overflow-hidden">
      <Seo
        title={t("seo.vslgo.title")}
        description={t("seo.vslgo.desc")}
        path="/vs-lgo"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/25 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-[35%] -left-40 h-[500px] w-[500px] rounded-full bg-pharmacy-teal/25 blur-3xl animate-pulse" style={{ animationDuration: "10s" }} />
        <div className="absolute bottom-0 right-1/4 h-[550px] w-[550px] rounded-full bg-pharmacy-warm/20 blur-3xl animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute top-[60%] right-[10%] h-[350px] w-[350px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--primary) / 0.15), transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <header className="border-b border-border/50 bg-background/70 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link to={lp("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t("vslgo.back")}
            </Link>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <span className="text-lg font-bold tracking-tight">Asclion</span>
            </div>
          </div>
        </header>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
            {t("vslgo.badge")}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Asclion <span className="text-muted-foreground/60">vs</span>{" "}
            <span className="bg-gradient-to-r from-primary to-pharmacy-teal bg-clip-text text-transparent">LGO</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("vslgo.subtitle")}
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-16">
          <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <p className="text-xl sm:text-2xl font-medium leading-relaxed text-center italic">
              {t("vslgo.pitch")}
            </p>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{t("vslgo.diff.title")}</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">{t("vslgo.diff.subtitle")}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {differentiators.map((d, i) => {
              const Icon = d.icon;
              return (
                <Card key={i} className="p-6 bg-card/70 backdrop-blur-sm border-border/60 hover:shadow-xl hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-pharmacy-teal flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                        {t("vslgo.diff.label")} {i + 1}
                      </div>
                      <h3 className="text-lg font-bold leading-tight">{d.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="p-3 rounded-md bg-destructive/5 border border-destructive/10">
                      <div className="flex items-center gap-2 mb-1">
                        <X className="h-3.5 w-3.5 text-destructive" />
                        <span className="font-semibold text-destructive">{t("vslgo.classic")}</span>
                      </div>
                      <p className="text-muted-foreground">{d.lgo}</p>
                    </div>

                    <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold text-primary">Asclion</span>
                      </div>
                      <p className="text-foreground">{d.asclion}</p>
                    </div>

                    <p className="text-xs italic text-muted-foreground pt-1">💬 {d.pitch}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{t("vslgo.table.title")}</h2>
          <p className="text-center text-muted-foreground mb-12">{t("vslgo.table.subtitle")}</p>

          <Card className="overflow-hidden bg-card/70 backdrop-blur-sm border-border/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-muted/60 to-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold">{t("vslgo.table.criteria")}</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground">{t("vslgo.table.lgo")}</th>
                    <th className="text-left p-4 font-semibold text-primary">Asclion</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{row.criteria}</td>
                      <td className="p-4 text-muted-foreground">
                        {typeof row.lgo === "boolean" ? (
                          row.lgo ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />
                        ) : (
                          row.lgo
                        )}
                      </td>
                      <td className="p-4">
                        {typeof row.asclion === "boolean" ? (
                          row.asclion ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />
                        ) : (
                          <span className="font-medium">{row.asclion}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 via-pharmacy-teal/5 to-pharmacy-warm/10 border-primary/20 backdrop-blur-sm shadow-xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("vslgo.cta.title")}</h2>
            <p className="text-muted-foreground mb-8 text-lg">{t("vslgo.cta.subtitle")}</p>
            <Link to={lp("/")}>
              <Button size="lg" className="pharmacy-gradient border-0 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                {t("vslgo.cta.button")}
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </Link>
          </Card>
        </section>

        <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
          <p>{t("vslgo.footer")}</p>
        </footer>
      </div>
    </div>
  );
}
