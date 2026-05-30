import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LGO_PRESETS, type LgoType } from "@/lib/lgoPresets";
import { toast } from "sonner";

const STORAGE_KEY = "asclion.lgo-detect-dismissed";

const VALID_LGO: LgoType[] = ["winpharma", "lgpi", "smart_rx", "leo", "pharmagest", "autre"];

export const LgoAutoDetectPrompt = () => {
  const { user, pharmacyId } = useAuth();
  const [detected, setDetected] = useState<LgoType | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Listen for the LGO detection IPC event from Electron
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onLgoDetected) return;

    const off = window.electronAPI.onLgoDetected(async (payload) => {
      const lgo = (payload?.lgo || "").toLowerCase();
      if (!VALID_LGO.includes(lgo as LgoType)) return;
      if (sessionStorage.getItem(STORAGE_KEY) === lgo) return;
      if (!user || !pharmacyId) return;

      const { data: config } = await supabase
        .from("pharmacy_lgo_config")
        .select("lgo_type")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      const current = (config?.lgo_type || "autre").toLowerCase();
      if (current === lgo) return; // already configured
      if (current !== "autre" && current !== "") return; // already a real LGO set

      setDetected(lgo as LgoType);
      setOpen(true);
    });

    return () => off?.();
  }, [user, pharmacyId]);

  const handleAccept = async () => {
    if (!detected || !pharmacyId) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("pharmacy_lgo_config")
        .select("id")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("pharmacy_lgo_config")
          .update({ lgo_type: detected, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("pharmacy_lgo_config").insert({
          pharmacy_id: pharmacyId,
          lgo_type: detected,
          api_base_url: "",
        });
      }
      toast.success(`${LGO_PRESETS[detected].label} configuré`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    if (detected) sessionStorage.setItem(STORAGE_KEY, detected);
    setOpen(false);
  };

  if (!detected) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleDismiss() : setOpen(v))}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            LGO détecté
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Nous avons détecté <strong>{LGO_PRESETS[detected].label}</strong> sur votre poste. Voulez-vous le configurer automatiquement ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={saving}>
            Plus tard
          </Button>
          <Button size="sm" onClick={handleAccept} disabled={saving} className="pharmacy-gradient border-0">
            Configurer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LgoAutoDetectPrompt;
