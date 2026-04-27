import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield, Lock, Database, FileText, Download, ExternalLink, Server } from "lucide-react";
import { Link } from "react-router-dom";

const ConformiteTab = () => {
  const handleDownloadPack = () => {
    // Génère un récapitulatif texte simple téléchargeable
    const content = `ASCLION — PACK DE CONFORMITÉ INTERNE
Généré le ${new Date().toLocaleString("fr-FR")}

═══════════════════════════════════════════════════
1. RGPD — STATUT
═══════════════════════════════════════════════════
✅ Registre des traitements (Article 30) : disponible dans /admin → RGPD
✅ Politique de Confidentialité publiée : /confidentialite
✅ CGU publiées : /cgu
✅ Procédure droit à l'effacement opérationnelle (edge function gdpr-data-request)
✅ Procédure droit à la portabilité opérationnelle (export JSON complet)
✅ DPA type signable disponible : /legal/dpa
✅ PIA simplifié disponible : /legal/pia

═══════════════════════════════════════════════════
2. SÉCURITÉ TECHNIQUE
═══════════════════════════════════════════════════
✅ Row-Level Security (RLS) activée sur toutes les tables sensibles
✅ Authentification JWT (Supabase Auth)
✅ Chiffrement TLS 1.3 en transit
✅ Hash SHA-256 irréversible des noms patients (PII scrubbing)
✅ Isolation par pharmacy_id (multi-tenant strict)
✅ Quotas applicatifs par pharmacie (anti-abus)
✅ Force-logout admin (révocation sessions)

═══════════════════════════════════════════════════
3. HÉBERGEMENT — ANALYSE HDS
═══════════════════════════════════════════════════
Hébergeur : Lovable Cloud (Supabase EU - Frankfurt, Allemagne)
Statut HDS : Non requis (justification ci-dessous)

Asclion ne traite PAS de données de santé directement identifiantes :
- Les noms patients sont hashés (SHA-256) avant tout stockage
- Aucun dossier médical n'est hébergé
- Les ordonnances ne sont pas conservées en image après extraction
- Les métadonnées sont anonymisées et liées à la pharmacie, pas au patient

Conformément à la doctrine ANS, les seuils d'identifiabilité ne sont pas atteints.
Le statut d'Hébergeur Données de Santé n'est donc pas requis.

═══════════════════════════════════════════════════
4. TRAÇABILITÉ CLINIQUE
═══════════════════════════════════════════════════
✅ 7 sources cliniques officielles référencées (BDPM, HAS, AMELI, OPENMEDIC, ATC/WHO, EMA, PubMed)
✅ Versionning automatique des règles cliniques (rule_version)
✅ Journal d'audit append-only (lineage_audit_log)
✅ Validation pharmacien horodatée (validated_at, validated_by)
✅ Vue unifiée v_clinical_lineage pour audits

═══════════════════════════════════════════════════
5. RESPONSABILITÉS
═══════════════════════════════════════════════════
- Asclion = Sous-traitant (au sens RGPD)
- Pharmacie cliente = Responsable de traitement
- DPA : signature recommandée à l'onboarding
- Notification de violation : engagement < 72h

═══════════════════════════════════════════════════
6. CONTACTS
═══════════════════════════════════════════════════
Conformité : voir /confidentialite pour les coordonnées DPO
Support sécurité : voir /mentions-legales

— Document généré automatiquement, à présenter aux acheteurs B2B (groupements, juristes, DSI).
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-pack-conformite-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Conformité &amp; Sécurité</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Synthèse opposable pour acheteurs B2B (groupements, juristes, DSI).
          </p>
        </div>
        <Button onClick={handleDownloadPack} variant="default">
          <Download className="h-4 w-4 mr-2" />
          Télécharger le pack
        </Button>
      </div>

      {/* RGPD */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">RGPD</h3>
          <Badge variant="default" className="ml-auto bg-emerald-600">À jour</Badge>
        </div>
        <ul className="space-y-2 text-sm">
          <ChecklistItem text="Registre des traitements (Article 30) géré dans l'onglet RGPD" />
          <ChecklistItem text="Politique de Confidentialité publiée" link="/confidentialite" />
          <ChecklistItem text="CGU publiées" link="/cgu" />
          <ChecklistItem text="DPA type signable" link="/legal/dpa" />
          <ChecklistItem text="PIA simplifié documenté" link="/legal/pia" />
          <ChecklistItem text="Droit à l'effacement opérationnel (anonymisation)" />
          <ChecklistItem text="Droit à la portabilité opérationnel (export JSON)" />
        </ul>
      </Card>

      {/* Sécurité technique */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Sécurité technique</h3>
          <Badge variant="default" className="ml-auto bg-emerald-600">Actif</Badge>
        </div>
        <ul className="space-y-2 text-sm">
          <ChecklistItem text="Row-Level Security (RLS) sur toutes les tables sensibles" />
          <ChecklistItem text="Authentification JWT (Supabase Auth)" />
          <ChecklistItem text="Chiffrement TLS 1.3 en transit" />
          <ChecklistItem text="Hash SHA-256 irréversible des noms patients" />
          <ChecklistItem text="Isolation multi-tenant par pharmacy_id" />
          <ChecklistItem text="Quotas applicatifs par pharmacie (anti-abus)" />
          <ChecklistItem text="Force-logout admin (révocation sessions)" />
        </ul>
      </Card>

      {/* Hébergement HDS */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Hébergement &amp; HDS</h3>
          <Badge variant="secondary" className="ml-auto">Non requis</Badge>
        </div>
        <div className="text-sm space-y-3">
          <p>
            <strong>Hébergeur :</strong> Lovable Cloud (Supabase EU — Frankfurt, Allemagne)
          </p>
          <p>
            <strong>Statut HDS :</strong> Non requis. Asclion ne traite pas de données de santé
            directement identifiantes : les noms patients sont hashés (SHA-256), aucun dossier
            médical n'est hébergé, aucune image d'ordonnance n'est conservée après extraction.
          </p>
          <p className="text-muted-foreground">
            Conformément à la doctrine de l'Agence du Numérique en Santé, les seuils
            d'identifiabilité ne sont pas atteints. La certification HDS n'est donc pas requise
            pour ce traitement.
          </p>
        </div>
      </Card>

      {/* Traçabilité clinique */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Traçabilité clinique</h3>
          <Badge variant="default" className="ml-auto bg-emerald-600">Opérationnelle</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Voir l'onglet <strong>Traçabilité</strong> pour le détail complet : sources cliniques,
          versionning des règles, journal d'audit.
        </p>
        <ul className="space-y-2 text-sm">
          <ChecklistItem text="7 sources officielles référencées (BDPM, HAS, AMELI, OPENMEDIC, ATC/WHO, EMA, PubMed)" />
          <ChecklistItem text="Versionning automatique des règles cliniques" />
          <ChecklistItem text="Journal d'audit append-only" />
          <ChecklistItem text="Validation pharmacien horodatée" />
        </ul>
      </Card>

      {/* Documents publics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Documents publics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <DocLink to="/mentions-legales" label="Mentions Légales" />
          <DocLink to="/confidentialite" label="Politique de Confidentialité" />
          <DocLink to="/cgu" label="CGU" />
          <DocLink to="/cookies" label="Politique Cookies" />
          <DocLink to="/legal/dpa" label="DPA type (sous-traitance)" />
          <DocLink to="/legal/pia" label="PIA simplifié" />
        </div>
      </Card>
    </div>
  );
};

const ChecklistItem = ({ text, link }: { text: string; link?: string }) => (
  <li className="flex items-start gap-2">
    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
    <span>
      {text}
      {link && (
        <Link to={link} className="ml-2 text-primary hover:underline inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </span>
  </li>
);

const DocLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    target="_blank"
    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors"
  >
    <span>{label}</span>
    <ExternalLink className="h-4 w-4 text-muted-foreground" />
  </Link>
);

export default ConformiteTab;
