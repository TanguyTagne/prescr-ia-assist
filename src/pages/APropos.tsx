import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const SITE = "https://www.asclion.com";

const APropos = () => {
  const { lp } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="À propos d'Asclion — méthode, résultats, RGPD"
        description="Qui est derrière Asclion, comment le moteur de conseil associé est construit, ce que montre le pilote en officine et comment les données sont traitées."
        path="/a-propos"
        frenchOnly
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "À propos d'Asclion",
            url: `${SITE}/a-propos`,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
              { "@type": "ListItem", position: 2, name: "À propos", item: `${SITE}/a-propos` },
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
          <span className="text-foreground">À propos</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight mb-4">À propos d'Asclion</h1>
        <p className="text-muted-foreground mb-8">
          Asclion est une application Windows qui se superpose au logiciel de gestion d'officine et propose le produit
          complémentaire pertinent au moment du scan d'une boîte, avec une phrase de conseil courte.
        </p>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">L'origine</h2>
          <p className="text-sm leading-relaxed text-foreground/85">
            Le conseil associé est connu de toutes les équipes officinales, mais il se perd dans le rythme du comptoir :
            il faut se souvenir de la bonne association, trouver la bonne formulation et le faire en quelques secondes,
            entre deux clients. Asclion est né de ce constat : ne rien ajouter au parcours du pharmacien, et faire
            apparaître le conseil au moment exact où la boîte est scannée.
          </p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Comment le moteur est construit</h2>
          <ul className="text-sm leading-relaxed text-foreground/85 list-disc pl-5 space-y-1.5">
            <li>Base de plus de 30 000 médicaments, chacun rattaché à sa classe ATC.</li>
            <li>Association classe thérapeutique → besoin patient réel (effet indésirable à réduire, observance, confort).</li>
            <li>Curation manuelle des produits complémentaires : un PC est retenu s'il réduit un effet indésirable attendu ou accompagne l'efficacité du traitement.</li>
            <li>Phrase de conseil ultra-courte (3 à 7 mots), formulée pour être dite telle quelle au comptoir.</li>
            <li>Exclusion des médicaments hospitaliers et des situations à gravité élevée. Asclion n'établit jamais de diagnostic.</li>
            <li>Mesure continue : chaque PC accepté au comptoir est comptabilisé, ce qui permet d'écarter les suggestions qui ne fonctionnent pas.</li>
          </ul>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Ce que montre le pilote</h2>
          <p className="text-sm leading-relaxed text-foreground/85">
            En officine pilote, l'usage d'Asclion sur <strong>un seul comptoir</strong> a représenté de l'ordre de
            <strong> +500 € de chiffre d'affaires par mois</strong>, calculé en additionnant le prix des produits
            complémentaires effectivement acceptés et délivrés pendant la période.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Précautions de lecture : il s'agit d'un seul site, sur une période limitée, sans groupe témoin. Le résultat
            dépend du nombre de délivrances, de l'assortiment de l'officine et de l'implication de l'équipe. Ce chiffre
            est une indication d'ordre de grandeur, pas une promesse de résultat.
          </p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Données et RGPD</h2>
          <ul className="text-sm leading-relaxed text-foreground/85 list-disc pl-5 space-y-1.5">
            <li>Asclion traite des codes CIP de médicaments scannés, pas d'ordonnances ni d'identités patients.</li>
            <li>Aucune donnée de santé nominative n'est stockée ; les éventuels identifiants patients sont hachés avant tout enregistrement.</li>
            <li>Les données sont cloisonnées par officine (accès restreint au niveau de la base) et hébergées dans l'Union européenne.</li>
            <li>Un pack contractuel RGPD (DPA, analyse d'impact) est disponible : <Link to="/legal/dpa" className="text-primary hover:underline">DPA</Link> et <Link to="/legal/pia" className="text-primary hover:underline">PIA</Link>.</li>
            <li>L'export brut de la base par les utilisateurs est interdit.</li>
          </ul>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Qui écrit</h2>
          <p className="text-sm leading-relaxed text-foreground/85">
            Les contenus sont écrits par <Link to="/auteur/tanguy" className="text-primary hover:underline">Tanguy Tubert</Link>,
            fondateur d'Asclion, et relus par l'équipe Asclion avant publication.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to={lp("/demo")}>
            <Button>Tester le copilote</Button>
          </Link>
          <Link to={lp("/tarifs")}>
            <Button variant="outline">Voir les tarifs</Button>
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default APropos;
