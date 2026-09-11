import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/hooks/useAnalytics";
import vslVideo from "@/assets/asclion-vsl.mp4.asset.json";

const MILESTONES = [25, 50, 75, 100];

const Presentation = () => {
  const { lp } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const reached = useRef<Set<number>>(new Set());

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = Math.round((v.currentTime / v.duration) * 100);
    for (const m of MILESTONES) {
      if (pct >= m && !reached.current.has(m)) {
        reached.current.add(m);
        trackEvent("vsl_progress", { percent: m });
      }
    }
  };

  const start = () => {
    setStarted(true);
    trackEvent("vsl_started", { source: "presentation" });
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Présentation Asclion — le conseil associé au comptoir, sans changer de LGO"
        description="Regardez la présentation complète d'Asclion : vigilance, suggestion de produit complémentaire et phrase conseil au scan d'un médicament."
        path="/presentation"
      />
      <SiteHeader />

      <main className="px-4 py-14">
        <div className="container max-w-3xl mx-auto space-y-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center leading-tight">
            Asclion, en quelques minutes
          </h1>

          <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <video
              ref={videoRef}
              src={vslVideo.url}
              className="w-full aspect-video object-cover bg-black"
              muted
              playsInline
              controls={started}
              preload="metadata"
              onTimeUpdate={onTimeUpdate}
            />
            {!started && (
              <button
                onClick={start}
                className="absolute inset-0 flex items-center justify-center bg-black/30"
                aria-label="Lire la présentation Asclion"
              >
                <span className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl">
                  <Play className="h-9 w-9 ml-1" />
                </span>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            La vidéo démarre en muet ; activez le son dans le lecteur si vous le souhaitez.
          </p>

          <div className="rounded-2xl border border-border bg-card p-7 text-center space-y-3">
            <p className="text-lg font-semibold">
              Asclion accompagne le conseil associé au comptoir, sans remplacer votre LGO.
            </p>
            <p className="text-sm text-muted-foreground">
              Classique à partir de 99 € HT/mois. Premium à partir de 149 € HT/mois. Toute
              l'officine, caisses illimitées.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                asChild
                className="h-12 px-8 font-semibold pharmacy-gradient border-0 gap-2 w-full sm:w-auto"
              >
                <Link to={lp("/tarifs") + "?source=vsl"}>
                  Choisir mon offre <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 px-8 font-semibold w-full sm:w-auto"
              >
                <Link to={lp("/demo") + "?source=vsl"}>Je préfère une démo de 15 min</Link>
              </Button>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-center">Questions fréquentes</h2>
            {[
              {
                q: "Quels moyens de paiement acceptez-vous ?",
                a: "Carte bancaire pour toutes les offres, prélèvement SEPA sur les offres mensuelles, et virement sur facture sur demande. Avec le SEPA, l'accès est préparé dès la confirmation définitive du paiement.",
              },
              {
                q: "Mon officine a un robot de délivrance, est-ce compatible ?",
                a: "La compatibilité dépend de la marque et du modèle. Elle est vérifiée avant tout paiement via la page de vérification dédiée.",
              },
              {
                q: "Combien de temps avant l'activation ?",
                a: "Après confirmation du paiement, vous recevez un e-mail pour définir votre mot de passe et installer Asclion en trois clics. L'activation intervient sous 24 à 48 h après validation de votre compte.",
              },
              {
                q: "Puis-je résilier ?",
                a: "L'offre mensuelle est résiliable à tout moment, avec effet à la fin de la période déjà payée. L'offre annuelle est payée d'avance pour 12 mois et n'est pas renouvelée automatiquement : un e-mail vous est envoyé un mois avant l'échéance.",
              },
            ].map((f, i) => (
              <details key={i} className="rounded-xl border border-border bg-card p-5 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  {f.q}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Presentation;
