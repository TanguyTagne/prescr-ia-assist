import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { FolderSearch, Monitor, Keyboard, Sparkles, Check } from "lucide-react";
import { LGO_PRESETS, type LgoType } from "@/lib/lgoPresets";
import { toast } from "sonner";

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onConnectScanner?: () => void;
}

const STEPS = [
  { key: "welcome", title: "Bienvenue sur Asclion", icon: Sparkles },
  { key: "scanner", title: "Connecter votre scanner", icon: FolderSearch },
  { key: "lgo", title: "Choisir votre LGO", icon: Monitor },
  { key: "shortcuts", title: "Personnaliser les raccourcis", icon: Keyboard },
] as const;

export const OnboardingTour = ({ open, onClose, onConnectScanner }: OnboardingTourProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [selectedLgo, setSelectedLgo] = useState<LgoType>("winpharma");
  const [savingLgo, setSavingLgo] = useState(false);
  const [scannerConnected, setScannerConnected] = useState(false);
  const [lgoSaved, setLgoSaved] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.pharmacy_id) setPharmacyId(data.pharmacy_id);
      });
  }, [user, open]);

  const finish = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
    onClose();
  };

  const skipTour = () => {
    finish();
    toast.info("Tour passé. Retrouvez-le dans Dashboard → Raccourcis.");
  };

  const handleConnectScanner = () => {
    onConnectScanner?.();
    setScannerConnected(true);
    toast.success("Sélectionnez le dossier de votre scanner.");
  };

  const handleSaveLgo = async () => {
    if (!pharmacyId) {
      setLgoSaved(true);
      return;
    }
    setSavingLgo(true);
    try {
      const { data: existing } = await supabase
        .from("pharmacy_lgo_config")
        .select("id")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("pharmacy_lgo_config")
          .update({ lgo_type: selectedLgo, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("pharmacy_lgo_config")
          .insert({ pharmacy_id: pharmacyId, lgo_type: selectedLgo, api_base_url: "" });
      }
      setLgoSaved(true);
      toast.success(`LGO ${LGO_PRESETS[selectedLgo].label} configuré.`);
    } catch {
      toast.error("Impossible d'enregistrer le LGO");
    } finally {
      setSavingLgo(false);
    }
  };

  const goToShortcuts = () => {
    finish();
    navigate("/dashboard#shortcuts");
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full pharmacy-gradient flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <DialogTitle className="text-base">{current.title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Étape {step + 1} sur {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 min-h-[140px]">
          {step === 0 && (
            <div className="space-y-3 text-sm text-foreground/80">
              <p>
                Asclion est votre copilote au comptoir : il analyse les ordonnances et propose des produits complémentaires
                adaptés en moins de 3 secondes.
              </p>
              <p>
                Trois étapes rapides pour démarrer (30&nbsp;secondes).
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 text-sm text-foreground/80">
              <p>
                Choisissez le dossier dans lequel votre scanner dépose les ordonnances. Asclion les analysera automatiquement.
              </p>
              <Button
                onClick={handleConnectScanner}
                variant={scannerConnected ? "outline" : "default"}
                className={scannerConnected ? "gap-2 w-full" : "gap-2 w-full pharmacy-gradient border-0"}
              >
                {scannerConnected ? <Check className="h-4 w-4 text-primary" /> : <FolderSearch className="h-4 w-4" />}
                {scannerConnected ? "Scanner sélectionné" : "Sélectionner le dossier"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Vous pouvez ignorer cette étape si vous n'utilisez pas de scanner.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm text-foreground/80">
              <p>Choisissez votre logiciel d'officine pour positionner Asclion au bon endroit.</p>
              <select
                value={selectedLgo}
                onChange={(e) => setSelectedLgo(e.target.value as LgoType)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Sélection du LGO"
              >
                {(Object.keys(LGO_PRESETS) as LgoType[]).map((k) => (
                  <option key={k} value={k}>{LGO_PRESETS[k].label}</option>
                ))}
              </select>
              <Button
                onClick={handleSaveLgo}
                disabled={savingLgo || lgoSaved}
                variant={lgoSaved ? "outline" : "default"}
                className={lgoSaved ? "gap-2 w-full" : "gap-2 w-full pharmacy-gradient border-0"}
              >
                {lgoSaved ? <Check className="h-4 w-4 text-primary" /> : <Monitor className="h-4 w-4" />}
                {lgoSaved ? "LGO enregistré" : savingLgo ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm text-foreground/80">
              <p>
                Personnalisez les raccourcis clavier pour gagner du temps au comptoir : analyse, navigation, aide…
              </p>
              <p className="text-xs text-muted-foreground">
                Vous pourrez les modifier à tout moment depuis le Dashboard.
              </p>
              <Button onClick={goToShortcuts} className="gap-2 w-full pharmacy-gradient border-0">
                <Keyboard className="h-4 w-4" />
                Configurer mes raccourcis
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={skipTour}>
            Passer
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                Précédent
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)} className="pharmacy-gradient border-0">
                Suivant
              </Button>
            ) : (
              <Button size="sm" onClick={finish} className="pharmacy-gradient border-0">
                Terminer
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTour;
