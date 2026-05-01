import { useState } from "react";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStoredAttribution } from "@/lib/trackingAttribution";

const SESSION_KEY = "asclion_demo_session_id";

const getSessionId = () => {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const DemoLeadForm = () => {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nom, setNom] = useState("");
  const [officine, setOfficine] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !officine.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-demo-lead", {
        body: {
          session_id: getSessionId(),
          nom: nom.trim(),
          officine: officine.trim(),
          email: email.trim(),
          tracking_link_id: getStoredAttribution(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      setSubmitted(true);
      toast.success("Merci ! Nous vous recontactons rapidement.");
    } catch (err: any) {
      console.error(err);
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (dismissed) return null;

  if (submitted) {
    return (
      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-semibold">Merci {nom.split(" ")[0]} !</p>
          <p className="text-muted-foreground mt-0.5">Nous vous contactons sous 24h pour une démo personnalisée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3 relative">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="absolute top-1.5 right-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
      <p className="text-xs font-semibold pr-4">Cette démo vous parle ?</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
        Recevez une présentation personnalisée pour votre officine.
      </p>
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom"
          maxLength={100}
          required
          className="w-full h-8 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          value={officine}
          onChange={(e) => setOfficine(e.target.value)}
          placeholder="Officine"
          maxLength={150}
          required
          className="w-full h-8 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          maxLength={255}
          required
          className="w-full h-8 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full h-8 rounded pharmacy-gradient text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Être recontacté"}
        </button>
      </form>
      <p className="text-[9px] text-muted-foreground mt-1.5 leading-snug">
        En soumettant, vous acceptez d'être recontacté par Asclion. Données conservées 12 mois max.{" "}
        <a href="/legal/confidentialite" target="_blank" rel="noopener" className="underline hover:text-foreground">
          Politique de confidentialité
        </a>
      </p>
    </div>
  );
};

export default DemoLeadForm;
export { getSessionId };
