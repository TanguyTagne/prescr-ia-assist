import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetCookieConsent } from "@/lib/cookieConsent";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const Cookies = () => {
  const { t } = useI18n();
  return (
  <div className="min-h-screen bg-background">
    <Seo title={t("seo.legal.cookies.title")} description={t("seo.legal.cookies.desc")} path="/cookies" />
    <div className="container max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-3xl font-bold mb-2">Gestion des cookies</h1>
      <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="space-y-6 text-foreground text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">Qu'est-ce qu'un cookie ?</h2>
          <p>
            Un cookie est un petit fichier déposé sur votre terminal lors de la visite d'un site. Sur
            asclion.com, certains cookies sont strictement nécessaires au fonctionnement et à la
            sécurité du service ; d'autres ne sont déposés qu'avec votre consentement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Cookies utilisés</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 border-b border-border">Cookie</th>
                  <th className="text-left p-2 border-b border-border">Finalité</th>
                  <th className="text-left p-2 border-b border-border">Durée</th>
                  <th className="text-left p-2 border-b border-border">Catégorie</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-b border-border font-mono">sb-*-auth-token</td>
                  <td className="p-2 border-b border-border">Maintien de votre session connectée</td>
                  <td className="p-2 border-b border-border">Session</td>
                  <td className="p-2 border-b border-border">Strictement nécessaire</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-border font-mono">asclion_cookie_consent</td>
                  <td className="p-2 border-b border-border">Mémorise votre choix relatif aux cookies</td>
                  <td className="p-2 border-b border-border">6 mois</td>
                  <td className="p-2 border-b border-border">Strictement nécessaire</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-border font-mono">analytics_events (BDD)</td>
                  <td className="p-2 border-b border-border">Statistiques d'usage internes pseudonymisées</td>
                  <td className="p-2 border-b border-border">25 mois</td>
                  <td className="p-2 border-b border-border">Mesure d'audience (consentement)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Asclion n'utilise <strong>aucun cookie publicitaire ni traceur tiers</strong> (pas de
            Google Analytics, Meta Pixel, TikTok, LinkedIn Insight, etc.).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Gérer votre consentement</h2>
          <p className="mb-3">
            Vous pouvez à tout moment modifier vos préférences. Cliquez sur le bouton ci-dessous pour
            réafficher la bannière de choix.
          </p>
          <Button onClick={resetCookieConsent} variant="outline" size="sm">
            Modifier mes préférences cookies
          </Button>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Vos droits</h2>
          <p>
            Vous pouvez également configurer votre navigateur pour bloquer ou supprimer les cookies.
            Le blocage des cookies strictement nécessaires peut empêcher votre connexion au service.
            Pour toute question, consultez notre <Link to="/confidentialite" className="text-primary underline">politique de confidentialité</Link>.
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Cookies;
