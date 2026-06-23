import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const CGU = () => {
  const { t } = useI18n();
  return (
  <div className="min-h-screen bg-background">
    <Seo title={t("seo.legal.terms.title")} description={t("seo.legal.terms.desc")} path="/cgu" />
    <div className="container max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-3xl font-bold mb-2">Conditions générales d'utilisation</h1>
      <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="space-y-6 text-foreground text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Objet</h2>
          <p>
            Les présentes CGU régissent l'accès et l'utilisation du logiciel Asclion (web et desktop)
            ainsi que du site asclion.com. L'utilisation du service vaut acceptation pleine et
            entière des présentes conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Description du service</h2>
          <p>
            Asclion est un outil d'aide à la dispensation à destination des pharmaciens et de leurs
            équipes. Il propose, à partir d'une ordonnance saisie ou scannée, des suggestions de
            produits complémentaires et des phrases de conseil. Asclion <strong>n'établit aucun
            diagnostic</strong> et n'a pas vocation à être qualifié de dispositif médical au sens du
            règlement (UE) 2017/745.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Public concerné</h2>
          <p>
            L'accès au logiciel est strictement réservé aux professionnels de santé exerçant en
            officine et à leurs équipes habilitées. L'utilisateur garantit disposer de la qualité de
            professionnel de santé ou agir sous la responsabilité d'un pharmacien titulaire.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Compte et sécurité</h2>
          <p>
            L'utilisateur est responsable de la confidentialité de ses identifiants. Toute action
            effectuée via son compte est réputée avoir été effectuée par lui. Tout accès non autorisé
            doit être signalé sans délai à <a href="mailto:tanguytubert@gmail.com" className="text-primary underline">tanguytubert@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Responsabilités</h2>
          <p>
            Les suggestions affichées par Asclion sont indicatives. La décision finale de
            dispensation, de substitution ou de refus relève exclusivement du pharmacien, qui demeure
            seul responsable au regard du Code de la santé publique. Asclion ne saurait être tenue
            responsable d'une dispensation effectuée par l'utilisateur.
          </p>
          <p className="mt-2">
            Asclion s'engage à mettre en œuvre les moyens raisonnables pour assurer la disponibilité
            et l'exactitude du service, sans garantie de résultat. Une interruption de service pour
            maintenance, mise à jour ou cas de force majeure ne saurait engager sa responsabilité.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">6. Données personnelles</h2>
          <p>
            Le traitement des données est décrit dans la <Link to="/confidentialite" className="text-primary underline">politique de confidentialité</Link>.
            L'utilisateur s'engage à ne saisir dans Asclion aucune donnée patient identifiante autre
            que celle nécessaire à l'analyse d'une ordonnance dans le cadre normal de la dispensation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. Propriété intellectuelle</h2>
          <p>
            Le logiciel, sa base de connaissances clinique, ses interfaces et marques sont la
            propriété exclusive de l'éditeur. Une licence d'utilisation personnelle, non exclusive
            et non transférable est concédée pour la durée d'utilisation du service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">8. Résiliation</h2>
          <p>
            L'utilisateur peut clôturer son compte à tout moment via une demande à
            tanguytubert@gmail.com. Asclion peut suspendre ou résilier l'accès en cas de non-respect des
            présentes CGU, après notification.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">9. Droit applicable</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige sera soumis aux
            tribunaux compétents du ressort du siège social de l'éditeur, à défaut d'accord amiable
            préalable.
          </p>
        </section>
      </div>
    </div>
  </div>
  );
};

export default CGU;
