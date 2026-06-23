import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const Confidentialite = () => {
  const { t } = useI18n();
  return (
  <div className="min-h-screen bg-background">
    <Seo title={t("seo.legal.privacy.title")} description={t("seo.legal.privacy.desc")} path="/confidentialite" />
    <div className="container max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-3xl font-bold mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="space-y-6 text-foreground text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Responsable de traitement</h2>
          <p>
            Le responsable de traitement du site asclion.com est <strong>Tanguy Tubert</strong>.
            Pour toute question relative à vos données : <a href="mailto:tanguytubert@gmail.com" className="text-primary underline">tanguytubert@gmail.com</a>.
          </p>
          <p>
            Lorsque le logiciel Asclion est utilisé en officine, la <strong>pharmacie cliente</strong> est
            responsable de traitement des données qu'elle traite à l'aide d'Asclion ; Asclion agit
            alors en tant que <strong>sous-traitant</strong> au sens de l'article 28 du RGPD. Un
            accord de sous-traitance (DPA) est signé avec chaque officine cliente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Données collectées et finalités</h2>
          <p><strong>Visiteurs du site asclion.com :</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Données du formulaire de demande d'accès (nom de la pharmacie, contact, email, téléphone, ville, LGO) — finalité : traiter votre demande commerciale. Base légale : mesures précontractuelles (art. 6.1.b RGPD).</li>
            <li>Données d'inscription et d'authentification (email, nom, mot de passe haché) — finalité : créer et sécuriser votre compte. Base légale : exécution du contrat.</li>
            <li>Statistiques d'usage internes pseudonymisées (événements de navigation et d'analyse) — finalité : améliorer le service. Base légale : intérêt légitime.</li>
            <li>Cookies : voir la <Link to="/cookies" className="text-primary underline">page dédiée</Link>. Base légale : consentement (art. 82 LIL) pour les cookies non strictement nécessaires.</li>
          </ul>
          <p className="mt-3"><strong>Utilisation du logiciel Asclion en officine :</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Asclion ne stocke <strong>aucune donnée patient identifiante en clair</strong>. Le nom du patient extrait d'une ordonnance est immédiatement transformé en <em>hash</em> irréversible (SHA‑256) afin d'assurer une fonctionnalité d'historique anonymisé sans pouvoir remonter à l'identité du patient.</li>
            <li>Les ordonnances analysées ne sont pas conservées : seules les molécules détectées et les statistiques agrégées le sont, à des fins de traçabilité professionnelle de l'officine.</li>
            <li>Aucune donnée de santé identifiante n'est exportée vers un tiers à des fins commerciales.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Destinataires</h2>
          <p>
            Vos données sont accessibles aux seuls personnels habilités d'Asclion et à ses
            sous-traitants techniques strictement nécessaires (hébergeur, fournisseur d'IA pour le
            traitement à la volée des ordonnances, fournisseur d'envoi d'emails transactionnels).
            Aucune donnée n'est vendue.
          </p>
          <p className="mt-2">
            Le traitement à la volée des ordonnances est effectué via notre modèle IA,
            sans conservation des prompts par le fournisseur au-delà du temps de
            traitement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Hébergement et localisation</h2>
          <p>
            Les données sont hébergées au sein de l'Union Européenne. Asclion ne traite pas, à ce jour,
            de données de santé identifiantes ; un hébergement HDS n'est donc pas requis. Si une
            évolution conduisait à traiter de telles données, un hébergeur certifié HDS serait
            obligatoirement mis en place avant la mise en production.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Durée de conservation</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Compte utilisateur : pendant toute la durée d'utilisation, puis 3 ans après la dernière connexion.</li>
            <li>Demandes d'accès commerciales : 3 ans à compter du dernier contact.</li>
            <li>Logs techniques de sécurité : 12 mois.</li>
            <li>Statistiques pseudonymisées : 25 mois (recommandation CNIL).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">6. Vos droits</h2>
          <p>
            Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits
            d'accès, de rectification, d'effacement, de limitation, d'opposition, de portabilité, et
            du droit de définir des directives post‑mortem. Pour exercer ces droits :
            <a href="mailto:tanguytubert@gmail.com" className="text-primary underline ml-1">tanguytubert@gmail.com</a>.
          </p>
          <p className="mt-2">
            Vous pouvez introduire une réclamation auprès de la CNIL :
            <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer" className="text-primary underline ml-1">www.cnil.fr/fr/plaintes</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. Sécurité</h2>
          <p>
            Les données sont protégées par chiffrement en transit (TLS) et au repos. L'accès aux
            données patient pseudonymisées est restreint par des règles strictes (Row Level Security)
            et journalisé. Les mots de passe sont hachés (bcrypt).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">8. Modifications</h2>
          <p>
            La présente politique peut être mise à jour. Toute modification substantielle sera
            notifiée par email aux utilisateurs disposant d'un compte.
          </p>
        </section>
      </div>
    </div>
  </div>
  );
};

export default Confidentialite;
