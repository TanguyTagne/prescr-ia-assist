import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Download, BarChart3, LogOut, Zap, Send, Loader2, Settings, FolderSearch, ShieldCheck } from "lucide-react";
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
          <Link to={lp("/confidentialite")} className="text-primary underline">{t("form.privacy")}</Link>{" "}
          {t("form.and")}{" "}
          <Link to={lp("/cgu")} className="text-primary underline">{t("form.terms")}</Link>.
        </span>
      </label>
      <Button type="submit" className="w-full h-11 text-sm font-semibold pharmacy-gradient border-0 gap-2" disabled={loading || !accepted}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> {t("form.submit")}</>}
      </Button>
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
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
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
                <Button variant="outline" size="sm" onClick={() => navigate(lp("/auth"))} className="gap-1.5">
                  {t("nav.signin")}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4">
          <div className="container max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
              <Zap className="h-3 w-3" />
              {t("landing.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              {t("landing.title.line1")}
              <br />
              <span className="text-primary">{t("landing.title.line2")}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t("landing.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button size="lg" asChild className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2">
                <a href="#demande-acces">
                  <Send className="h-5 w-5" />
                  {t("landing.cta.access")}
                </a>
              </Button>
            </div>
          </div>
        </section>


        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">{t("landing.how.title")}</h2>
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

        <section id="demande-acces" className="py-16 px-4">
          <div className="container max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
                <Send className="h-7 w-7 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-bold">{t("landing.access.title")}</h2>
              <p className="text-muted-foreground leading-relaxed">{t("landing.access.desc")}</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
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
