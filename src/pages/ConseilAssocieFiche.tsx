import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { CONSEILS, faqLd, getConseil } from "@/lib/seoContent";

const SITE = "https://www.asclion.com";

const ConseilAssocieFiche = () => {
  const { slug = "" } = useParams();
  const fiche = getConseil(slug);
  if (!fiche) return <Navigate to="/conseil-associe" replace />;

  const url = `${SITE}/conseil-associe/${fiche.slug}`;
  const others = CONSEILS.filter((c) => c.slug !== fiche.slug).slice(0, 4);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "MedicalWebPage",
      name: fiche.meta_title,
      description: fiche.meta_description,
      url,
      inLanguage: "fr-FR",
      about: { "@type": "Drug", name: fiche.medicament_nom },
      audience: { "@type": "MedicalAudience", audienceType: "Pharmacist" },
      publisher: { "@type": "Organization", name: "Asclion", url: SITE },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Conseil associé", item: `${SITE}/conseil-associe` },
        { "@type": "ListItem", position: 3, name: fiche.medicament_nom, item: url },
      ],
    },
    faqLd(fiche.faq),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={`${fiche.meta_title} | Asclion`}
        description={fiche.meta_description}
        path={`/conseil-associe/${fiche.slug}`}
        ogType="article"
        frenchOnly
        jsonLd={jsonLd}
      />
      <SiteHeader />

      <main className="flex-1 px-4 py-10">
        <article className="container max-w-3xl mx-auto">
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground mb-4">
            <Link to="/conseil-associe" className="hover:underline">Conseil associé</Link>
            <span className="mx-1">/</span>
            <span>{fiche.medicament_nom}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Conseil associé : {fiche.medicament_nom}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{fiche.classe_atc}</p>

          <section className="rounded-xl border border-border bg-muted/40 p-5 mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Suggestion affichée par Asclion au scan
            </h2>
            <p className="font-semibold">{fiche.produit_complementaire_nom}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Phrase comptoir : « {fiche.phrase_conseil_asclion} »
            </p>
          </section>

          <h2 className="text-xl font-semibold tracking-tight mb-3">Rationnel clinique et précautions</h2>
          <div className="prose prose-sm sm:prose-base max-w-none prose-a:text-primary prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fiche.rationnel_clinique}</ReactMarkdown>
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight mb-3">Impact sur le panier</h2>
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border border-border p-4">
                <dt className="text-muted-foreground mb-1">Prix conseillé TTC</dt>
                <dd>{fiche.impact_panier.prix_moyen_conseille_ttc}</dd>
              </div>
              <div className="rounded-lg border border-border p-4">
                <dt className="text-muted-foreground mb-1">Marge estimée</dt>
                <dd>{fiche.impact_panier.marge_estimee}</dd>
              </div>
              <div className="rounded-lg border border-border p-4">
                <dt className="text-muted-foreground mb-1">Fréquence d'acceptation</dt>
                <dd>{fiche.impact_panier.frequence_acceptation_estimee}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight mb-3">Questions fréquentes</h2>
            <div className="space-y-3">
              {fiche.faq.map((f) => (
                <details key={f.question} className="rounded-lg border border-border p-4">
                  <summary className="font-medium cursor-pointer">{f.question}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.reponse}</p>
                </details>
              ))}
            </div>
          </section>

          <aside className="mt-8 flex gap-3 rounded-xl border border-border p-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p>
              Cette fiche est une aide au conseil destinée aux professionnels de santé. Elle
              n'établit aucun diagnostic et ne remplace ni l'analyse pharmaceutique, ni l'avis du
              prescripteur. Le pharmacien vérifie les contre-indications et interactions avant toute
              proposition.
            </p>
          </aside>

          <section className="mt-10 rounded-xl border border-border p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Ce conseil peut s'afficher au scan du médicament</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Asclion reconnaît le CIP scanné et propose la suggestion associée pendant la
              délivrance. L'équipe garde la décision.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild><Link to="/demo">Tester la démonstration</Link></Button>
              <Button asChild variant="outline"><Link to="/tarifs">Voir les offres</Link></Button>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-3">Autres fiches</h2>
            <ul className="grid gap-2 sm:grid-cols-2 text-sm">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link to={`/conseil-associe/${c.slug}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    {c.medicament_nom}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              <Link to="/blog/guide-conseil-associe-officine" className="text-primary hover:underline">
                → Le guide ultime du conseil associé à l'officine
              </Link>
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ConseilAssocieFiche;
