import { useState, useEffect } from "react";
import { Download, Monitor, Chrome, CheckCircle2, ArrowRight, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status */}
      {isInstalled ? (
        <div className="rounded-xl border-2 border-primary/30 bg-accent/30 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-sm">PrescrIA est installée !</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              L'application est disponible sur votre bureau. Vous pouvez fermer cet onglet.
            </p>
          </div>
        </div>
      ) : deferredPrompt ? (
        <div className="rounded-xl border-2 border-primary/30 bg-accent/30 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Download className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Prêt à installer</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliquez pour ajouter PrescrIA sur votre bureau
              </p>
            </div>
          </div>
          <Button onClick={handleInstall} className="w-full h-12 text-base font-semibold pharmacy-gradient border-0 gap-2">
            <Download className="h-5 w-5" />
            Installer PrescrIA
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-border bg-secondary/50 p-5 flex items-center gap-3">
          <Chrome className="h-6 w-6 text-muted-foreground shrink-0" />
          <div>
            <p className="font-semibold text-sm">Installation manuelle</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suivez le tutoriel ci-dessous pour installer PrescrIA
            </p>
          </div>
        </div>
      )}

      {/* Tutorial */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          Guide d'installation sur le poste préparateur
        </h3>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-4">
              <p className="font-semibold text-sm">Ouvrir PrescrIA dans Chrome ou Edge</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Sur le PC du préparateur, ouvrez <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> et connectez-vous à votre compte PrescrIA.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-primary font-medium">
                <ExternalLink className="h-3 w-3" />
                Firefox et Safari ne supportent pas l'installation PWA
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-4">
              <p className="font-semibold text-sm">Cliquer sur « Installer »</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Cherchez l'icône d'installation dans la barre d'adresse (à droite) ou utilisez le bouton ci-dessus s'il apparaît.
              </p>
              <div className="mt-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="flex items-center gap-2">
                  <Chrome className="h-3.5 w-3.5 shrink-0" />
                  <strong>Chrome :</strong> icône <span className="bg-accent px-1.5 py-0.5 rounded font-mono">⊕</span> dans la barre d'adresse
                </p>
                <p className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 shrink-0" />
                  <strong>Edge :</strong> Menu <span className="bg-accent px-1.5 py-0.5 rounded font-mono">⋯</span> → « Installer ce site en tant qu'application »
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
            </div>
            <div>
              <p className="font-semibold text-sm">C'est prêt !</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Une icône <strong>PrescrIA</strong> apparaît sur le bureau. Le préparateur l'ouvre une fois le matin — l'app reste active toute la journée en fenêtre dédiée, sans barre de navigateur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          Astuce : mode scanner
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Une fois installée, activez le mode <strong>« Scanner auto »</strong> pour surveiller le dossier de votre scanner. Chaque nouvelle ordonnance scannée sera analysée automatiquement — zéro clic.
        </p>
      </div>
    </div>
  );
};

export default InstallPage;
