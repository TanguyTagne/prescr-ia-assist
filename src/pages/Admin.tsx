import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserPlus, Check, X, Key, Building2, Mail, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyWithLGO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "pharmacies">("requests");

  // Create account form
  const [creating, setCreating] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // LGO config form
  const [editingLGO, setEditingLGO] = useState<string | null>(null);
  const [lgoForm, setLgoForm] = useState({ api_base_url: "", api_key: "", lgo_type: "winpharma" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, pharmRes] = await Promise.all([
        supabase.from("access_requests" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("pharmacies").select("*").order("created_at", { ascending: false }),
      ]);

      setRequests((reqRes.data as any[]) || []);

      // Load LGO configs for each pharmacy
      const pharmaList = (pharmRes.data || []) as PharmacyWithLGO[];
      if (pharmaList.length > 0) {
        const { data: lgoConfigs } = await supabase
          .from("pharmacy_lgo_config" as any)
          .select("*");

        for (const p of pharmaList) {
          p.lgo_config = (lgoConfigs as any[])?.find((c: any) => c.pharmacy_id === p.id) || null;
        }
      }
      setPharmacies(pharmaList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (req: AccessRequest) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Mot de passe de 6 caractères minimum");
      return;
    }
    setCreating(req.id);
    try {
      // 1. Create pharmacy
      const { data: pharmacy, error: pharmErr } = await supabase
        .from("pharmacies")
        .insert({ name: req.pharmacy_name, city: req.city })
        .select()
        .single();
      if (pharmErr) throw pharmErr;

      // 2. Create user via edge function
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

      // 3. Update request status
      await supabase
        .from("access_requests" as any)
        .update({ status: "approved" } as any)
        .eq("id", req.id);

      toast.success(`Compte créé pour ${req.email}`);
      setNewPassword("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(null);
    }
  };

  const handleRejectRequest = async (id: string) => {
    await supabase.from("access_requests" as any).update({ status: "rejected" } as any).eq("id", id);
    toast.success("Demande refusée");
    loadData();
  };

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
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Administration</h1>
          <Button variant="ghost" size="icon" onClick={loadData} className="h-8 w-8 ml-auto">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={tab === "requests" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("requests")}
            className="gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            Demandes ({requests.filter(r => r.status === "pending").length})
          </Button>
          <Button
            variant={tab === "pharmacies" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pharmacies")}
            className="gap-1.5"
          >
            <Building2 className="h-3.5 w-3.5" />
            Pharmacies ({pharmacies.length})
          </Button>
        </div>

        {/* Requests */}
        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune demande d'accès</p>
            ) : (
              requests.map((req) => (
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
                      <Button
                        size="sm"
                        className="gap-1 h-9"
                        onClick={() => handleCreateAccount(req)}
                        disabled={creating === req.id && !newPassword}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Créer
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => handleRejectRequest(req.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Pharmacies */}
        {tab === "pharmacies" && (
          <div className="space-y-3">
            {pharmacies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune pharmacie</p>
            ) : (
              pharmacies.map((pharm) => (
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;