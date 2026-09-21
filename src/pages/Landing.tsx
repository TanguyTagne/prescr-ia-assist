import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  CheckCircle2,
  Clock,
  ScanBarcode,
  MessageSquareText,
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

const COPY = {
  fr: {
    title: "Asclion — Le conseil associé, au bon moment. Sans changer de LGO.",
    description: "Au scan d'un médicament, Asclion affiche un produit complémentaire pertinent et une phrase conseil. À partir de 99 € HT/mois par officine, caisses illimitées.",
    hero: <>Le conseil associé, au bon moment. <span className="text-primary">Sans changer de LGO.</span></>,
    intro: "Au scan d'un médicament, Asclion affiche une suggestion pertinente et une phrase conseil prête à adapter. Votre équipe garde la décision ; votre officine ne laisse plus les bonnes occasions au hasard.",
    video: "Voir Asclion en 45 secondes", choose: "Choisir mon offre", download: "Télécharger Asclion",
    price: "À partir de 99 € HT/mois, par officine et caisses illimitées. Activation sous 24 à 48 h après validation.",
    videoLabel: "Lire la vidéo de présentation Asclion (45 secondes)",
    videoCaption: "Démonstration de l'application sur une fenêtre LGO générique — aucune donnée patient réelle.",
    problem: <>Le problème n'est pas de savoir conseiller. <span className="text-primary">C'est d'y penser au bon moment.</span></>,
    problems: ["Au comptoir, le rythme ne laisse pas de place à la recherche.", "Chaque médicament appelle un contexte, un conseil et parfois un produit associé.", "Sans repère immédiat, le conseil varie selon l'heure et la personne au comptoir."],
    stepsTitle: "Trois secondes. Deux informations utiles.",
    steps: [
      ["Le médicament est scanné", "Asclion détecte le produit sans modifier le LGO."],
      ["L'application apparaît", "Le produit complémentaire et sa phrase conseil sont présentés au comptoir."],
      ["L'équipe garde la main", "Elle propose ou ignore. Les retours permettent d'affiner les suggestions pour l'officine."],
    ],
    full: "Voir le fonctionnement complet",
    patientTitle: "Pour le patient",
    patient: ["Un conseil associé plus systématique et explicable.", "Une suggestion pertinente au moment du scan.", "Le pharmacien reste le décideur."],
    pharmacyTitle: "Pour l'officine",
    pharmacy: ["La qualité du conseil ne dépend plus uniquement de la mémoire au comptoir.", "Les ventes associées reposent sur une justification, pas sur une pression commerciale.", "Premium adapte les suggestions au stock et aide à limiter les invendus."],
    proof: "+500 € de chiffre d'affaires additionnel mensuel observé pendant trois mois sur une caisse.",
    proofDetail: "Pilote mené dans une officine équipée de cinq caisses ; Asclion était utilisé sur une seule caisse. Ce résultat est propre à ce pilote, n'est pas une garantie et ne se multiplie pas automatiquement par le nombre de caisses.",
    offerTitle: "Une offre par officine. Pas par caisse.", offerSub: "Tous les prix sont HT. Caisses illimitées.",
    classic: "Catalogue 30 000+ médicaments, produits complémentaires, phrases conseil et apprentissage issu des choix de l'équipe.",
    premium: "Tout Classique, plus l'audit de stock initial, les suggestions sur mesure et l'actualisation du stock.",
    compare: "Comparer les offres", faqTitle: "Questions fréquentes", allFaq: "Voir toute la FAQ",
    finalTitle: "Prêt à structurer le conseil associé de votre officine ?",
    finalText: "Choisissez votre offre, ou demandez une démonstration adaptée à votre LGO.", demo: "Demander une démo de 15 min",
    faq: [
      ["Faut-il changer de LGO ?", "Non. Asclion fonctionne en complément de votre LGO ; la compatibilité est confirmée selon votre environnement avant l'activation."],
      ["Est-ce que cela ralentit la délivrance ?", "L'application est conçue pour rester discrète : elle apparaît sans prendre le focus de la souris et repasse au second plan après un clic extérieur."],
      ["Que se passe-t-il après le paiement ?", "Vous recevez un e-mail pour définir votre mot de passe, installer Asclion en trois clics et terminer la validation. Activation sous 24 à 48 h après validation."],
      ["Et si mon officine a un robot ?", "La compatibilité est vérifiée avant tout paiement, selon la marque et le modèle du robot."],
    ],
  },
  en: {
    title: "Asclion — Associated advice at the right moment, without changing your pharmacy software",
    description: "When a medication is scanned, Asclion shows a relevant complementary product and a ready-to-use advice phrase. From €99 excl. VAT/month per pharmacy, unlimited tills.",
    hero: <>Associated advice, at the right moment. <span className="text-primary">Without changing your pharmacy software.</span></>,
    intro: "When a medication is scanned, Asclion shows a relevant suggestion and an advice phrase your team can adapt. Your team keeps the final decision while fewer valuable opportunities are missed.",
    video: "See Asclion in 45 seconds", choose: "Choose a plan", download: "Download Asclion",
    price: "From €99 excl. VAT/month per pharmacy, with unlimited tills. Activation within 24 to 48 hours after approval.",
    videoLabel: "Play the 45-second Asclion presentation", videoCaption: "Application demonstration over generic pharmacy software — no real patient data.",
    problem: <>The challenge is not knowing how to advise. <span className="text-primary">It is remembering at the right moment.</span></>,
    problems: ["At the counter, the pace leaves little time for research.", "Each medication comes with context, advice and sometimes a complementary product.", "Without an immediate prompt, advice varies with the time and the person at the counter."],
    stepsTitle: "Three seconds. Two useful pieces of information.",
    steps: [["The medication is scanned", "Asclion detects the product without modifying your pharmacy software."], ["The application appears", "A complementary product and its advice phrase appear at the counter."], ["Your team stays in control", "They can suggest or ignore it. Their choices help refine suggestions for the pharmacy."]],
    full: "See how it works", patientTitle: "For patients", patient: ["More systematic, explainable associated advice.", "A relevant suggestion when the medication is scanned.", "The pharmacist remains the decision-maker."],
    pharmacyTitle: "For the pharmacy", pharmacy: ["Advice quality no longer relies on memory alone.", "Associated sales are justified rather than pressured.", "Premium adapts suggestions to stock and helps limit unsold products."],
    proof: "€500 in additional monthly revenue observed for three months on one till.", proofDetail: "Pilot conducted in a pharmacy with five tills; Asclion was used on one till only. This result is specific to that pilot, is not a guarantee and cannot automatically be multiplied by the number of tills.",
    offerTitle: "One plan per pharmacy. Not per till.", offerSub: "All prices exclude VAT. Unlimited tills.",
    classic: "A catalogue of 30,000+ medications, complementary products, advice phrases and learning from your team's choices.", premium: "Everything in Classic, plus an initial stock audit, tailored suggestions and stock updates.",
    compare: "Compare plans", faqTitle: "Frequently asked questions", allFaq: "See the full FAQ",
    finalTitle: "Ready to structure associated advice in your pharmacy?", finalText: "Choose your plan or request a demonstration adapted to your pharmacy software.", demo: "Request a 15-minute demo",
    faq: [["Do I need to change pharmacy software?", "No. Asclion works alongside your current software; compatibility is confirmed for your environment before activation."], ["Will it slow down dispensing?", "The application stays discreet: it appears without taking mouse focus and returns to the background after an outside click."], ["What happens after payment?", "You receive an email to set your password, install Asclion in three clicks and complete validation. Activation takes 24 to 48 hours after approval."], ["What if my pharmacy has a robot?", "Compatibility is checked before payment, based on the robot brand and model."]],
  },
};

const Landing = () => {
  const { lang, lp } = useI18n();
  const c = COPY[lang];
  const { user } = useAuth();
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
        title={c.title}
        description={c.description}
        path="/"
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Asclion",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Windows",
          description: c.description,
          url: lang === "en" ? "https://www.asclion.com/en" : "https://www.asclion.com",
          offers: {
            "@type": "Offer",
            price: "99",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
          audience: { "@type": "Audience", audienceType: "Pharmacists" },
          inLanguage: [lang === "en" ? "en" : "fr-FR"],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: c.faq.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }]}
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
                {c.hero}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                {c.intro}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Button
                  size="lg"
                  onClick={playVideo}
                  className="h-12 px-7 text-base font-semibold pharmacy-gradient border-0 gap-2 w-full sm:w-auto"
                >
                  <Play className="h-5 w-5" />
                  {c.video}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 px-7 text-base font-semibold w-full sm:w-auto gap-2"
                >
                  {user ? (
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                      <Download className="h-5 w-5" /> {c.download}
                    </a>
                  ) : (
                    <Link to={lp("/tarifs") + "?source=home_hero"}>{c.choose}</Link>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.price}
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
                  aria-label={c.videoLabel}
                >
                  <span className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                    <Play className="h-7 w-7 ml-1" />
                  </span>
                </button>
              )}
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
                {c.videoCaption}
              </p>
            </div>
          </div>
        </section>

        {/* ===== PROBLÈME ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-8">
              {c.problem}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[Timer, Search, Users].map((Icon, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <Icon className="h-6 w-6 text-primary" />
                  <p className="text-sm leading-relaxed">{c.problems[i]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FONCTIONNEMENT ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-10">
              {c.stepsTitle}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[ScanBarcode, MessageSquareText, Hand].map((Icon, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{c.steps[i][0]}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.steps[i][1]}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" asChild className="gap-2">
                <Link to={lp("/fonctionnalites")}>
                  {c.full} <ArrowRight className="h-4 w-4" />
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
              <h2 className="text-xl font-bold tracking-tight">{c.patientTitle}</h2>
              <ul className="space-y-3">
                {c.patient.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-7 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">{c.pharmacyTitle}</h2>
              <ul className="space-y-3">
                {c.pharmacy.map((b, i) => (
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
                 {c.proof}
              </blockquote>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                 {c.proofDetail}
              </p>
            </div>
          </div>
        </section>

        {/* ===== OFFRES ===== */}
        <section className="py-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight mb-2">
               {c.offerTitle}
            </h2>
            <p className="text-center text-muted-foreground mb-8">
               {c.offerSub}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card p-7 space-y-3">
                <h3 className="text-lg font-bold">Classique</h3>
                <p className="text-2xl font-extrabold text-primary">À partir de 99 € HT/mois</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   {c.classic}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/40 bg-card p-7 space-y-3">
                <h3 className="text-lg font-bold">Premium</h3>
                <p className="text-2xl font-extrabold text-primary">À partir de 149 € HT/mois</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   {c.premium}
                </p>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button size="lg" asChild className="pharmacy-gradient border-0 font-semibold gap-2">
                <Link to={lp("/tarifs")}>
                   {c.compare} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===== FAQ COURTE ===== */}
        <section className="py-16 px-4 bg-secondary/50">
          <div className="container max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center tracking-tight">
               {c.faqTitle}
            </h2>
            <div className="space-y-3">
               {c.faq.map(([q, a], i) => (
                <details
                  key={i}
                  className="rounded-xl border border-border bg-card p-5 group"
                >
                  <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                     {q}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                   <p className="text-sm text-muted-foreground leading-relaxed mt-3">{a}</p>
                </details>
              ))}
            </div>
            <div className="text-center">
              <Button variant="ghost" asChild className="gap-2">
                <Link to={lp("/aide")}>
                   {c.allFaq} <ArrowRight className="h-4 w-4" />
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
               {c.finalTitle}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
               {c.finalText}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                asChild
                className="h-12 px-8 text-base font-semibold pharmacy-gradient border-0 w-full sm:w-auto gap-2"
              >
                {user ? (
                  <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                     <Download className="h-5 w-5" /> {c.download}
                  </a>
                ) : (
                   <Link to={lp("/tarifs")}>{c.choose}</Link>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 px-8 text-base font-semibold w-full sm:w-auto"
              >
                 <Link to={lp("/demo")}>{c.demo}</Link>
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
