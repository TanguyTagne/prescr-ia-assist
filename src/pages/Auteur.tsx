import { Link } from "react-router-dom";
import { ArrowLeft, Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import PostCard from "@/components/blog/PostCard";
import { useI18n } from "@/i18n/I18nProvider";
import { getAllPosts } from "@/lib/blog";

const SITE = "https://www.asclion.com";

export const AUTHOR = {
  name: "Tanguy Tubert",
  url: `${SITE}/auteur/tanguy`,
  jobTitle: "Fondateur d'Asclion",
  linkedin: "https://www.linkedin.com/company/asclion/",
  email: "contact@asclion.com",
};

const Auteur = () => {
  const { lp } = useI18n();
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Tanguy Tubert, fondateur d'Asclion | Auteur"
        description="Tanguy Tubert, fondateur d'Asclion, écrit sur le conseil associé, le panier moyen et les outils d'aide à la délivrance en officine."
        path="/auteur/tanguy"
        frenchOnly
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: AUTHOR.name,
              url: AUTHOR.url,
              jobTitle: AUTHOR.jobTitle,
              email: `mailto:${AUTHOR.email}`,
              worksFor: { "@type": "Organization", name: "Asclion", url: SITE },
              sameAs: [AUTHOR.linkedin],
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
              { "@type": "ListItem", position: 2, name: "Auteur", item: `${SITE}/auteur/tanguy` },
            ],
          },
        ]}
      />

      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-3xl mx-auto flex items-center gap-3">
          <Link to={lp("/")}>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-primary-foreground font-semibold tracking-tight">Asclion</span>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-10 flex-1">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Accueil</Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">Tanguy Tubert</span>
        </nav>

        <div className="flex flex-col sm:flex-row gap-6 items-start mb-8">
          <img
            src="/logo-asclion.png"
            alt="Tanguy Tubert, fondateur d'Asclion"
            width={96}
            height={96}
            loading="eager"
            className="h-24 w-24 rounded-full object-contain bg-muted p-2 border border-border"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Tanguy Tubert</h1>
            <p className="text-muted-foreground mb-3">Fondateur d'Asclion — assistant au conseil associé pour les pharmacies</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
              <a href={`mailto:${AUTHOR.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-4 w-4" /> {AUTHOR.email}
              </a>
            </div>
          </div>
        </div>

        <section className="prose-sm max-w-none space-y-4 text-sm leading-relaxed text-foreground/85">
          <p>
            Je conçois Asclion, une application Windows qui se superpose au logiciel de gestion d'officine (LGO)
            et propose, au moment du scan d'une boîte, le produit complémentaire pertinent accompagné d'une phrase
            de conseil courte, prête à dire au comptoir.
          </p>
          <p>
            Mon travail consiste à transformer une base clinique de plus de 30 000 médicaments en recommandations
            utilisables en quelques secondes : association médicament → classe ATC → besoin patient, curation
            manuelle des produits complémentaires, formulation des phrases de conseil, et mesure des PC réellement
            acceptés au comptoir.
          </p>
          <p>
            J'écris ici sur le conseil associé par classe thérapeutique, le panier moyen en officine et le choix des
            outils logiciels. Les chiffres cités proviennent soit du pilote Asclion (méthode décrite sur la page
            <Link to="/a-propos" className="text-primary hover:underline"> À propos</Link>), soit de sources externes
            explicitement liées.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Articles publiés</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Auteur;
