import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Check, Pause, Play, Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PharmacyWithLGO {
  id: string;
  name: string;
  city: string | null;
  status?: string;
  lgo_config?: {
    id: string;
    lgo_type: string;
    api_base_url: string;
    api_key: string | null;
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
  const [loading, setLoading] = useState<string | null>(null);

  const handleSaveLGO = async (pharmacyId: string) => {
    try {
      const existing = pharmacies.find(p => p.id === pharmacyId)?.lgo_config;

      if (existing) {
        await supabase
          .from("pharmacy_lgo_config" as any)
          .update({
            api_base_url: lgoForm.api_base_url,
            api_key: lgoForm.api_key || existing.api_key,
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
            api_key: lgoForm.api_key,
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

  const handleStatusChange = async (pharmacyId: string, newStatus: string) => {
    setLoading(pharmacyId);
    try {
      const { error } = await supabase
        .from("pharmacies")
        .update({ status: newStatus } as any)
        .eq("id", pharmacyId);

      if (error) throw error;

      const labels: Record<string, string> = {
        active: "Pharmacie réactivée",
        paused: "Accès mis en pause",
        disabled: "Accès supprimé",
      };
      toast.success(labels[newStatus] || "Statut mis à jour");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "paused":
        return <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600 bg-yellow-50">⏸ En pause</Badge>;
      case "disabled":
        return <Badge variant="destructive" className="text-[10px]">✕ Désactivé</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">● Actif</Badge>;
    }
  };

  if (pharmacies.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune pharmacie</p>;
  }

  return (
    <div className="space-y-3">
      {pharmacies.map((pharm) => {
        const status = (pharm as any).status || "active";
        const isDisabled = loading === pharm.id;

        return (
          <div key={pharm.id} className={`rounded-lg border p-4 space-y-3 ${status === "disabled" ? "border-destructive/30 bg-destructive/5 opacity-75" : status === "paused" ? "border-yellow-300 bg-yellow-50/50" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{pharm.name}</p>
                  {pharm.city && <p className="text-xs text-muted-foreground">{pharm.city}</p>}
                </div>
                {getStatusBadge(status)}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                    disabled={isDisabled}
                    onClick={() => handleStatusChange(pharm.id, "paused")}
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </Button>
                )}

                {status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    disabled={isDisabled}
                    onClick={() => handleStatusChange(pharm.id, "active")}
                  >
                    <Play className="h-3 w-3" />
                    Réactiver
                  </Button>
                )}

                {status === "disabled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    disabled={isDisabled}
                    onClick={() => handleStatusChange(pharm.id, "active")}
                  >
                    <Play className="h-3 w-3" />
                    Réactiver
                  </Button>
                )}

                {status !== "disabled" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={isDisabled}
                      >
                        <Trash2 className="h-3 w-3" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Supprimer l'accès
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{pharm.name}</strong> ne pourra plus accéder au logiciel. Les utilisateurs rattachés seront bloqués à la connexion. Cette action est réversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleStatusChange(pharm.id, "disabled")}
                        >
                          Confirmer la suppression
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {pharm.lgo_config?.enabled ? (
                  <Badge className="bg-primary/20 text-primary text-[10px]">
                    <Check className="h-2.5 w-2.5 mr-0.5" />
                    LGO
                  </Badge>
                ) : null}

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
                  LGO
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
                  placeholder={pharm.lgo_config?.api_key ? "Clé API (laisser vide pour ne pas changer)" : "Clé API du LGO"}
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
        );
      })}
    </div>
  );
};

export default PharmaciesTab;
