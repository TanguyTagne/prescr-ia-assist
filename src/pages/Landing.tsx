import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Pill, Zap, FolderSearch, ShieldCheck, ArrowRight, Download, LogIn, BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const Landing = () => {
  const { user, signOut } = useAuth();
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
                <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="gap-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5" />
                  Ouvrir l'app
                </Button>
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
                <LogIn className="h-3.5 w-3.5" />
                Se connecter
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
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
            {user ? (
              <Button size="lg" onClick={() => navigate("/app")} className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2">
                Ouvrir PrescrIA
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => navigate("/auth")} className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 gap-2">
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
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
                desc: "Connectez votre scanner ou tapez les noms des médicaments. PrescrIA détecte automatiquement les nouveaux fichiers.",
              },
              {
                icon: Zap,
                title: "Analyse IA instantanée",
                desc: "L'IA identifie les interactions, le contexte thérapeutique et génère 2 questions pertinentes à poser au patient.",
              },
              {
                icon: ShieldCheck,
                title: "Suggestions au comptoir",
                desc: "Recevez des suggestions de produits complémentaires avec une phrase conseil prête à dire, sans jamais diagnostiquer.",
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

      {/* Install section */}
      <section className="py-16 px-4">
        <div className="container max-w-2xl mx-auto text-center space-y-6">
          <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
            <Download className="h-7 w-7 text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Installez PrescrIA sur votre poste</h2>
          <p className="text-muted-foreground leading-relaxed">
            PrescrIA s'installe comme une application native sur le PC du préparateur. Ouvrez-la une fois le matin, elle reste active toute la journée.
          </p>
          <div className="glass-card rounded-xl p-6 text-left space-y-4">
            <h3 className="font-semibold text-sm">Installation en 2 étapes :</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Ouvrez PrescrIA dans <strong>Chrome</strong> ou <strong>Edge</strong> sur le PC du préparateur</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Cliquez sur l'icône <strong>« Installer »</strong> dans la barre d'adresse ou sur le bouton qui apparaît en bas de l'écran</span>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Une icône PrescrIA apparaîtra sur le bureau. L'app s'ouvre en fenêtre dédiée, sans barre de navigateur.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="container max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} PrescrIA</span>
          <span>Outil d'aide — ne remplace pas le jugement professionnel</span>
        </div>
      </footer>

      <PWAInstallPrompt />
    </div>
  );
};

export default Landing;
