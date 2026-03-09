import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";

interface AccessRequest {
  id: string;
  pharmacy_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  lgo_type: string | null;
  status: string;
  created_at: string;
}

interface RequestsTabProps {
  requests: AccessRequest[];
  onRefresh: () => void;
}

const RequestsTab = ({ requests, onRefresh }: RequestsTabProps) => {
  const [creating, setCreating] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleCreateAccount = async (req: AccessRequest) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Mot de passe de 6 caractères minimum");
      return;
    }
    setCreating(req.id);
    try {
      const { data: pharmacy, error: pharmErr } = await supabase
        .from("pharmacies")
        .insert({ name: req.pharmacy_name, city: req.city })
        .select()
        .single();
      if (pharmErr) throw pharmErr;

      const { data: userData, error: userErr } = await supabase.functions.invoke("create-pharmacy-account", {
        body: {
          email: req.email,
          password: newPassword,
          full_name: req.contact_name,
          pharmacy_id: pharmacy.id,
          lgo_type: req.lgo_type,
        },
      });
      if (userErr) throw userErr;
      if (userData?.error) throw new Error(userData.error);

      await supabase
        .from("access_requests" as any)
        .update({ status: "approved" } as any)
        .eq("id", req.id);

      toast.success(`Compte créé pour ${req.email}`);
      setNewPassword("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(null);
    }
  };

  const handleRejectRequest = async (id: string) => {
    await supabase.from("access_requests" as any).update({ status: "rejected" } as any).eq("id", id);
    toast.success("Demande refusée");
    onRefresh();
  };

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune demande d'accès</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.id} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm">{req.pharmacy_name}</p>
              <p className="text-xs text-muted-foreground">{req.contact_name} — {req.email}</p>
              {req.city && <p className="text-xs text-muted-foreground">{req.city}</p>}
              {req.lgo_type && <p className="text-xs text-muted-foreground">LGO: {req.lgo_type}</p>}
            </div>
            <Badge variant={req.status === "pending" ? "outline" : req.status === "approved" ? "default" : "destructive"} className="text-[10px]">
              {req.status === "pending" ? "En attente" : req.status === "approved" ? "Approuvé" : "Refusé"}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {new Date(req.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          {req.status === "pending" && (
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="Mot de passe du compte"
                className="h-9 text-sm flex-1"
                value={creating === req.id ? newPassword : ""}
                onChange={(e) => { setCreating(req.id); setNewPassword(e.target.value); }}
              />
              <Button size="sm" className="gap-1 h-9" onClick={() => handleCreateAccount(req)} disabled={creating === req.id && !newPassword}>
                <UserPlus className="h-3.5 w-3.5" />
                Créer
              </Button>
              <Button variant="ghost" size="sm" className="h-9" onClick={() => handleRejectRequest(req.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RequestsTab;
