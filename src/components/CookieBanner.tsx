import { useEffect, useState } from "react";
import { Cookie, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "@/lib/cookieConsent";
import { useI18n } from "@/i18n/I18nProvider";

const CookieBanner = () => {
  const { lang, lp } = useI18n();
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
      aria-label={lang === "en" ? "Cookie preferences" : "Gestion des cookies"}
      className="fixed bottom-0 left-0 right-0 z-[10000] p-3 sm:p-4 pointer-events-none"
    >
      <div className="container max-w-3xl mx-auto pointer-events-auto rounded-xl border border-border bg-background shadow-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Cookie className="h-4 w-4 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{lang === "en" ? "Your cookie preferences" : "Vos préférences de cookies"}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {lang === "en"
                ? "Asclion only uses cookies that are strictly necessary for the service and, with your consent, anonymous usage statistics to improve the application. No advertising cookies or third-party trackers. "
                : "Asclion utilise uniquement des cookies strictement nécessaires au fonctionnement du service et, avec votre accord, des statistiques d'usage anonymes pour améliorer l'outil. Aucun cookie publicitaire ni traceur tiers. "}
              <Link to={lp("/cookies")} className="underline text-primary">{lang === "en" ? "Learn more" : "En savoir plus"}</Link>.
            </p>
          </div>
        </div>

        {showSettings && (
          <div className="space-y-2 pl-12">
            <div className="flex items-center justify-between rounded-md border border-border p-3 bg-muted/30">
              <div>
                <p className="text-xs font-medium">{lang === "en" ? "Strictly necessary" : "Strictement nécessaires"}</p>
                <p className="text-[11px] text-muted-foreground">{lang === "en" ? "Authentication, security and remembering your choice." : "Authentification, sécurité, mémorisation du choix."}</p>
              </div>
              <Switch checked disabled aria-label={lang === "en" ? "Always active" : "Toujours actif"} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-xs font-medium">{lang === "en" ? "Anonymous audience measurement" : "Mesure d'audience anonyme"}</p>
                <p className="text-[11px] text-muted-foreground">{lang === "en" ? "Pseudonymised internal statistics, without third parties." : "Statistiques internes pseudonymisées, sans tiers."}</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label={lang === "en" ? "Enable audience measurement" : "Activer la mesure d'audience"} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {!showSettings ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
                 <Settings2 className="h-3.5 w-3.5" /> {lang === "en" ? "Customise" : "Personnaliser"}
              </Button>
              <Button variant="outline" size="sm" onClick={refuseAll}>
                 {lang === "en" ? "Reject all" : "Tout refuser"}
              </Button>
              <Button size="sm" onClick={acceptAll} className="pharmacy-gradient border-0">
                 {lang === "en" ? "Accept all" : "Tout accepter"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                 {lang === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button size="sm" onClick={saveCustom} className="pharmacy-gradient border-0">
                 {lang === "en" ? "Save my choices" : "Enregistrer mes choix"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
