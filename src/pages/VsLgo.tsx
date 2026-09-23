import { Link } from "react-router-dom";
import { ArrowRight, Layers, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const ROWS = [
  {
    q: "Facturation et gestion d'officine",
    lgo: "Rôle principal du LGO",
    asclion: "Ne remplace pas ce rôle",
  },
  {
    q: "Moment d'intervention",
    lgo: "Selon le paramétrage du LGO",
    asclion: "Application de suggestion au scan, selon compatibilité",
  },
  {
    q: "Conseil associé",
    lgo: "À vérifier selon l'environnement",
    asclion: "Produit complémentaire du médicament scanné présenté en surcouche",
  },
  {
    q: "Décision finale",
    lgo: "Pharmacien",
    asclion: "Pharmacien",
  },
];

const VsLgo = () => {
  const { lp } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Asclion et votre LGO — une surcouche, pas un remplacement"
        description="Votre LGO gère l'officine. Asclion affiche le produit complémentaire associé au médicament scanné."
        path="/vs-lgo"
      />
      <SiteHeader />

      <main className="px-4 py-14">
        <div className="container max-w-3xl mx-auto space-y-10">
          <header className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Votre LGO gère l'officine.{" "}
              <span className="text-primary">Asclion accompagne le conseil au comptoir.</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Asclion est une surcouche discrète qui s'affiche au scan d'un médicament, à côté de
              votre logiciel de gestion d'officine. Elle ne le remplace pas et ne modifie pas vos
              données.
            </p>
          </header>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-4 font-semibold">Question</th>
                  <th className="text-left p-4 font-semibold">LGO</th>
                  <th className="text-left p-4 font-semibold">Asclion</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.q} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium align-top">{r.q}</td>
                    <td className="p-4 text-muted-foreground align-top">{r.lgo}</td>
                    <td className="p-4 align-top">{r.asclion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="rounded-2xl border border-border bg-card p-7 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold tracking-tight">Comment ils cohabitent</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Vous scannez un médicament dans votre LGO, comme d'habitude.
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                L'application Asclion apparaît en surcouche, sans prendre le focus de la souris, et
                repasse au second plan après un clic extérieur.
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Elle présente le produit complémentaire associé au médicament scanné.
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Vous proposez ou ignorez : la décision reste au comptoir.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-7 space-y-3">
            <h2 className="text-lg font-bold tracking-tight">Compatibilité et limites</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              La compatibilité est confirmée selon votre environnement (LGO et version) avant
              l'activation. Les officines équipées d'un robot de délivrance font l'objet d'une
              vérification préalable selon la marque et le modèle — aucun paiement n'est demandé
              avant cette validation.
            </p>
            <Button variant="outline" asChild className="gap-2">
              <Link to={lp("/compatibilite-robot")}>Vérifier la compatibilité de mon robot</Link>
            </Button>
          </section>

          <div className="text-center">
            <Button size="lg" asChild className="pharmacy-gradient border-0 font-semibold gap-2">
              <Link to={lp("/fonctionnalites")}>
                Voir le fonctionnement <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default VsLgo;
