import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Pill, FolderSearch, ShieldCheck, ArrowRight, Download, BarChart3, LogOut, Zap, Monitor, Send, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DOWNLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-app`;


const AccessRequestForm = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    setLoading(true);
    try {
      const { error } = await supabase.from("access_requests" as any).insert(form as any);
      if (error) throw error;
      // Notify admin by email (fire-and-forget)
      supabase.functions.invoke("notify-access-request", { body: form }).catch(console.error);
      setSubmitted(true);
      toast.success("Demande envoyée ! Nous reviendrons vers vous rapidement.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
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
        <p className="font-semibold">Demande envoyée !</p>
        <p className="text-sm text-muted-foreground">Nous vous contacterons pour créer votre accès.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Nom de la pharmacie *" required value={form.pharmacy_name} onChange={e => setForm(f => ({ ...f, pharmacy_name: e.target.value }))} />
        <Input placeholder="Nom du contact *" required value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
        <Input type="email" placeholder="Email *" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input placeholder="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input placeholder="Ville" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        <Input placeholder="LGO utilisé (ex: Winpharma, LGPI...)" value={form.lgo_type} onChange={e => setForm(f => ({ ...f, lgo_type: e.target.value }))} />
      </div>
      <Button type="submit" className="w-full h-11 text-sm font-semibold pharmacy-gradient border-0 gap-2" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Envoyer ma demande d'accès</>}
      </Button>
    </form>
  );
};

const Landing = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg pharmacy-gradient flex items-center justify-center">
              <Pill className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">PrescrIA</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1.5 text-xs">
                    <Settings className="h-3.5 w-3.5" />
                    Admin
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Dashboard
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
                <Pill className="h-3.5 w-3.5" />
                Se connecter
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main>
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
            <Zap className="h-3 w-3" />
            Copilote IA pour préparateurs en pharmacie
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Analysez chaque ordonnance
            <br />
            <span className="text-primary">en 3 secondes</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            PrescrIA détecte les interactions, génère les bonnes questions à poser au patient et suggère les produits complémentaires — directement au comptoir.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" asChild className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2">
              <a href="#demande-acces">
                <Send className="h-5 w-5" />
                Demander un accès
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-secondary/50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Comment ça marche</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FolderSearch,
                title: "Scannez ou tapez",
                desc: "Connectez votre scanner ou l'IA se charge de lire les médicaments prescrits. PrescrIA détecte automatiquement les nouveaux fichiers.",
              },
              {
                icon: Zap,
                title: "Analyse IA instantanée",
                desc: "L'IA identifie les interactions, le contexte thérapeutique et génère des questions pertinentes à poser au patient.",
              },
              {
                icon: ShieldCheck,
                title: "Suggestions au comptoir",
                desc: "Recevez des suggestions de produits complémentaires disponibles dans votre stock, avec des phrases conseils.",
              },
            ].map((f, i) => (
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

      {/* Access Request */}
      <section id="demande-acces" className="py-16 px-4">
        <div className="container max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
              <Send className="h-7 w-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Demander un accès</h2>
            <p className="text-muted-foreground leading-relaxed">
              Remplissez le formulaire ci-dessous, notre équipe vous créera un accès personnalisé lié à votre pharmacie et votre LGO.
            </p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card">
            <AccessRequestForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      </main>
      <footer className="border-t border-border py-6 px-4">
        <div className="container max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} PrescrIA</span>
          <span>Outil d'aide — ne remplace pas le jugement professionnel</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
