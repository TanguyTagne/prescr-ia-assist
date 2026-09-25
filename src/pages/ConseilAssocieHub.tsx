import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { CONSEILS } from "@/lib/seoContent";

const SITE = "https://www.asclion.com";

const ConseilAssocieHub = () => {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CONSEILS;
    return CONSEILS.filter(
      (c) =>
        c.medicament_nom.toLowerCase().includes(needle) ||
        c.classe_atc.toLowerCase().includes(needle) ||
        c.produit_complementaire_nom.toLowerCase().includes(needle),
    );
  }, [q]);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Fiches de conseil associé par médicament",
    itemListElement: CONSEILS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.medicament_nom,
      url: `${SITE}/conseil-associe/${c.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Conseil associé par médicament : fiches comptoir | Asclion"
        description="Fiches de conseil associé classées par médicament : produit complémentaire pertinent, précautions à vérifier et phrase courte à utiliser au comptoir."
        path="/conseil-associe"
        frenchOnly
        jsonLd={itemListLd}
      />
      <SiteHeader />

      <main className="flex-1 px-4 py-12">
        <div className="container max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Conseil associé par médicament
          </h1>
          <p className="text-muted-foreground max-w-2xl mb-6">
            Pour chaque molécule fréquemment délivrée : le produit complémentaire qui peut être
            pertinent, les vérifications à mener avant de le proposer et une formulation courte
            utilisable au comptoir. Ces fiches sont une aide à la décision : elles n'établissent
            aucun diagnostic et ne remplacent pas l'analyse pharmaceutique.
          </p>

          <div className="relative mb-8 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un médicament ou une classe"
              aria-label="Rechercher un médicament"
              className="pl-9"
            />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/conseil-associe/${c.slug}`}
                  className="group block h-full rounded-xl border border-border p-4 hover:border-primary/50 hover:bg-muted/40 transition-colors"
                >
                  <span className="block font-semibold tracking-tight mb-1">{c.medicament_nom}</span>
                  <span className="block text-xs text-muted-foreground mb-2">{c.classe_atc}</span>
                  <span className="block text-sm text-muted-foreground line-clamp-2">
                    {c.produit_complementaire_nom}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                    Voir la fiche
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune fiche ne correspond à cette recherche.</p>
          )}

          <section className="mt-12 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-2">Aller plus loin</h2>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link to="/blog/guide-conseil-associe-officine" className="text-primary hover:underline">
                  → Le guide ultime du conseil associé à l'officine
                </Link>
              </li>
              <li>
                <Link to="/fonctionnalites" className="text-primary hover:underline">
                  → Comment Asclion affiche le conseil au scan du médicament
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ConseilAssocieHub;
