import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const DPA = () => {
  const { t } = useI18n();
  const handleDownload = () => {
    const content = document.getElementById("dpa-content")?.innerText || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-dpa-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title={t("seo.legal.dpa.title")} description={t("seo.legal.dpa.desc")} path="/legal/dpa" />
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">Asclion</Link>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 prose prose-sm dark:prose-invert">
        <article id="dpa-content">
          <h1>Accord de Traitement de Données (DPA)</h1>
          <p className="lead">
            Document type — modèle de Data Processing Agreement entre Asclion (sous-traitant) et
            la pharmacie cliente (responsable de traitement), conforme aux articles 28 et 29 du RGPD.
          </p>

          <h2>1. Parties</h2>
          <p>
            <strong>Sous-traitant :</strong> Asclion — éditeur du logiciel d'aide à la dispensation.
            <br />
            <strong>Responsable de traitement :</strong> la pharmacie cliente, telle qu'identifiée
            dans son contrat d'abonnement.
          </p>

          <h2>2. Objet</h2>
          <p>
            Le présent accord définit les conditions dans lesquelles Asclion traite, pour le compte
            du Responsable, les données à caractère personnel nécessaires à la fourniture du
            service d'analyse d'ordonnance et de recommandation de produits complémentaires.
          </p>

          <h2>3. Durée</h2>
          <p>
            Le présent accord s'applique pendant toute la durée du contrat principal et survit à sa
            résiliation pour les obligations de restitution et de suppression des données.
          </p>

          <h2>4. Nature et finalité du traitement</h2>
          <ul>
            <li>Analyse d'ordonnance (extraction texte, identification médicaments)</li>
            <li>Recommandation de produits complémentaires (OTC, conseils associés)</li>
            <li>Suivi anonymisé des KPIs commerciaux (taux de conversion, paniers moyens)</li>
            <li>CRM patient anonymisé (rappels de fin de traitement, opt-in)</li>
          </ul>

          <h2>5. Catégories de données</h2>
          <ul>
            <li>Hash SHA-256 irréversible du nom patient (pas de PII directe)</li>
            <li>Liste des médicaments dispensés (nom commercial, CIP)</li>
            <li>Métadonnées techniques (timestamps, identifiants pharmacie)</li>
            <li>Numéro de téléphone patient (chiffré, opt-in pour rappels)</li>
          </ul>

          <h2>6. Localisation des données</h2>
          <p>
            Toutes les données sont hébergées au sein de l'Union Européenne, sur l'infrastructure
            Lovable Cloud (Supabase) — région Frankfurt (Allemagne). Aucun transfert hors UE n'est
            réalisé sans garanties appropriées (Clauses Contractuelles Types).
          </p>

          <h2>7. Obligations du sous-traitant</h2>
          <ul>
            <li>Traiter les données uniquement sur instructions documentées du Responsable</li>
            <li>Garantir la confidentialité par toute personne autorisée à traiter les données</li>
            <li>
              Mettre en œuvre les mesures techniques et organisationnelles appropriées :
              chiffrement TLS 1.3, RLS PostgreSQL, JWT, hash patient, isolation multi-tenant
            </li>
            <li>
              Notifier toute violation de données dans un délai maximum de <strong>72 heures</strong>
            </li>
            <li>Aider le Responsable dans l'exercice des droits des personnes concernées</li>
            <li>Permettre et contribuer à des audits, à la demande du Responsable</li>
          </ul>

          <h2>8. Sous-traitants ultérieurs</h2>
          <p>
            Asclion fait appel aux sous-traitants ultérieurs suivants, autorisés par le Responsable :
          </p>
          <ul>
            <li><strong>Supabase / Lovable Cloud</strong> — hébergement infrastructure (UE)</li>
            <li><strong>Resend</strong> — envoi emails transactionnels</li>
            <li><strong>Twilio</strong> — envoi SMS rappels (si fonctionnalité activée)</li>
            <li><strong>Google Cloud (Gemini API via Lovable AI Gateway)</strong> — analyse linguistique des ordonnances</li>
          </ul>

          <h2>9. Droits des personnes concernées</h2>
          <p>
            Le Responsable dispose, via son interface administrateur, d'outils permettant
            d'exercer immédiatement les droits suivants pour le compte des personnes concernées :
          </p>
          <ul>
            <li>Droit à la portabilité (export JSON complet — Article 20)</li>
            <li>Droit à l'effacement / anonymisation (Article 17)</li>
            <li>Droit d'accès aux données (Article 15)</li>
          </ul>

          <h2>10. Sort des données en fin de contrat</h2>
          <p>
            À la résiliation du contrat principal, et sur demande écrite du Responsable, Asclion
            procède soit à la restitution complète des données (export JSON), soit à leur
            anonymisation irréversible, dans un délai maximum de <strong>30 jours</strong>.
          </p>

          <h2>11. Audit</h2>
          <p>
            Le Responsable peut, après préavis raisonnable de 30 jours, demander un audit
            documentaire des mesures de sécurité mises en œuvre. Asclion fournit les rapports
            disponibles (registre des traitements, journal d'audit clinique, lineage_audit_log).
          </p>

          <h2>12. Signature</h2>
          <p>
            Ce document peut être signé électroniquement et joint au contrat principal. Les deux
            parties reconnaissent en avoir pris connaissance et acceptent ses termes.
          </p>

          <hr />
          <p className="text-xs text-muted-foreground">
            Document version 1.0 — généré automatiquement par Asclion. Pour toute question,
            contactez le DPO via les coordonnées indiquées sur la <Link to="/confidentialite">Politique de Confidentialité</Link>.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default DPA;
