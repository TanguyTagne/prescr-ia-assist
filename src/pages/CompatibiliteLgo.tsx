import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { LGOS, faqLd, getLgo } from "@/lib/seoContent";

const SITE = "https://www.asclion.com";

const CompatibiliteLgo = () => {
  const { slug = "" } = useParams();
  const fiche = getLgo(slug);
  if (!fiche) return <Navigate to="/fonctionnalites" replace />;

  const url = `${SITE}/compatibilite/${fiche.slug}`;
  const others = LGOS.filter((l) => l.slug !== fiche.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: fiche.meta_title,
      description: fiche.meta_description,
      url,
      inLanguage: "fr-FR",
      author: { "@type": "Organization", name: "Asclion" },
      publisher: { "@type": "Organization", name: "Asclion", url: SITE },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Compatibilité logiciels", item: `${SITE}/compatibilite/${fiche.slug}` },
        { "@type": "ListItem", position: 3, name: fiche.nom_lgo, item: url },
      ],
    },
    faqLd(fiche.faq),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={`${fiche.meta_title} | Asclion`}
        description={fiche.meta_description}
        path={`/compatibilite/${fiche.slug}`}
        ogType="article"
        frenchOnly
        jsonLd={jsonLd}
      />
      <SiteHeader />

      <main className="flex-1 px-4 py-10">
        <article className="container max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Asclion et {fiche.nom_lgo}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">Éditeur : {fiche.editeur}</p>

          <h2 className="text-xl font-semibold tracking-tight mb-3">Mode de fonctionnement</h2>
          <div className="prose prose-sm sm:prose-base max-w-none prose-a:text-primary prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fiche.mode_fonctionnement}</ReactMarkdown>
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight mb-3">Ce que cela change à l'officine</h2>
            <ul className="space-y-2 text-sm">
              {fiche.avantages_officine.map((a) => (
                <li key={a} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
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

          <section className="mt-10 rounded-xl border border-border p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Vérifier sur votre poste</h2>
            <p className="text-sm text-muted-foreground mb-4">
              La compatibilité dépend de la version installée, du lecteur et de la configuration du
              poste. Un essai sur votre environnement reste nécessaire.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild><Link to="/demo">Tester la démonstration</Link></Button>
              <Button asChild variant="outline"><Link to="/compatibilite-robot">Déclarer ma configuration</Link></Button>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-3">Autres logiciels</h2>
            <ul className="grid gap-2 sm:grid-cols-2 text-sm">
              {others.map((l) => (
                <li key={l.slug}>
                  <Link to={`/compatibilite/${l.slug}`} className="text-primary hover:underline">
                    Asclion et {l.nom_lgo}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CompatibiliteLgo;
