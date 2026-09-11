import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Send, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/hooks/useAnalytics";

const CompatibiliteRobot = () => {
  const location = useLocation();
  const source = new URLSearchParams(location.search).get("source") || "compatibilite_page";
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    pharmacy_name: "",
    siret: "",
    contact_name: "",
    email: "",
    robot_brand: "",
    robot_model: "",
    lgo_type: "",
    registers: "",
    message: "",
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
        phone: "",
        city: form.siret ? `SIRET ${form.siret}` : "",
        lgo_type:
          `COMPATIBILITÉ ROBOT · Robot: ${form.robot_brand} ${form.robot_model} · LGO: ${form.lgo_type || "n/c"}` +
          ` · Caisses: ${form.registers || "n/c"} · Source: ${source}` +
          (form.message ? ` · Message: ${form.message}` : ""),
      };
      const { error } = await supabase.from("access_requests" as any).insert(payload as any);
      if (error) throw error;
      supabase.functions.invoke("notify-access-request", { body: payload }).catch(console.error);
      trackEvent("robot_compatibility_requested", { source });
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
        title="Compatibilité robot — Asclion"
        description="Votre officine utilise un robot de délivrance ? Vérifiez la compatibilité avec Asclion avant toute souscription."
        path="/compatibilite-robot"
      />
      <SiteHeader />

      <main className="px-4 py-14">
        <div className="container max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <Bot className="h-9 w-9 text-primary mx-auto" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              Vérifier la compatibilité de votre robot
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Votre robot nécessite une vérification de compatibilité avant souscription. Envoyez la
              demande ; nous vous répondrons avant de vous proposer le paiement.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="font-semibold text-lg">Demande envoyée</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nous étudions la compatibilité de votre robot et revenons vers vous avant toute
                souscription. Aucun paiement ne vous sera demandé avant cette validation.
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
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" value={form.siret} onChange={(e) => set({ siret: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="contact">Contact *</Label>
                  <Input id="contact" required value={form.contact_name} onChange={(e) => set({ contact_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="email">E-mail professionnel *</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Marque du robot *</Label>
                  <Input id="brand" required value={form.robot_brand} onChange={(e) => set({ robot_brand: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="model">Modèle *</Label>
                  <Input id="model" required value={form.robot_model} onChange={(e) => set({ robot_model: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lgo">LGO utilisé</Label>
                  <Input id="lgo" value={form.lgo_type} onChange={(e) => set({ lgo_type: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="registers">Nombre de caisses</Label>
                  <Input id="registers" type="number" min={1} max={50} value={form.registers} onChange={(e) => set({ registers: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Message libre</Label>
                <Textarea id="message" rows={3} value={form.message} onChange={(e) => set({ message: e.target.value })} />
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <span>
                  J'accepte que mes données soient utilisées pour traiter ma demande, conformément à
                  la{" "}
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
                Vérifier ma compatibilité
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default CompatibiliteRobot;
