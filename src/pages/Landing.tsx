import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Download, BarChart3, LogOut, Send, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageToggle from "@/i18n/LanguageToggle";

const DOWNLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-app`;

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
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="h-10 w-10 rounded-full border border-primary/30 flex items-center justify-center mx-auto">
          <Send className="h-4 w-4 text-primary" />
        </div>
        <p className="font-medium text-sm">{t("form.submitted.title")}</p>
        <p className="text-sm text-muted-foreground">{t("form.submitted.desc")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder={t("form.pharmacy_name")} required value={form.pharmacy_name} onChange={e => setForm(f => ({ ...f, pharmacy_name: e.target.value }))} />
        <Input placeholder={t("form.contact_name")} required value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
        <Input type="email" placeholder={t("form.email")} required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input placeholder={t("form.phone")} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input placeholder={t("form.city")} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        <Input placeholder={t("form.lgo")} value={form.lgo_type} onChange={e => setForm(f => ({ ...f, lgo_type: e.target.value }))} />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
        <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
        <span>
          {t("form.consent")}{" "}
          <Link to={lp("/confidentialite")} className="text-primary underline underline-offset-2">{t("form.privacy")}</Link>{" "}
          {t("form.and")}{" "}
          <Link to={lp("/cgu")} className="text-primary underline underline-offset-2">{t("form.terms")}</Link>.
        </span>
      </label>
      <Button type="submit" className="w-full h-11 text-sm font-medium gap-2" disabled={loading || !accepted}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> {t("form.submit")}</>}
      </Button>
    </form>
  );
};

const Landing = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, lp } = useI18n();

  const steps = [
    { n: "01", title: t("landing.how.step1.title"), desc: t("landing.how.step1.desc") },
    { n: "02", title: t("landing.how.step2.title"), desc: t("landing.how.step2.desc") },
    { n: "03", title: t("landing.how.step3.title"), desc: t("landing.how.step3.desc") },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
          audience: { "@type": "Audience", audienceType: "Pharmacists" },
          inLanguage: ["fr-FR", "en"],
        }}
      />

      <nav className="border-b border-border bg-background">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight">Asclion</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 mono-label">
              <span className="status-dot" aria-hidden />
              en service
            </span>
          </div>
          <div className="flex items-center gap-1">
            {user ? (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(lp("/admin"))} className="gap-1.5 text-xs">
                    <Settings className="h-3.5 w-3.5" />
                    {t("nav.admin")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => navigate(lp("/dashboard"))} className="gap-1.5 text-xs">
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
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </Button>
              </>
            ) : (
              <>
                <LanguageToggle />
                <Button variant="ghost" size="sm" onClick={() => navigate(lp("/auth"))} className="text-xs">
                  {t("nav.signin")}
                </Button>
                <Button size="sm" asChild className="text-xs ml-1">
                  <a href="#demande-acces">{t("landing.cta.access")}</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* HERO */}
        <section className="container max-w-3xl mx-auto px-4 pt-24 pb-20 sm:pt-32 sm:pb-24">
          <p className="mono-label mb-8">{t("landing.badge")}</p>
          <h1 className="text-[2.5rem] sm:text-6xl font-semibold tracking-[-0.02em] leading-[1.05]">
            {t("landing.title.line1")}
            <br />
            <span className="text-muted-foreground">{t("landing.title.line2")}</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button size="lg" asChild className="h-11 px-6 text-sm font-medium gap-2">
              <a href="#demande-acces">
                {t("landing.cta.access")}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Link
              to={lp("/vs-lgo")}
              className="text-sm font-medium text-foreground hover:text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              {t("landing.cta.vsLgo")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-border">
          <div className="container max-w-5xl mx-auto px-4 py-20">
            <div className="flex items-baseline justify-between mb-12">
              <h2 className="text-xl font-semibold tracking-tight">{t("landing.how.title")}</h2>
              <span className="mono-label">03 étapes</span>
            </div>
            <div className="grid md:grid-cols-3 gap-px bg-border">
              {steps.map((s) => (
                <div key={s.n} className="bg-background p-6 sm:p-8 space-y-4">
                  <p className="mono-label text-primary">{s.n} / 03</p>
                  <h3 className="text-lg font-medium tracking-tight">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ACCESS REQUEST */}
        <section id="demande-acces" className="border-t border-border bg-secondary/40">
          <div className="container max-w-xl mx-auto px-4 py-20">
            <p className="mono-label mb-4">Démarrer</p>
            <h2 className="text-2xl font-semibold tracking-tight mb-3">{t("landing.access.title")}</h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{t("landing.access.desc")}</p>
            <div className="border-y border-border py-8">
              <AccessRequestForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Landing;
