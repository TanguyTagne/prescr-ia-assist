import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const PIA = () => {
  const { t } = useI18n();
  const handleDownload = () => {
    const content = document.getElementById("pia-content")?.innerText || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-pia-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
        <article id="pia-content">
          <h1>Analyse d'Impact Relative à la Protection des Données (PIA)</h1>
          <p className="lead">
            Évaluation simplifiée selon la méthodologie CNIL — version 1.0
          </p>

          <h2>1. Description du traitement</h2>
          <p>
            Asclion est un logiciel d'aide à la dispensation pour pharmaciens d'officine. Il
            analyse les ordonnances (image ou texte), identifie les médicaments via correspondance
            avec la base BDPM, et propose des produits complémentaires en libre accès (OTC).
          </p>
          <p>
            <strong>Données traitées :</strong> hash anonyme du nom patient (SHA-256), liste des
            médicaments, métadonnées techniques (timestamps, pharmacy_id).
          </p>
          <p>
            <strong>Personnes concernées :</strong> patients (indirectement, via hash),
            pharmaciens utilisateurs.
          </p>

          <h2>2. Nécessité et proportionnalité</h2>
          <p>
            <strong>Finalité :</strong> améliorer la pertinence du conseil pharmaceutique et
            détecter les besoins associés au traitement principal.
          </p>
          <p>
            <strong>Base légale :</strong> intérêt légitime du pharmacien (mission de service
            public de santé) + consentement implicite au comptoir (acte de dispensation).
          </p>
          <p>
            <strong>Minimisation :</strong> aucune donnée nominative n'est conservée. Le hash est
            irréversible. Les ordonnances en image ne sont pas stockées après extraction.
          </p>
          <p>
            <strong>Durée :</strong> 24 mois puis anonymisation totale (purge des hashes).
          </p>

          <h2>3. Risques pour les personnes</h2>
          <table>
            <thead>
              <tr>
                <th>Risque</th>
                <th>Vraisemblance</th>
                <th>Gravité</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Accès illégitime aux données</td>
                <td>Faible</td>
                <td>Faible (hash irréversible)</td>
              </tr>
              <tr>
                <td>Modification non désirée</td>
                <td>Très faible</td>
                <td>Faible (audit log append-only)</td>
              </tr>
              <tr>
                <td>Disparition de données</td>
                <td>Faible</td>
                <td>Modérée (backups quotidiens UE)</td>
              </tr>
              <tr>
                <td>Réidentification</td>
                <td>Très faible</td>
                <td>Modérée (hash + sel)</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Mesures pour traiter les risques</h2>
          <ul>
            <li><strong>Pseudonymisation :</strong> hash SHA-256 systématique des noms patients</li>
            <li><strong>Chiffrement :</strong> TLS 1.3 en transit, AES-256 au repos (Supabase)</li>
            <li><strong>Contrôle d'accès :</strong> Row-Level Security PostgreSQL, JWT, isolation par pharmacy_id</li>
            <li><strong>Traçabilité :</strong> journal d'audit append-only sur toutes les modifications cliniques</li>
            <li><strong>Quotas :</strong> limites applicatives par pharmacie pour détecter les abus</li>
            <li><strong>Hébergement :</strong> UE uniquement (Frankfurt, Allemagne)</li>
            <li><strong>Suppression :</strong> droit à l'effacement opérationnel via interface utilisateur</li>
            <li><strong>Sensibilisation :</strong> formation des équipes via /aide</li>
          </ul>

          <h2>5. Validation</h2>
          <p>
            Le présent PIA conclut que le traitement <strong>ne présente pas de risques élevés</strong>
            pour les droits et libertés des personnes concernées, au sens de l'article 35 du RGPD.
          </p>
          <p>
            Le seuil de réalisation d'une AIPD complète (analyse d'impact détaillée) n'est pas
            atteint, car :
          </p>
          <ul>
            <li>Les données ne sont pas directement identifiantes (hash irréversible)</li>
            <li>Aucun profilage automatisé à effet juridique n'est réalisé</li>
            <li>Le volume traité ne constitue pas un traitement à grande échelle au sens CNIL</li>
            <li>Aucune donnée de santé directement nominative n'est hébergée</li>
          </ul>

          <h2>6. Plan d'action et révision</h2>
          <ul>
            <li>Révision annuelle du présent PIA</li>
            <li>Révision immédiate en cas d'évolution majeure des fonctionnalités</li>
            <li>Tests de restauration backups (trimestriel)</li>
            <li>Audit de sécurité externe (annuel, à la demande des groupements clients)</li>
          </ul>

          <hr />
          <p className="text-xs text-muted-foreground">
            Document version 1.0 — Généré automatiquement par Asclion. Pour toute question,
            contactez le DPO via les coordonnées indiquées sur la <Link to="/confidentialite">Politique de Confidentialité</Link>.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default PIA;
