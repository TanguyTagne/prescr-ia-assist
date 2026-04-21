import { useEffect, useState } from "react";
import { Cookie, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "@/lib/cookieConsent";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const check = () => setVisible(getCookieConsent() === null);
    check();
    window.addEventListener("asclion:cookie-consent-reset", check);
    return () => window.removeEventListener("asclion:cookie-consent-reset", check);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    setCookieConsent({ analytics: true });
    setVisible(false);
  };
  const refuseAll = () => {
    setCookieConsent({ analytics: false });
    setVisible(false);
  };
  const saveCustom = () => {
    setCookieConsent({ analytics });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Gestion des cookies"
      className="fixed bottom-0 left-0 right-0 z-[10000] p-3 sm:p-4 pointer-events-none"
    >
      <div className="container max-w-3xl mx-auto pointer-events-auto rounded-xl border border-border bg-background shadow-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Cookie className="h-4 w-4 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Vos préférences de cookies</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              Asclion utilise uniquement des cookies strictement nécessaires au fonctionnement du
              service et, avec votre accord, des statistiques d'usage anonymes pour améliorer
              l'outil. Aucun cookie publicitaire ni traceur tiers.{" "}
              <Link to="/cookies" className="underline text-primary">En savoir plus</Link>.
            </p>
          </div>
        </div>

        {showSettings && (
          <div className="space-y-2 pl-12">
            <div className="flex items-center justify-between rounded-md border border-border p-3 bg-muted/30">
              <div>
                <p className="text-xs font-medium">Strictement nécessaires</p>
                <p className="text-[11px] text-muted-foreground">Authentification, sécurité, mémorisation du choix.</p>
              </div>
              <Switch checked disabled aria-label="Toujours actif" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-xs font-medium">Mesure d'audience anonyme</p>
                <p className="text-[11px] text-muted-foreground">Statistiques internes pseudonymisées, sans tiers.</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Activer la mesure d'audience" />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {!showSettings ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" /> Personnaliser
              </Button>
              <Button variant="outline" size="sm" onClick={refuseAll}>
                Tout refuser
              </Button>
              <Button size="sm" onClick={acceptAll} className="pharmacy-gradient border-0">
                Tout accepter
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={saveCustom} className="pharmacy-gradient border-0">
                Enregistrer mes choix
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
