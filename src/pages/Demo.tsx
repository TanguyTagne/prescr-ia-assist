import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/hooks/useAnalytics";

const Demo = () => {
  const location = useLocation();
  const source = new URLSearchParams(location.search).get("source") || "demo_page";
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
    robot: "",
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast.error("Merci d'accepter la politique de confidentialité.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        pharmacy_name: form.pharmacy_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        lgo_type: `Démo 15 min · LGO: ${form.lgo_type || "n/c"} · Robot: ${form.robot || "non"} · Source: ${source}`,
      };
      const { error } = await supabase.from("access_requests" as any).insert(payload as any);
      if (error) throw error;
      supabase.functions.invoke("notify-access-request", { body: payload }).catch(console.error);
      trackEvent("demo_requested", { source });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Envoi impossible, réessayez.");
      supabase.functions.invoke("notify-form-error", {
        body: { form, errorMessage: err?.message || String(err), url: window.location.href },
      }).catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Demander une démo Asclion — 15 minutes"
        description="En 15 minutes, voyez comment Asclion s'intègre à votre comptoir et posez vos questions de compatibilité."
        path="/demo"
      />
      <SiteHeader />

      <main className="px-4 py-14">
        <div className="container max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight">Demander une démo de 15 min</h1>
            <p className="text-muted-foreground leading-relaxed">
              En 15 minutes, voyez comment Asclion s'intègre à votre comptoir et posez vos questions
              de compatibilité.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="font-semibold text-lg">Demande envoyée</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nous revenons vers vous rapidement pour convenir d'un créneau de 15 minutes.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-card p-6 space-y-4"
            >
              <div>
                <Label htmlFor="pharmacy">Officine *</Label>
                <Input id="pharmacy" required value={form.pharmacy_name} onChange={(e) => set({ pharmacy_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contact">Nom du contact *</Label>
                <Input id="contact" required value={form.contact_name} onChange={(e) => set({ contact_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">E-mail professionnel *</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Téléphone (facultatif)</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lgo">LGO utilisé</Label>
                  <Input id="lgo" value={form.lgo_type} onChange={(e) => set({ lgo_type: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="robot">Robot éventuel (marque / modèle)</Label>
                  <Input id="robot" value={form.robot} onChange={(e) => set({ robot: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <span>
                  J'accepte que mes données soient utilisées pour être recontacté, conformément à la{" "}
                  <a href="/confidentialite" target="_blank" className="text-primary underline">
                    politique de confidentialité
                  </a>
                  . *
                </span>
              </label>

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold pharmacy-gradient border-0 gap-2"
                disabled={loading || !accepted}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Demander ma démo
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Demo;
