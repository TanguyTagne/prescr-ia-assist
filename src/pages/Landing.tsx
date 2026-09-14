import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  CheckCircle2,
  Clock,
  ScanBarcode,
  MessageSquareText,
  ShieldAlert,
  Hand,
  ArrowRight,
  Timer,
  Search,
  Users,
  Download,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DOWNLOAD_URL } from "@/lib/downloadUrl";
import { Button } from "@/components/ui/button";
import DemoFullPanel from "@/components/DemoFullPanel";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/hooks/useAnalytics";
import heroVideo from "@/assets/asclion-45s.mp4.asset.json";

const Landing = () => {
  const { lp } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const playVideo = () => {
    setVideoOpen(true);
    trackEvent("landing_video_play", { source: "home_hero" });
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Asclion — Le conseil associé, au bon moment. Sans changer de LGO."
        description="Au scan d'un médicament, Asclion affiche un point de vigilance, une suggestion pertinente et une phrase conseil. À partir de 99 € HT/mois par officine, caisses illimitées."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Asclion",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Windows",
          description:
            "Surcouche au LGO : au scan d'un médicament, point de vigilance, suggestion de produit complémentaire et phrase conseil au comptoir.",
          url: "https://www.asclion.com",
          offers: {
            "@type": "Offer",
            price: "99",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
          audience: { "@type": "Audience", audienceType: "Pharmacists" },
          inLanguage: ["fr-FR"],
        }}
      />
      <SiteHeader />

      <main>
        {/* ===== HERO ===== */}
        <section className="relative py-14 md:py-20 px-4 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 15%, hsl(var(--pharmacy-green-light) / 0.55), transparent 70%)",
            }}
          />
          <div className="container max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5 text-center lg:text-left">
              <h1 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight leading-[1.1]">
                Le conseil associé, au bon moment.{" "}
                <span className="text-primary">Sans changer de LGO.</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Au scan d'un médicament, Asclion affiche un point de vigilance, une suggestion
                pertinente et une phrase conseil prête à adapter. Votre équipe garde la décision ;
                votre officine ne laisse plus les bonnes occasions au hasard.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Button
                  size="lg"
                  onClick={playVideo}
                  className="h-12 px-7 text-base font-semibold pharmacy-gradient border-0 gap-2 w-full sm:w-auto"
                >
                  <Play className="h-5 w-5" />
                  Voir Asclion en 45 secondes
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 px-7 text-base font-semibold w-full sm:w-auto gap-2"
                >
                  {user ? (
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                      <Download className="h-5 w-5" /> Télécharger Asclion
                    </a>
                  ) : (
                    <Link to={lp("/tarifs") + "?source=home_hero"}>Choisir mon offre</Link>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                À partir de 99 € HT/mois, par officine et caisses illimitées. Activation sous 24 à
                48 h après validation.
              </p>
            </div>

            <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <video
                ref={videoRef}
                src={heroVideo.url}
                className="w-full aspect-video object-cover bg-black"
                muted
                playsInline
                controls={videoOpen}
                preload="metadata"
                onClick={playVideo}
              />
              {!videoOpen && (
                <button
                  onClick={playVideo}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label="Lire la vidéo de présentation Asclion (45 secondes)"
                >
                  <span className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                    <Play className="h-7 w-7 ml-1" />
                  </span>
                </button>
              )}
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
                Démonstration du widget sur une fenêtre LGO générique — aucune donnée patient réelle.
              </p>
            </div>
          </div>
        </section>

        {/* ===== PROBLÈME ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-8">
              Le problème n'est pas de savoir conseiller.{" "}
              <span className="text-primary">C'est d'y penser au bon moment.</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: Timer,
                  text: "Au comptoir, le rythme ne laisse pas de place à la recherche.",
                },
                {
                  icon: Search,
                  text: "Chaque médicament appelle un contexte, un conseil et parfois un produit associé.",
                },
                {
                  icon: Users,
                  text: "Sans repère immédiat, le conseil varie selon l'heure et la personne au comptoir.",
                },
              ].map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <c.icon className="h-6 w-6 text-primary" />
                  <p className="text-sm leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FONCTIONNEMENT ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-10">
              Trois secondes. Trois informations utiles.
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: ScanBarcode,
                  title: "Le médicament est scanné",
                  text: "Asclion détecte le produit sans modifier le LGO.",
                },
                {
                  icon: ShieldAlert,
                  title: "Le widget apparaît",
                  text: "Point de vigilance, suggestion et phrase conseil sont présentés au comptoir.",
                },
                {
                  icon: Hand,
                  title: "L'équipe garde la main",
                  text: "Elle propose ou ignore. Les retours permettent d'affiner les suggestions pour l'officine.",
                },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" asChild className="gap-2">
                <Link to={lp("/fonctionnalites")}>
                  Voir le fonctionnement complet <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===== DÉMO PRODUIT ===== */}
        <DemoFullPanel />

        {/* ===== BÉNÉFICES ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-7 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Pour le patient</h2>
              <ul className="space-y-3">
                {[
                  "Un conseil associé plus systématique et explicable.",
                  "Les points de vigilance remontent au bon moment.",
                  "Le pharmacien reste le décideur.",
                ].map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-7 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Pour l'officine</h2>
              <ul className="space-y-3">
                {[
                  "La qualité du conseil ne dépend plus uniquement de la mémoire au comptoir.",
                  "Les ventes associées reposent sur une justification, pas sur une pression commerciale.",
                  "Premium adapte les suggestions au stock et aide à limiter les invendus.",
                ].map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===== PREUVE PILOTE ===== */}
        <section id="preuve" className="py-16 px-4 bg-secondary/50 scroll-mt-16">
          <div className="container max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10 space-y-5 text-center">
              <MessageSquareText className="h-7 w-7 text-primary mx-auto" />
              <blockquote className="text-lg md:text-xl font-semibold leading-snug">
                +500 € de chiffre d'affaires additionnel mensuel observé pendant trois mois sur une
                caisse.
              </blockquote>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Pilote mené dans une officine équipée de cinq caisses ; Asclion était utilisé sur une
                seule caisse. Ce résultat est propre à ce pilote, n'est pas une garantie et ne se
                multiplie pas automatiquement par le nombre de caisses.
              </p>
            </div>
          </div>
        </section>

        {/* ===== OFFRES ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-2">
              Une offre par officine. Pas par caisse.
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Tous les prix sont HT. Caisses illimitées.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card p-7 space-y-3">
                <h3 className="text-lg font-bold">Classique</h3>
                <p className="text-2xl font-extrabold text-primary">À partir de 99 € HT/mois</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Catalogue 30 000+ médicaments, suggestions, sécurité, phrase conseil et
                  apprentissage issu des choix de l'équipe.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/40 bg-card p-7 space-y-3">
                <h3 className="text-lg font-bold">Premium</h3>
                <p className="text-2xl font-extrabold text-primary">À partir de 149 € HT/mois</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tout Classique, plus l'audit de stock initial, les suggestions sur mesure et
                  l'actualisation du stock.
                </p>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button size="lg" asChild className="pharmacy-gradient border-0 font-semibold gap-2">
                <Link to={lp("/tarifs")}>
                  Comparer les offres <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===== FAQ COURTE ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight">
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {[
                {
                  q: "Faut-il changer de LGO ?",
                  a: "Non. Asclion est une surcouche ; la compatibilité est confirmée selon votre environnement avant l'activation.",
                },
                {
                  q: "Est-ce que cela ralentit la délivrance ?",
                  a: "Le widget est conçu pour rester discret : il apparaît sans prendre le focus de la souris et repasse au second plan après un clic extérieur.",
                },
                {
                  q: "Que se passe-t-il après le paiement ?",
                  a: "Vous recevez un e-mail pour définir votre mot de passe, installer Asclion en trois clics et terminer la validation. Activation sous 24 à 48 h après validation.",
                },
                {
                  q: "Et si mon officine a un robot ?",
                  a: "La compatibilité est vérifiée avant tout paiement, selon la marque et le modèle du robot.",
                },
              ].map((f, i) => (
                <details
                  key={i}
                  className="rounded-xl border border-border bg-card p-5 group"
                >
                  <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                    {f.q}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="text-center">
              <Button variant="ghost" asChild className="gap-2">
                <Link to={lp("/aide")}>
                  Voir toute la FAQ <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===== CTA FINAL ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-xl mx-auto text-center space-y-4">
            <Clock className="h-7 w-7 text-primary mx-auto" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Prêt à structurer le conseil associé de votre officine ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Choisissez votre offre, ou demandez une démonstration adaptée à votre LGO.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                asChild
                className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 w-full sm:w-auto gap-2"
              >
                {user ? (
                  <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                    <Download className="h-5 w-5" /> Télécharger Asclion
                  </a>
                ) : (
                  <Link to={lp("/tarifs")}>Choisir mon offre</Link>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 px-8 text-base font-semibold w-full sm:w-auto"
              >
                <Link to={lp("/demo")}>Demander une démo de 15 min</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Landing;
