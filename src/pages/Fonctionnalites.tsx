import { ArrowLeft, ScanLine, FileSearch, Brain, ShoppingBag, Keyboard, Package, Monitor, Shield, BarChart3, Bell, Users, Network, Sparkles, Wrench, BookOpen, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

interface Feature {
  icon: any;
  title: string;
  description: string;
  details: string[];
}

const sections: { title: string; features: Feature[] }[] = [
  {
    title: "Au comptoir — analyse instantanée",
    features: [
      {
        icon: ScanLine,
        title: "Scan douchette zéro-config",
        description: "Branchez la douchette et scannez : Asclion détecte automatiquement le code-barres du médicament, sans configuration.",
        details: [
          "Compatible avec toute douchette HID standard (USB ou Bluetooth)",
          "Capture globale : fonctionne même si le widget n'a pas le focus",
          "Reconnaissance instantanée du CIP français",
        ],
      },
      {
        icon: FileSearch,
        title: "Surveillance de dossier",
        description: "Asclion détecte automatiquement chaque ordonnance scannée déposée dans le dossier configuré.",
        details: [
          "PDF et images (JPG, PNG) acceptés",
          "Aucun bouton à cliquer — l'analyse démarre dès la détection",
          "Compatible avec scanners de bureau classiques",
        ],
      },
      {
        icon: Brain,
        title: "Analyse clinique en moins de 2,5 s",
        description: "L'IA extrait les médicaments, identifie les pathologies et propose des recommandations en temps réel.",
        details: [
          "Pipeline optimisé Gemini Flash via Lovable AI",
          "Reconnaissance par fuzzy matching (ignore dosage et forme galénique)",
          "Fallback automatique RxNav et OpenFDA si non trouvé en local",
        ],
      },
    ],
  },
  {
    title: "Recommandations & conseil",
    features: [
      {
        icon: ShoppingBag,
        title: "Produits complémentaires intelligents",
        description: "Asclion suggère les meilleurs produits associés à chaque ordonnance, avec phrases de conseil prêtes à dire.",
        details: [
          "Top 3 si 1 médicament, Top 2 si 2 médicaments, Top 1 si 3+",
          "Maximum 1 besoin latent par ordonnance pour rester pertinent",
          "Phrases mi-commerciales / mi-techniques (15-25 mots)",
        ],
      },
      {
        icon: Sparkles,
        title: "Détection des besoins latents",
        description: "Au-delà du traitement, Asclion identifie les besoins réels du patient (confort, prévention, accompagnement).",
        details: [
          "Réduit les effets indésirables iatrogènes",
          "Accompagne l'efficacité du traitement",
          "Score d'impact pondéré (20% du score final)",
        ],
      },
      {
        icon: Package,
        title: "Personnalisation par pharmacie",
        description: "Substituez les catégories génériques par vos propres références en stock LGO.",
        details: [
          "Mapping personnalisé par produit et catégorie",
          "Push automatique au panier LGO (Winpharma, LGPI, Pharmagest)",
          "Prix et disponibilité en temps réel",
        ],
      },
    ],
  },
  {
    title: "Productivité & ergonomie",
    features: [
      {
        icon: Keyboard,
        title: "Raccourcis clavier configurables",
        description: "Validez, refusez ou commandez sans toucher à la souris.",
        details: [
          "Raccourcis personnalisables par utilisateur",
          "Touche Échap pour réinitialiser instantanément",
          "Workflow sans friction pensé pour la cadence comptoir",
        ],
      },
      {
        icon: Bell,
        title: "Rappels patients (CRM)",
        description: "Asclion peut programmer des SMS de rappel de fin de traitement (nécessite Twilio).",
        details: [
          "Détection automatique de la durée de traitement",
          "Hash patient anonymisé (RGPD)",
          "Suivi des rappels envoyés depuis l'admin",
        ],
      },
      {
        icon: BookOpen,
        title: "Quiz de formation continue",
        description: "Sessions de 10 questions générées depuis votre base clinique réelle.",
        details: [
          "Renforce les réflexes de conseil officinal",
          "Adapté aux préparateurs comme aux pharmaciens",
          "Génération dynamique — jamais deux fois le même quiz",
        ],
      },
    ],
  },
  {
    title: "Pilotage & équipe",
    features: [
      {
        icon: BarChart3,
        title: "Dashboard KPI temps réel",
        description: "Suivez ordonnances analysées, taux de conversion, top catégories et temps de réponse.",
        details: [
          "Comparaison avec moyenne du benchmark anonymisé",
          "Filtrage par caisse et par utilisateur",
          "Export pour analyse externe",
        ],
      },
      {
        icon: Users,
        title: "Rôles préparateur / manager / admin",
        description: "Accès gradué selon le rôle, conforme aux exigences RGPD.",
        details: [
          "Préparateur : analyse au comptoir uniquement",
          "Manager : KPI pharmacie + rappels patients",
          "Admin : configuration LGO et accès complet",
        ],
      },
      {
        icon: Network,
        title: "Espace groupement",
        description: "Pour les groupements : pilotage multi-pharmacies, mappings prioritaires et reporting laboratoires.",
        details: [
          "Insights agrégés sans accès aux données brutes",
          "Mapping de produits prioritaires par catégorie",
          "Alertes automatiques sur anomalies de couverture",
        ],
      },
    ],
  },
  {
    title: "Installation & sécurité",
    features: [
      {
        icon: Monitor,
        title: "Application desktop Windows",
        description: "Installation un clic, lancement en plein écran, mises à jour automatiques.",
        details: [
          "Cache nettoyé à chaque démarrage (toujours la dernière version)",
          "Fonctionne en parallèle de votre LGO",
          "Aucun navigateur requis",
        ],
      },
      {
        icon: Lock,
        title: "Données patient protégées",
        description: "Aucune donnée patient identifiable ne sort de la pharmacie.",
        details: [
          "Hashes anonymes uniquement en base",
          "RLS strict + JWT sur chaque requête",
          "Conforme RGPD B2B opposable",
        ],
      },
      {
        icon: Wrench,
        title: "Diagnostic hardware intégré",
        description: "Vérifiez en direct le bon fonctionnement de la douchette et du dossier surveillé.",
        details: [
          "Test en temps réel des entrées clavier",
          "Validation du dossier de scan",
          "Export du rapport en cas de problème support",
        ],
      },
    ],
  },
];

const Fonctionnalites = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t("seo.features.title")}
        description={t("seo.features.desc")}
        path="/fonctionnalites"
      />

      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground tracking-tight">Fonctionnalités Asclion</h1>
            <p className="text-xs text-primary-foreground/70">Tout ce que votre copilote sait faire</p>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-10">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Asclion, en une phrase</p>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Un copilote invisible qui analyse chaque ordonnance en moins de 2,5 secondes et propose les bons produits complémentaires avec les bonnes phrases de conseil — sans changer votre LGO.
            </p>
          </div>
        </div>

        {sections.map((section) => (
          <section key={section.title} className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight border-b border-border pb-2">{section.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.features.map((f) => (
                <Card key={f.title} className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <f.icon className="h-4 w-4 text-primary flex-shrink-0" />
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-foreground/80 leading-relaxed">{f.description}</p>
                    <ul className="space-y-1">
                      {f.details.map((d) => (
                        <li key={d} className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-lg border border-border p-5 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Une question, un bug, une suggestion ?
          </p>
          <a href="mailto:support@asclion.com" className="text-sm text-primary hover:underline font-medium">
            support@asclion.com
          </a>
        </div>
      </main>
    </div>
  );
};

export default Fonctionnalites;
