import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const MentionsLegales = () => (
  <div className="min-h-screen bg-background">
    <div className="container max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-3xl font-bold mb-2">Mentions légales</h1>
      <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="prose prose-sm max-w-none space-y-6 text-foreground">
        <section>
          <h2 className="text-xl font-semibold">Éditeur du site</h2>
          <p>
            Le site <strong>asclion.com</strong> et le logiciel Asclion sont édités par :
          </p>
          <ul>
            <li>Raison sociale : <strong>[À COMPLÉTER]</strong></li>
            <li>Forme juridique : [À COMPLÉTER]</li>
            <li>Capital social : [À COMPLÉTER]</li>
            <li>SIREN / SIRET : [À COMPLÉTER]</li>
            <li>Siège social : [À COMPLÉTER]</li>
            <li>Numéro de TVA intracommunautaire : [À COMPLÉTER]</li>
            <li>Directeur de la publication : [À COMPLÉTER]</li>
            <li>Email de contact : <a href="mailto:contact@asclion.com" className="text-primary underline">contact@asclion.com</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Hébergement</h2>
          <p>
            Le site et les données sont hébergés au sein de l'Union Européenne par les prestataires
            techniques utilisés par Asclion (notamment Lovable, Supabase / AWS Europe). Les serveurs
            applicables se trouvent dans la zone UE. Une liste détaillée peut être obtenue sur simple
            demande à contact@asclion.com.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Propriété intellectuelle</h2>
          <p>
            L'ensemble des éléments accessibles sur le site (textes, graphismes, logo, code, base de
            données clinique) est protégé par le droit d'auteur, le droit des marques et le droit des
            bases de données. Toute reproduction, représentation, modification ou exploitation,
            partielle ou intégrale, sans autorisation écrite préalable est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Responsabilité</h2>
          <p>
            Asclion est un outil d'aide à la dispensation destiné aux professionnels de santé. Les
            suggestions affichées sont fournies à titre informatif et ne se substituent en aucun cas
            au jugement professionnel du pharmacien, qui demeure seul responsable de la délivrance.
            Asclion ne réalise aucun diagnostic médical et n'a pas vocation à être qualifié de
            dispositif médical au sens du règlement (UE) 2017/745.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Liens utiles</h2>
          <ul>
            <li><Link to="/confidentialite" className="text-primary underline">Politique de confidentialité</Link></li>
            <li><Link to="/cookies" className="text-primary underline">Gestion des cookies</Link></li>
            <li><Link to="/cgu" className="text-primary underline">Conditions générales d'utilisation</Link></li>
          </ul>
        </section>
      </div>
    </div>
  </div>
);

export default MentionsLegales;
