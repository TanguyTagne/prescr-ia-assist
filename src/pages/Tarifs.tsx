import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/hooks/useAnalytics";
import { useEffect } from "react";

type Cycle = "monthly" | "annual";

const COMPARISON: { label: string; classic: boolean; premium: boolean }[] = [
  { label: "Base de 30 000+ médicaments", classic: true, premium: true },
  { label: "Suggestion, vigilance et phrase conseil", classic: true, premium: true },
  { label: "Apprentissage selon les retours équipe", classic: true, premium: true },
  { label: "Audit initial du stock", classic: false, premium: true },
  { label: "Suggestions sur mesure selon le stock", classic: false, premium: true },
  { label: "Actualisation du stock", classic: false, premium: true },
];

const Tarifs = () => {
  const { lp } = useI18n();
  const location = useLocation();
  const [cycle, setCycle] = useState<Cycle>("annual");

  useEffect(() => {
    trackEvent("pricing_view", { source: new URLSearchParams(location.search).get("source") || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = location.search || "";

  const offers = cycle === "monthly"
    ? [
        {
          plan: "classic_monthly",
          name: "Classique",
          price: "99 € HT/mois",
          due: "198 € HT dus aujourd'hui",
          setup: "Mise en place : 99 € HT une fois",
          renewal: "Renouvellement mensuel, jusqu'à résiliation",
        },
        {
          plan: "premium_monthly",
          name: "Premium",
          price: "149 € HT/mois",
          due: "248 € HT dus aujourd'hui",
          setup: "Mise en place : 99 € HT une fois",
          renewal: "Renouvellement mensuel, jusqu'à résiliation",
        },
      ]
    : [
        {
          plan: "classic_yearly",
          name: "Classique",
          price: "990 € HT/an",
          due: "990 € HT dus aujourd'hui",
          setup: "Mise en place offerte",
          renewal: "Aucun renouvellement automatique",
          saving:
            "297 € HT économisés la première année vs mensuel + mise en place ; 198 € HT les années suivantes.",
        },
        {
          plan: "premium_yearly",
          name: "Premium",
          price: "1 490 € HT/an",
          due: "1 490 € HT dus aujourd'hui",
          setup: "Mise en place offerte",
          renewal: "Aucun renouvellement automatique",
          saving:
            "397 € HT économisés la première année vs mensuel + mise en place ; 298 € HT les années suivantes.",
        },
      ];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Tarifs Asclion — Classique et Premium, par officine, caisses illimitées"
        description="Classique dès 99 € HT/mois, Premium dès 149 € HT/mois. Offres annuelles sans renouvellement automatique. Tous les prix HT, par officine, caisses illimitées."
        path="/tarifs"
      />
      <SiteHeader />

      <main className="px-4 py-14">
        <div className="container max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Une offre par officine. Pas par caisse.
            </h1>
            <p className="text-muted-foreground">
              Tous les prix sont HT. Caisses illimitées. Activation sous 24 à 48 h après validation.
            </p>
          </div>

          {/* Bascule périodicité */}
          <div
            role="radiogroup"
            aria-label="Périodicité"
            className="flex justify-center gap-2"
          >
            {(
              [
                { v: "monthly", label: "Mensuel" },
                { v: "annual", label: "Annuel — paiement d'avance" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                role="radio"
                aria-checked={cycle === o.v}
                onClick={() => setCycle(o.v)}
                className={`h-11 px-5 rounded-full border text-sm font-semibold transition-colors ${
                  cycle === o.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {offers.map((o) => (
              <div
                key={o.plan}
                className="rounded-2xl border border-border bg-card p-7 space-y-4 flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{o.name}</h2>
                  {cycle === "annual" && <Badge>Mise en place offerte</Badge>}
                </div>
                <p className="text-3xl font-extrabold text-primary tracking-tight">{o.price}</p>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{o.due}</p>
                  <p className="text-muted-foreground">{o.setup}</p>
                  <p className="text-muted-foreground">{o.renewal}</p>
                  {"saving" in o && o.saving && (
                    <p className="text-primary font-medium">{o.saving}</p>
                  )}
                </div>
                <ul className="space-y-2 text-sm flex-1">
                  {COMPARISON.map((c) => {
                    const included = o.name === "Premium" ? c.premium : c.classic;
                    return (
                      <li key={c.label} className="flex gap-2">
                        {included ? (
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                        )}
                        <span className={included ? "" : "text-muted-foreground/70"}>
                          {c.label}
                          {c.label === "Actualisation du stock" && included && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {cycle === "monthly" ? "mensuelle" : "hebdomadaire"}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  size="lg"
                  asChild
                  className="w-full h-12 font-semibold pharmacy-gradient border-0 gap-2"
                >
                  <Link
                    to={lp("/souscrire") + `?plan=${o.plan}${src ? "&" + src.slice(1) : ""}`}
                    onClick={() => trackEvent("pricing_plan_chosen", { plan: o.plan })}
                  >
                    Choisir {o.name} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground space-y-2 max-w-3xl mx-auto">
            {cycle === "annual" ? (
              <>
                <p>Formation visio et suivis J+14 / J+30 inclus.</p>
                <p>
                  Un e-mail vous est envoyé un mois avant l'échéance. Vous renouvelez uniquement si
                  vous le confirmez — aucun renouvellement automatique.
                </p>
              </>
            ) : (
              <p>
                Résiliable à tout moment ; effet à la fin de la période déjà payée. Aucun
                remboursement commercial au prorata en cas d'arrêt anticipé, sous réserve des droits
                légaux applicables.
              </p>
            )}
            <p>
              Paiement par carte ; prélèvement SEPA disponible sur les offres mensuelles ; virement
              sur facture sur demande.
            </p>
            <p>
              Un robot de délivrance ?{" "}
              <Link to={lp("/compatibilite-robot")} className="text-primary underline">
                Vérifiez la compatibilité avant l'achat
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Tarifs;
