import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

const CGV = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Conditions Générales de Vente — Asclion"
      description="Conditions générales de vente des abonnements Asclion : offres, prix HT, activation, résiliation et renouvellement."
      path="/cgv"
    />
    <SiteHeader />
    <main className="px-4 py-14">
      <article className="container max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Conditions Générales de Vente</h1>
          <p className="text-sm text-muted-foreground">
            Applicables aux souscriptions des offres Asclion Classique et Premium. Tous les prix
            sont exprimés hors taxes (HT) ; la TVA est appliquée selon la situation fiscale du
            client et la réglementation en vigueur.
          </p>
        </header>

        <Section title="1. Offres et prix">
          <p>
            <strong>Classique</strong> : 99 € HT/mois en abonnement mensuel, ou 990 € HT en
            paiement annuel d'avance. <strong>Premium</strong> : 149 € HT/mois en abonnement
            mensuel, ou 1 490 € HT en paiement annuel d'avance.
          </p>
          <p>
            Les offres sont souscrites par officine, avec un nombre de caisses illimité. Des frais
            de mise en place de 99 € HT sont facturés une seule fois sur les offres mensuelles ; ils
            sont offerts sur les offres annuelles.
          </p>
        </Section>

        <Section title="2. Contenu des offres">
          <p>
            Classique comprend la base de 30 000+ médicaments, la suggestion de produit
            complémentaire, le point de vigilance, la phrase conseil et l'apprentissage issu des
            retours de l'équipe. Premium ajoute l'audit initial du stock, les suggestions sur mesure
            selon le stock et son actualisation (mensuelle en abonnement mensuel, hebdomadaire en
            abonnement annuel). La formation visio et les suivis J+14 / J+30 sont inclus sur les
            offres annuelles.
          </p>
        </Section>

        <Section title="3. Durée et renouvellement">
          <p>
            L'abonnement mensuel est souscrit pour un mois et renouvelé par période d'un mois
            jusqu'à résiliation. Le consentement au paiement récurrent mensuel est recueilli
            explicitement lors de la souscription.
          </p>
          <p>
            L'offre annuelle est payée d'avance pour une durée de douze mois et{" "}
            <strong>n'est pas renouvelée automatiquement</strong>. Un e-mail de rappel est envoyé un
            mois avant l'échéance ; le renouvellement n'intervient que sur confirmation expresse du
            client et nouveau paiement.
          </p>
        </Section>

        <Section title="4. Activation">
          <p>
            L'accès est créé uniquement après confirmation définitive du paiement par notre
            prestataire de paiement. Après validation du compte, l'activation intervient sous 24 à
            48 h ouvrées. En cas de prélèvement SEPA, l'accès est préparé après confirmation finale
            du prélèvement par la banque.
          </p>
        </Section>

        <Section title="5. Résiliation">
          <p>
            L'abonnement mensuel est résiliable à tout moment depuis l'espace client, avec effet à
            la fin de la période déjà payée. Aucun remboursement commercial au prorata n'est dû en
            cas d'arrêt anticipé, sous réserve des droits légaux applicables.
          </p>
          <p>
            L'offre annuelle arrive à expiration au terme des douze mois en l'absence de nouveau
            paiement. Aucun remboursement n'est dû en cas de résiliation anticipée de l'offre
            annuelle, sous réserve des droits légaux applicables.
          </p>
        </Section>

        <Section title="6. Robots de délivrance">
          <p>
            Les officines équipées d'un robot de délivrance font l'objet d'une vérification de
            compatibilité préalable, selon la marque et le modèle. Aucun paiement n'est demandé
            avant la confirmation écrite de compatibilité.
          </p>
        </Section>

        <Section title="7. Paiement">
          <p>
            Les paiements sont traités par un prestataire de paiement agréé. Asclion ne stocke
            aucune donnée de carte bancaire. Moyens acceptés : carte bancaire (toutes offres),
            prélèvement SEPA (offres mensuelles), virement sur facture (sur demande).
          </p>
        </Section>

        <Section title="8. Nature du service et responsabilité">
          <p>
            Asclion fournit des suggestions à titre informatif au comptoir. La décision finale
            appartient toujours au pharmacien. Asclion n'est ni un dispositif médical de diagnostic,
            ni un remplacement du LGO, ni une garantie de résultat commercial.
          </p>
        </Section>

        <Section title="9. Support">
          <p>
            Le support est accessible depuis la page Aide. Les délais de réponse sont précisés dans
            l'espace client.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground italic">
          Version en cours de validation juridique. En cas de contradiction, les conditions
          affichées au moment du paiement prévalent.
        </p>
      </article>
    </main>
    <SiteFooter />
  </div>
);

export default CGV;
