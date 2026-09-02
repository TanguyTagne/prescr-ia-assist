import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Download,
  BarChart3,
  LogOut,
  Send,
  Loader2,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import DemoFullPanel from "@/components/DemoFullPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/hooks/useAnalytics";
import LanguageToggle from "@/i18n/LanguageToggle";

// Hardcoded fallback to the public Supabase project URL — VITE_SUPABASE_URL
// may be missing in the published bundle, which produced `undefined/functions/...`
// → 404 on the download link.
const SUPABASE_BASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://oknjfjplseopgymijnca.supabase.co";
const DOWNLOAD_URL = `${SUPABASE_BASE_URL}/functions/v1/download-app`;

const AccessRequestForm = () => {
  const { t, lp } = useI18n();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    pharmacy_name: "",
    contact_name: "",
    email: "",
    phone: "",
    city: "",
    lgo_type: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast.error(t("form.error.consent"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("access_requests" as any).insert(form as any);
      if (error) throw error;
      supabase.functions.invoke("notify-access-request", { body: form }).catch(console.error);
      setSubmitted(true);
      toast.success(t("form.success.toast"));
    } catch (err: any) {
      toast.error(err.message || t("form.error.toast"));
      supabase.functions.invoke("notify-form-error", {
        body: {
          form,
          errorMessage: err?.message || String(err),
          errorCode: err?.code,
          errorDetails:
            err?.details || err?.hint || (err?.stack ? String(err.stack).slice(0, 1000) : undefined),
          url: typeof window !== "undefined" ? window.location.href : undefined,
        },
      }).catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <p className="font-semibold">{t("form.submitted.title")}</p>
        <p className="text-sm text-muted-foreground">{t("form.submitted.desc")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        aria-label={t("form.pharmacy_name")}
        placeholder={t("form.pharmacy_name")}
        required
        value={form.pharmacy_name}
        onChange={(e) => setForm((f) => ({ ...f, pharmacy_name: e.target.value }))}
      />
      <Input
        aria-label={t("form.contact_name")}
        placeholder={t("form.contact_name")}
        required
        value={form.contact_name}
        onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
      />
      <Input
        aria-label={t("form.email")}
        type="email"
        placeholder={t("form.email")}
        required
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
      />
      <Input
        aria-label={t("form.phone")}
        placeholder={t("form.phone")}
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
      />
      <Input
        aria-label={t("form.lgo")}
        placeholder={t("form.lgo")}
        value={form.lgo_type}
        onChange={(e) => setForm((f) => ({ ...f, lgo_type: e.target.value }))}
      />

      <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          className="mt-0.5"
        />
        <span>
          {t("form.consent")}{" "}
          <Link to={lp("/confidentialite")} className="text-primary underline">
            {t("form.privacy")}
          </Link>{" "}
          {t("form.and")}{" "}
          <Link to={lp("/cgu")} className="text-primary underline">
            {t("form.terms")}
          </Link>
          .
        </span>
      </label>
      <Button
        type="submit"
        className="w-full h-12 text-sm font-semibold pharmacy-gradient border-0 gap-2"
        disabled={loading || !accepted}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="h-4 w-4" /> {t("form.submit")}
          </>
        )}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">{t("form.microcopy")}</p>
    </form>
  );
};

const Landing = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, lp } = useI18n();

  const objections = [
    { title: t("landing.obj.1.title"), desc: t("landing.obj.1.desc") },
    { title: t("landing.obj.2.title"), desc: t("landing.obj.2.desc") },
    { title: t("landing.obj.3.title"), desc: t("landing.obj.3.desc") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t("seo.landing.title")}
        description={t("seo.landing.desc")}
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Asclion",
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "PharmacyManagement",
          operatingSystem: "Web, Windows",
          description: t("seo.landing.desc"),
          url: "https://www.asclion.com",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
          audience: { "@type": "Audience", audienceType: "Pharmacists" },
          inLanguage: ["fr-FR", "en"],
        }}
      />
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg tracking-tight">Asclion</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(lp("/blog"))}
              className="gap-1.5 text-xs hidden sm:inline-flex"
            >
              Blog
            </Button>
            {user ? (
              <>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(lp("/admin"))}
                    className="gap-1.5 text-xs"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    {t("nav.admin")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(lp("/dashboard"))}
                  className="gap-1.5 text-xs"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  {t("nav.dashboard")}
                </Button>
                <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
                  <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    {t("nav.download")}
                  </a>
                </Button>
                <LanguageToggle />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </Button>
              </>
            ) : (
              <>
                <LanguageToggle />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(lp("/auth"))}
                  className="gap-1.5"
                >
                  {t("nav.signin")}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        {/* ===== HERO + FORM (single action above the fold) ===== */}
        <section className="relative py-14 md:py-20 px-4 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 15%, hsl(var(--pharmacy-green-light) / 0.55), transparent 70%)",
            }}
          />
          <div className="container max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-5 text-center lg:text-left">
              <h1 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight leading-[1.1]">
                {t("landing.h1")}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                {t("landing.h1.sub")}
              </p>
              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
                <Button
                  size="lg"
                  asChild
                  className="h-12 px-7 text-base font-semibold pharmacy-gradient border-0 gap-2 w-full sm:w-auto"
                >
                  <a href="#demande-acces">
                    <Send className="h-5 w-5" />
                    {t("form.submit")}
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 px-7 text-base font-semibold w-full sm:w-auto"
                >
                  <a href="#demo" onClick={() => trackEvent("demo_opened_hero", {})}>
                    <Sparkles className="h-5 w-5" />
                    {t("landing.hero.cta.demo")}
                  </a>
                </Button>
              </div>
              <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                {[t("landing.hero.trust1"), t("landing.hero.trust2"), t("landing.hero.trust3"), t("landing.hero.trust4")].map(
                  (item, i) => (
                    <li key={i} className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div
              id="demande-acces"
              className="rounded-2xl border border-border bg-card p-6 shadow-sm scroll-mt-20"
            >
              <h2 className="text-xl font-bold tracking-tight">{t("landing.form.title")}</h2>
              <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
                {t("landing.form.why")}
              </p>
              <AccessRequestForm />
            </div>
          </div>
        </section>

        {/* ===== PROOF: live demo of the actual product ===== */}
        <DemoFullPanel />

        {/* ===== 3 OBJECTIONS ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-8">
              {t("landing.obj.title")}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {objections.map((o, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-2">
                  <h3 className="font-semibold text-[15px]">{o.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== SOCIAL PROOF + GUARANTEE ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10 space-y-8">
              <div className="text-center space-y-3">
                <blockquote className="text-lg md:text-xl font-semibold leading-snug max-w-2xl mx-auto">
                  {t("landing.proof.quote")}
                </blockquote>
                <p className="text-xs text-muted-foreground">{t("landing.proof.author")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { v: t("landing.proof.kpi1.value"), l: t("landing.proof.kpi1.label") },
                  { v: t("landing.proof.kpi2.value"), l: t("landing.proof.kpi2.label") },
                  { v: t("landing.proof.kpi3.value"), l: t("landing.proof.kpi3.label") },
                ].map((k, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-background p-5 text-center space-y-1"
                  >
                    <div className="text-2xl font-extrabold text-primary tracking-tight">{k.v}</div>
                    <div className="text-xs text-muted-foreground">{k.l}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground italic">
                {t("landing.results.disclaimer")}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{t("landing.guarantee.title")}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("landing.guarantee.body")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-xl mx-auto text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t("landing.finalcta.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed">{t("landing.access.desc")}</p>
            <Button
              size="lg"
              asChild
              className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2"
            >
              <a href="#demande-acces">
                <Send className="h-5 w-5" />
                {t("form.submit")}
              </a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Landing;
