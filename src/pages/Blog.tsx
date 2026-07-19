import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import PostCard from "@/components/blog/PostCard";
import { useI18n } from "@/i18n/I18nProvider";
import { BLOG_CATEGORIES, getAllPosts } from "@/lib/blog";

const Blog = () => {
  const { lp } = useI18n();
  const posts = useMemo(() => getAllPosts(), []);
  const [category, setCategory] = useState<string>("Tous");

  const filtered = category === "Tous" ? posts : posts.filter((p) => p.category === category);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Blog Asclion — Conseil associé & panier moyen en officine"
        description="Articles pratiques pour développer le CA de votre officine : conseil associé, panier moyen, outils et gestion — par les fondateurs d'Asclion."
        path="/blog"
      />
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={lp("/")}>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" aria-label="Retour">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <span className="text-primary-foreground font-semibold tracking-tight">Asclion</span>
          </div>
          <a href="/blog/rss.xml" className="text-primary-foreground/80 hover:text-primary-foreground text-xs inline-flex items-center gap-1">
            <Rss className="h-3.5 w-3.5" /> RSS
          </a>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-10 flex-1">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Blog Asclion — Conseil associé, panier moyen et CA de votre officine
          </h1>
          <p className="text-muted-foreground">
            Idées concrètes, retours de pilotes et méthodes éprouvées pour vendre plus au comptoir tout en améliorant l'accompagnement patient.
          </p>
        </div>

        <section aria-labelledby="blog-categories" className="mb-10">
          <h2 id="blog-categories" className="text-lg font-semibold mb-3">Explorer par catégorie</h2>
          <div className="flex flex-wrap gap-2">
            {["Tous", ...BLOG_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="blog-articles">
          <h2 id="blog-articles" className="text-lg font-semibold mb-4">
            {category === "Tous" ? "Tous les articles" : `Articles — ${category}`}
          </h2>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun article dans cette catégorie pour le moment.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p, i) => (<PostCard key={p.slug} post={p} eager={i === 0} />))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Blog;
