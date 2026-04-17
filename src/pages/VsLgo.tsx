import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, Brain, ShieldCheck, MessageSquare, BarChart3, RefreshCw, Layers, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const differentiators = [
  {
    icon: ShieldCheck,
    title: "Indépendance commerciale = confiance clinique",
    lgo: "Les LGO sont financés par les laboratoires : les suggestions sont souvent du référencement sponsorisé.",
    asclion: "Asclion est pharmacien-first. Les recommandations reposent sur la pertinence clinique réelle (molécule, ATC, pathologie), jamais sur un deal marketing.",
    pitch: "« Nous ne vendons pas votre écran aux labos. »",
  },
  {
    icon: Brain,
    title: "Raisonnement IA vs règles figées",
    lgo: "Table de correspondance CIP → CIP, quelques milliers de règles statiques négociées avec les labos.",
    asclion: "Pipeline clinique multi-niveaux (Médicament → Molécule → ATC → Pathologie → PC) couvrant des millions de combinaisons, avec détection des interactions et des besoins latents (ex : AINS → protection gastrique).",
    pitch: "Le système comprend la prescription, il ne fait pas que la lire.",
  },
  {
    icon: MessageSquare,
    title: "Phrases conseil « prêtes à dire »",
    lgo: "Affiche un nom de produit. Le préparateur doit improviser le discours.",
    asclion: "Phrase complète mi-technique mi-commerciale (15-25 mots) que le préparateur lit ou adapte. Débloque les équipes non-formées au conseil (intérimaires, jeunes diplômés).",
    pitch: "Le conseil est dit, pas seulement affiché.",
  },
  {
    icon: BarChart3,
    title: "Multi-caisses synchronisées + benchmark anonymisé",
    lgo: "KPIs basiques par caisse, aucune comparaison externe.",
    asclion: "Benchmark inter-officines anonymisé : « Votre taux de conversion est de 18 %, la médiane du réseau est à 24 %. » Le titulaire dispose d'une vue stratégique sur sa performance conseil.",
    pitch: "Vous savez enfin où vous vous situez.",
  },
  {
    icon: RefreshCw,
    title: "Feedback loop qui apprend",
    lgo: "Les règles ne bougent jamais.",
    asclion: "Chaque clic « Commander » ou « Ignorer » alimente le moteur. Les recommandations s'adaptent à la patientèle locale et aux préférences de l'équipe. Mapping personnalisé par marque partenaire.",
    pitch: "Plus vous l'utilisez, plus il devient précis.",
  },
  {
    icon: Layers,
    title: "Mode « overlay » non-intrusif",
    lgo: "Il faut cliquer dans plusieurs menus pour voir la suggestion. Résultat : personne ne la voit.",
    asclion: "Widget flottant qui apparaît automatiquement quand l'ordonnance est scannée (douchette, dossier surveillé, OCR). Zéro friction = adoption réelle au comptoir.",
    pitch: "Invisible quand inutile, présent quand nécessaire.",
  },
  {
    icon: Unlock,
    title: "Indépendance LGO = portabilité",
    lgo: "Si la pharmacie change de LGO (Winpharma → LGPI), elle perd tout son historique conseil.",
    asclion: "Asclion fonctionne par-dessus n'importe quel LGO via API. L'investissement est protégé, l'intelligence conseil reste à la pharmacie.",
    pitch: "Votre intelligence conseil vous appartient, pas à votre éditeur LGO.",
  },
];

const comparisonRows = [
  { criteria: "Logique de recommandation", lgo: "Règles CIP figées", asclion: "IA clinique multi-niveaux", winner: "asclion" },
  { criteria: "Modèle de financement", lgo: "Laboratoires (biais)", asclion: "Pharmacie (neutre)", winner: "asclion" },
  { criteria: "Phrase conseil prête à dire", lgo: false, asclion: true, winner: "asclion" },
  { criteria: "Multi-caisses & KPIs", lgo: "Basique", asclion: "Avancé + benchmark anonymisé", winner: "asclion" },
  { criteria: "Apprentissage continu", lgo: false, asclion: true, winner: "asclion" },
  { criteria: "Portabilité LGO", lgo: false, asclion: "Universel (Winpharma, LGPI, Pharmagest, Smart Rx)", winner: "asclion" },
  { criteria: "Délai d'analyse", lgo: "Instantané (basique)", asclion: "< 2,5 s (raisonnement complet)", winner: "asclion" },
  { criteria: "Détection interactions médicamenteuses", lgo: "Limité", asclion: "Complet (majeure / modérée / mineure)", winner: "asclion" },
  { criteria: "Besoins latents (ex : AINS → IPP)", lgo: false, asclion: true, winner: "asclion" },
];

export default function VsLgo() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-[40%] -left-40 h-[400px] w-[400px] rounded-full bg-pharmacy-teal/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[450px] w-[450px] rounded-full bg-pharmacy-warm/10 blur-3xl" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/70 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </Link>
            <span className="text-lg font-bold tracking-tight">Asclion</span>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
            Comparatif
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Asclion <span className="text-muted-foreground/60">vs</span>{" "}
            <span className="bg-gradient-to-r from-primary to-pharmacy-teal bg-clip-text text-transparent">LGO</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Winpharma, LGPI, Pharmagest, Smart Rx proposent déjà du conseil associé.
            Voici pourquoi Asclion change la donne.
          </p>
        </section>

      {/* One-liner pitch */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-16">
        <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <p className="text-xl sm:text-2xl font-medium leading-relaxed text-center italic">
            « Winpharma vous propose des produits que les labos ont payés pour mettre en avant.
            Asclion vous propose ce dont le patient a réellement besoin, avec la phrase exacte à dire.
            Et ça marche sur tous les LGO. »
          </p>
        </Card>
      </section>

      {/* 7 Differentiators */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Les 7 différenciateurs forts
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Ce qu'Asclion fait, et que les modules conseil intégrés aux LGO ne font pas.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {differentiators.map((d, i) => {
            const Icon = d.icon;
            return (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                      Différenciateur {i + 1}
                    </div>
                    <h3 className="text-lg font-bold leading-tight">{d.title}</h3>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-md bg-destructive/5 border border-destructive/10">
                    <div className="flex items-center gap-2 mb-1">
                      <X className="h-3.5 w-3.5 text-destructive" />
                      <span className="font-semibold text-destructive">LGO classique</span>
                    </div>
                    <p className="text-muted-foreground">{d.lgo}</p>
                  </div>

                  <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold text-primary">Asclion</span>
                    </div>
                    <p className="text-foreground">{d.asclion}</p>
                  </div>

                  <p className="text-xs italic text-muted-foreground pt-1">
                    💬 {d.pitch}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Tableau comparatif
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Les critères qui comptent vraiment au comptoir.
        </p>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-semibold">Critère</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">LGO (Winpharma / LGPI)</th>
                  <th className="text-left p-4 font-semibold text-primary">Asclion</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{row.criteria}</td>
                    <td className="p-4 text-muted-foreground">
                      {typeof row.lgo === "boolean" ? (
                        row.lgo ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />
                      ) : (
                        row.lgo
                      )}
                    </td>
                    <td className="p-4">
                      {typeof row.asclion === "boolean" ? (
                        row.asclion ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />
                      ) : (
                        <span className="font-medium">{row.asclion}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Voir Asclion en action
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          10 minutes de démo suffisent pour comprendre la différence.
        </p>
        <Link to="/">
          <Button size="lg" className="pharmacy-gradient border-0">
            Demander une démo
            <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>© Asclion — Le copilote IA des pharmaciens</p>
      </footer>
    </div>
  );
}
