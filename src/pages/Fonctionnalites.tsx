import { ArrowLeft, ScanLine, FileSearch, Brain, ShoppingBag, Keyboard, Package, Monitor, BarChart3, Bell, Users, Network, Sparkles, Wrench, BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    title: "Au comptoir — lecture instantanée",
    features: [
      {
        icon: ScanLine,
        title: "Scan douchette zéro-config",
        description: "Branchez la douchette et scannez. Asclion reconnaît le CIP, sans paramétrage par poste.",
        details: [
          "Compatible toute douchette HID standard (USB ou Bluetooth)",
          "Capture globale : fonctionne même si le widget n'a pas le focus",
          "Reconnaissance instantanée du CIP français",
        ],
      },
      {
        icon: FileSearch,
        title: "Surveillance de dossier",
        description: "Le scanner de bureau dépose l'ordonnance dans un dossier, Asclion la prend en charge dès qu'elle apparaît.",
        details: [
          "PDF et images (JPG, PNG) acceptés",
          "Aucun bouton à cliquer — l'analyse démarre dès la détection",
          "Compatible avec les scanners de bureau classiques",
        ],
      },
      {
        icon: Brain,
        title: "Lecture clinique en moins de 2,5 s",
        description: "Extraction des molécules, identification des pathologies probables et propositions, en temps réel.",
        details: [
          "Réponse sous 2,5 s, y compris en pic du samedi matin",
          "Reconnaissance par fuzzy matching (ignore dosage et forme galénique)",
          "Repli automatique RxNav / OpenFDA si le médicament n'est pas en base locale",
        ],
      },
    ],
  },
  {
    title: "Recommandations & conseil",
    features: [
      {
        icon: ShoppingBag,
        title: "Produits réellement utiles",
        description: "Asclion sélectionne les complémentaires pertinents pour ce patient, avec la phrase prête à dire.",
        details: [
          "Top 3 si 1 médicament, Top 2 si 2, Top 1 dès 3 — pour rester lisible",
          "Maximum 1 besoin latent par ordonnance",
          "Phrases mi-techniques mi-commerciales (15–25 mots)",
        ],
      },
      {
        icon: Sparkles,
        title: "Détection des besoins latents",
        description: "Au-delà du traitement : confort, prévention, accompagnement de l'efficacité.",
        details: [
          "Cible la réduction des effets indésirables iatrogènes",
          "Accompagne l'efficacité du traitement",
          "Pondération à 20 % du score final pour rester juste",
        ],
      },
      {
        icon: Package,
        title: "Personnalisation par pharmacie",
        description: "Substituez les catégories génériques par vos références en stock.",
        details: [
          "Mapping personnalisé par produit et par catégorie",
          "Push direct au panier LGO (Winpharma, LGPI, Pharmagest)",
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
        title: "Raccourcis clavier",
        description: "Validez, refusez ou commandez sans toucher à la souris.",
        details: [
          "Raccourcis personnalisables par utilisateur",
          "Touche Échap pour réinitialiser instantanément",
          "Pensé pour la cadence comptoir",
        ],
      },
      {
        icon: Bell,
        title: "Rappels patients",
        description: "SMS de rappel de fin de traitement programmés depuis l'historique (Twilio requis).",
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
        title: "Dashboard KPI",
        description: "Ordonnances analysées, taux de conversion, top catégories, temps de réponse.",
        details: [
          "Comparaison avec la médiane du benchmark anonymisé",
          "Filtrage par caisse et par utilisateur",
          "Export pour analyse externe",
        ],
      },
      {
        icon: Users,
        title: "Rôles gradués",
        description: "Préparateur, manager, admin — accès conforme RGPD.",
        details: [
          "Préparateur : analyse au comptoir uniquement",
          "Manager : KPI pharmacie + rappels patients",
          "Admin : configuration LGO et accès complet",
        ],
      },
      {
        icon: Network,
        title: "Espace groupement",
        description: "Pilotage multi-pharmacies, mappings prioritaires et reporting laboratoires.",
        details: [
          "Insights agrégés sans accès aux données brutes",
          "Mapping de produits prioritaires par catégorie",
          "Alertes sur anomalies de couverture",
        ],
      },
    ],
  },
  {
    title: "Installation & sécurité",
    features: [
      {
        icon: Monitor,
        title: "Application Windows",
        description: "Installation un clic, lancement plein écran, mises à jour automatiques.",
        details: [
          "Cache nettoyé à chaque démarrage (toujours la dernière version)",
          "Tourne en parallèle de votre LGO",
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
        description: "Vérifiez en direct la douchette et le dossier surveillé.",
        details: [
          "Test temps réel des entrées clavier",
          "Validation du dossier de scan",
          "Export du rapport en cas de ticket support",
        ],
      },
    ],
  },
];

const Fonctionnalites = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t("seo.features.title")}
        description={t("seo.features.desc")}
        path="/fonctionnalites"
      />

      <header className="border-b border-border">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold tracking-tight">Asclion</span>
          <span className="mono-label hidden sm:inline">/ fonctionnalités</span>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-16 space-y-20">
        <div className="space-y-4">
          <p className="mono-label">Vue d'ensemble</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] leading-tight">
            Tout ce que l'outil fait au comptoir.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed border-l-2 border-primary pl-4">
            Asclion lit chaque ordonnance en moins de 2,5 secondes, propose les bons produits complémentaires et la phrase à dire — sans changer votre LGO.
          </p>
        </div>

        {sections.map((section, sIdx) => (
          <section key={section.title} className="space-y-8">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
              <span className="mono-label">{String(sIdx + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}</span>
            </div>
            <div className="space-y-10">
              {section.features.map((f) => (
                <article key={f.title} className="grid grid-cols-[24px_1fr] gap-x-4 gap-y-2">
                  <f.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="text-base font-medium">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                  <div />
                  <ul className="space-y-1.5">
                    {f.details.map((d) => (
                      <li key={d} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                        <span className="text-primary/60 select-none">—</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}

        <div className="border-t border-border pt-8 text-sm text-muted-foreground">
          Une question, un bug, une suggestion ?{" "}
          <a href="mailto:support@asclion.com" className="text-primary underline underline-offset-2">
            support@asclion.com
          </a>
        </div>
      </main>
    </div>
  );
};

export default Fonctionnalites;
