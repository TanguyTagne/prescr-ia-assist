import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Download,
  BarChart3,
  LogOut,
  Zap,
  Send,
  Loader2,
  Settings,
  FolderSearch,
  ShieldCheck,
  Gift,
  Users,
  Infinity as InfinityIcon,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import GainSimulator from "@/components/GainSimulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
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
  const [showMore, setShowMore] = useState(false);
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

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {t("form.more")}
        </button>
      ) : (
        <div className="space-y-3 pt-1">
          <Input
            aria-label={t("form.contact_name")}
            placeholder={t("form.contact_name")}
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              aria-label={t("form.city")}
              placeholder={t("form.city")}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              aria-label={t("form.lgo")}
              placeholder={t("form.lgo")}
              value={form.lgo_type}
              onChange={(e) => setForm((f) => ({ ...f, lgo_type: e.target.value }))}
            />
          </div>
        </div>
      )}

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

  const features = [
    { icon: FolderSearch, title: t("landing.how.step1.title"), desc: t("landing.how.step1.desc") },
    { icon: Zap, title: t("landing.how.step2.title"), desc: t("landing.how.step2.desc") },
    { icon: ShieldCheck, title: t("landing.how.step3.title"), desc: t("landing.how.step3.desc") },
  ];

  const stackItems = [
    { title: t("landing.stack.item1.title"), value: t("landing.stack.item1.value") },
    { title: t("landing.stack.item3.title"), value: t("landing.stack.item3.value") },
    { title: t("landing.stack.item4.title"), value: t("landing.stack.item4.value") },
    { title: t("landing.stack.item5.title"), value: t("landing.stack.item5.value") },
    { title: t("landing.stack.item6.title"), value: t("landing.stack.item6.value") },
  ];

  const forWhomYes = [
    t("landing.forwhom.yes.1"),
    t("landing.forwhom.yes.2"),
    t("landing.forwhom.yes.3"),
  ];
  const forWhomNo = [t("landing.forwhom.no.1"), t("landing.forwhom.no.2")];

  const faqs = [
    { q: t("landing.faq.q1"), a: t("landing.faq.a1") },
    { q: t("landing.faq.q2"), a: t("landing.faq.a2") },
    { q: t("landing.faq.q3"), a: t("landing.faq.a3") },
    { q: t("landing.faq.q4"), a: t("landing.faq.a4") },
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
        {/* ===== HERO ===== */}
        <section className="relative py-16 md:py-20 px-4 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 20%, hsl(var(--pharmacy-green-light) / 0.55), transparent 70%)",
            }}
          />
          <div className="container max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                <Sparkles className="h-3 w-3" />
                {t("landing.hero.badge")}
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                {t("landing.hero.title.line1")}{" "}
                <span className="text-primary">{t("landing.hero.title.amount")}</span>{" "}
                {t("landing.hero.title.line2")}
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t("landing.hero.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 pt-2">
                <Button
                  size="lg"
                  asChild
                  className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2"
                >
                  <a href="#demande-acces">
                    <Send className="h-5 w-5" />
                    {t("landing.hero.cta.primary")}
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base gap-2">
                  <a href="#garantie">
                    <ShieldCheck className="h-5 w-5" />
                    {t("landing.hero.cta.secondary")}
                  </a>
                </Button>
              </div>
              <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-2">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {t("landing.hero.trust1")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {t("landing.hero.trust2")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {t("landing.hero.trust3")}
                </li>
              </ul>
            </div>
            <div className="lg:pl-4">
              <GainSimulator />
            </div>
          </div>
        </section>

        {/* ===== PROOF ===== */}
        <section className="py-14 px-4">
          <div className="container max-w-4xl mx-auto">
            <div className="pharmacy-gradient rounded-2xl p-[1px]">
              <div className="rounded-2xl bg-card p-8 md:p-10 space-y-8">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {t("landing.proof.badge")}
                  </div>
                  <blockquote className="text-xl md:text-2xl font-semibold leading-snug text-foreground max-w-3xl mx-auto">
                    {t("landing.proof.quote")}
                  </blockquote>
                  <p className="text-sm text-muted-foreground">{t("landing.proof.author")}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {[
                    { v: t("landing.proof.kpi1.value"), l: t("landing.proof.kpi1.label") },
                    { v: t("landing.proof.kpi2.value"), l: t("landing.proof.kpi2.label") },
                    { v: t("landing.proof.kpi3.value"), l: t("landing.proof.kpi3.label") },
                  ].map((k, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-background p-5 text-center space-y-1"
                    >
                      <div className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
                        {k.v}
                      </div>
                      <div className="text-xs text-muted-foreground">{k.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 tracking-tight">
              {t("landing.how.title")}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div key={i} className="glass-card rounded-xl p-6 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== VALUE STACK ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {t("landing.stack.title")}
              </h2>
              <p className="text-muted-foreground">{t("landing.stack.subtitle")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <ul className="divide-y divide-border">
                {stackItems.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 p-4 md:px-6">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                      <span className="text-sm md:text-[15px] font-medium">{it.title}</span>
                      <span className="text-xs text-muted-foreground md:text-right whitespace-nowrap">
                        {it.value}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="p-5 md:px-6 bg-secondary/60 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("landing.stack.total.label")}</span>
                  <span className="font-semibold line-through decoration-muted-foreground/60">
                    {t("landing.stack.total.value")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("landing.stack.price.label")}</span>
                  <span className="text-base md:text-lg font-bold text-primary text-right">
                    {t("landing.stack.price.value")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== GUARANTEE ===== */}
        <section id="garantie" className="py-16 px-4">
          <div className="container max-w-3xl mx-auto">
            <div className="pharmacy-gradient rounded-2xl p-[1px]">
              <div className="rounded-2xl bg-background p-8 md:p-10 text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {t("landing.guarantee.badge")}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {t("landing.guarantee.title")}
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                  {t("landing.guarantee.body")}
                </p>
                <p className="text-xs text-muted-foreground italic max-w-xl mx-auto">
                  {t("landing.guarantee.footnote")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FOR WHOM ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto space-y-10">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight">
              {t("landing.forwhom.title")}
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {t("landing.forwhom.yes.title")}
                </h3>
                <ul className="space-y-2.5">
                  {forWhomYes.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-semibold text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  {t("landing.forwhom.no.title")}
                </h3>
                <ul className="space-y-2.5">
                  {forWhomNo.filter(line => line.trim() !== "").map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight">
              {t("landing.faq.title")}
            </h2>
            <Accordion type="single" collapsible className="rounded-xl border border-border bg-card">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="px-5">
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ===== ACCESS FORM ===== */}
        <section id="demande-acces" className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-xl mx-auto space-y-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm text-foreground leading-relaxed">
                {t("landing.urgency.text")}
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
                <Send className="h-7 w-7 text-accent-foreground" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {t("landing.access.title")}
              </h2>
              <p className="text-muted-foreground leading-relaxed">{t("landing.access.desc")}</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
              <AccessRequestForm />
            </div>
          </div>
        </section>

        {/* ===== REFERRAL (moved after form, as bonus) ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-5xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10 space-y-8">
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center mx-auto">
                  <Gift className="h-6 w-6 text-accent-foreground" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {t("landing.referral.title")}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t("landing.referral.subtitle")}
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: Gift, title: t("landing.referral.card1.title"), desc: t("landing.referral.card1.desc") },
                  { icon: Users, title: t("landing.referral.card2.title"), desc: t("landing.referral.card2.desc") },
                  { icon: InfinityIcon, title: t("landing.referral.card3.title"), desc: t("landing.referral.card3.desc") },
                ].map((c, i) => (
                  <div key={i} className="glass-card rounded-xl p-5 space-y-2">
                    <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
                      <c.icon className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <h3 className="font-semibold text-sm">{c.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <Button variant="outline" asChild className="gap-2">
                  <a href="#demande-acces">
                    <Gift className="h-4 w-4" />
                    {t("landing.referral.cta")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Landing;
