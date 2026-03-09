import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Check } from "lucide-react";

interface PharmacyWithLGO {
  id: string;
  name: string;
  city: string | null;
  lgo_config?: {
    id: string;
    lgo_type: string;
    api_base_url: string;
    api_key_encrypted: string | null;
    enabled: boolean;
    last_sync_at: string | null;
  } | null;
}

interface PharmaciesTabProps {
  pharmacies: PharmacyWithLGO[];
  onRefresh: () => void;
}

const PharmaciesTab = ({ pharmacies, onRefresh }: PharmaciesTabProps) => {
  const [editingLGO, setEditingLGO] = useState<string | null>(null);
  const [lgoForm, setLgoForm] = useState({ api_base_url: "", api_key: "", lgo_type: "winpharma" });

  const handleSaveLGO = async (pharmacyId: string) => {
    try {
      const existing = pharmacies.find(p => p.id === pharmacyId)?.lgo_config;

      if (existing) {
        await supabase
          .from("pharmacy_lgo_config" as any)
          .update({
            api_base_url: lgoForm.api_base_url,
            api_key_encrypted: lgoForm.api_key || existing.api_key_encrypted,
            lgo_type: lgoForm.lgo_type,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("pharmacy_lgo_config" as any)
          .insert({
            pharmacy_id: pharmacyId,
            api_base_url: lgoForm.api_base_url,
            api_key_encrypted: lgoForm.api_key,
            lgo_type: lgoForm.lgo_type,
          } as any);
      }

      toast.success("Configuration LGO enregistrée");
      setEditingLGO(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  if (pharmacies.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune pharmacie</p>;
  }

  return (
    <div className="space-y-3">
      {pharmacies.map((pharm) => (
        <div key={pharm.id} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{pharm.name}</p>
              {pharm.city && <p className="text-xs text-muted-foreground">{pharm.city}</p>}
            </div>
            <div className="flex items-center gap-2">
              {pharm.lgo_config?.enabled ? (
                <Badge className="bg-primary/20 text-primary text-[10px]">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  LGO connecté
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">LGO non configuré</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setEditingLGO(editingLGO === pharm.id ? null : pharm.id);
                  setLgoForm({
                    api_base_url: pharm.lgo_config?.api_base_url || "",
                    api_key: "",
                    lgo_type: pharm.lgo_config?.lgo_type || "winpharma",
                  });
                }}
              >
                <Key className="h-3 w-3" />
                Config LGO
              </Button>
            </div>
          </div>

          {pharm.lgo_config?.last_sync_at && (
            <p className="text-[10px] text-muted-foreground">
              Dernier sync: {new Date(pharm.lgo_config.last_sync_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {editingLGO === pharm.id && (
            <div className="space-y-2 rounded-md border border-border p-3 bg-muted/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Type LGO (winpharma, lgpi...)"
                  value={lgoForm.lgo_type}
                  onChange={e => setLgoForm(f => ({ ...f, lgo_type: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="URL API du LGO"
                  value={lgoForm.api_base_url}
                  onChange={e => setLgoForm(f => ({ ...f, api_base_url: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <Input
                type="password"
                placeholder={pharm.lgo_config?.api_key_encrypted ? "Clé API (laisser vide pour ne pas changer)" : "Clé API du LGO"}
                value={lgoForm.api_key}
                onChange={e => setLgoForm(f => ({ ...f, api_key: e.target.value }))}
                className="h-9 text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingLGO(null)}>Annuler</Button>
                <Button size="sm" className="gap-1" onClick={() => handleSaveLGO(pharm.id)}>
                  <Check className="h-3.5 w-3.5" />
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PharmaciesTab;
