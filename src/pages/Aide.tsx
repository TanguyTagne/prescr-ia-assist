import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, Mail } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";

const Aide = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" aria-label="Retour à l'accueil">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-foreground" />
            <h1 className="text-xl font-bold text-primary-foreground tracking-tight">Aide & FAQ</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-8 flex-1">
        <p className="text-sm text-muted-foreground mb-6">
          Réponses aux questions les plus fréquentes sur Asclion. Une autre question&nbsp;?
          <a href="mailto:support@asclion.com" className="text-primary hover:underline ml-1">Contactez-nous</a>.
        </p>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="scanner" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Comment connecter mon scanner d'ordonnances&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>
                Cliquez sur <strong>Connecter scanner</strong> dans le widget puis sélectionnez le dossier où votre scanner dépose les fichiers (PDF ou images).
                Asclion surveille en continu ce dossier et lance l'analyse automatiquement à chaque nouvelle ordonnance.
              </p>
              <p>
                Pour les scanners de codes-barres (douchettes USB), aucune configuration n'est nécessaire&nbsp;: branchez la douchette et scannez,
                Asclion détecte automatiquement la frappe rapide et lance la recherche.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="lgo" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Comment configurer mon LGO (Winpharma, LGPI, Pharmagest…)&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>
                Sur l'application desktop, Asclion détecte automatiquement votre LGO au démarrage et propose le bon preset.
                Vous pouvez aussi le configurer manuellement via le menu <strong>Réglages → Configuration avancée</strong> du widget.
              </p>
              <p>
                Le preset adapte la position et la taille du widget pour qu'il s'intègre parfaitement à côté de votre LGO sans le masquer.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recommendations" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Pourquoi un produit n'apparaît-il pas dans mes recommandations&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>
                Asclion s'appuie sur une base clinique curatée. Si un produit manque, deux causes possibles&nbsp;:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Le médicament détecté n'est pas encore couvert dans la base — signalez-le à <a href="mailto:support@asclion.com" className="text-primary hover:underline">support@asclion.com</a>.</li>
                <li>Vous avez personnalisé vos recommandations dans <strong>Dashboard → Personnalisation</strong> et le produit a été remplacé.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="performance" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Que faire si une analyse est lente&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>
                Le temps d'analyse cible est de 2,5 secondes. En cas de lenteur&nbsp;:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérifiez votre connexion Internet (un bandeau orange apparaît si Asclion détecte le mode hors ligne).</li>
                <li>Pour les ordonnances scannées en photo, privilégiez un format PDF ou JPG net pour accélérer l'OCR.</li>
                <li>Si le problème persiste, contactez le support avec le code de l'analyse affiché en bas du widget.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shortcuts" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Quels sont les raccourcis clavier&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <ul className="space-y-1">
                <li><kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Échap</kbd> — Nouvelle ordonnance / réinitialiser</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Entrée</kbd> — Lancer l'analyse</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Ctrl + K</kbd> — Focus saisie rapide</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Ctrl + 1/2/3</kbd> — Changer de mode (Saisie, Texte, Photo)</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">?</kbd> — Ouvrir cette page d'aide</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Personnalisables depuis <strong>Dashboard → Raccourcis clavier</strong>.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="privacy" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Mes données patient sont-elles stockées&nbsp;?</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>
                Aucune donnée patient identifiante n'est stockée. Les noms extraits des ordonnances sont anonymisés via un hash SHA-256
                avant tout enregistrement. Les analyses servent uniquement à mesurer la qualité des recommandations.
              </p>
              <p>
                Plus de détails dans notre <Link to="/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contact" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">Contacter le support</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-3">
              <p>
                Notre équipe répond sous 24&nbsp;h ouvrées.
              </p>
              <a href="mailto:support@asclion.com">
                <Button className="gap-2 pharmacy-gradient border-0">
                  <Mail className="h-4 w-4" />
                  support@asclion.com
                </Button>
              </a>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Aide;
