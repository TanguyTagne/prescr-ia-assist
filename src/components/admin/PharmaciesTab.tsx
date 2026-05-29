import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Check, Pause, Play, Trash2, AlertTriangle, UserPlus, Building2, Plus, Monitor, Globe, Circle } from "lucide-react";
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
import PharmacyDetailDialog from "./PharmacyDetailDialog";

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
  const [creatingAccount, setCreatingAccount] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({ email: "", password: "", full_name: "", role: "preparateur" });
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [connections, setConnections] = useState<Record<string, { total: number; desktop: number; web: number; users: number; lastActivity: string | null }>>({});
  const [detailPharmacy, setDetailPharmacy] = useState<{ id: string; name: string } | null>(null);

  // Live connection counts (refresh every 30s)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_pharmacy_connection_counts");
      if (cancelled || error || !data) return;
      const map: Record<string, { total: number; desktop: number; web: number; users: number; lastActivity: string | null }> = {};
      for (const row of data as any[]) {
        map[row.pharmacy_id] = {
          total: row.connected_instances || 0,
          desktop: row.desktop_instances || 0,
          web: row.web_instances || 0,
          users: row.connected_users || 0,
          lastActivity: row.last_activity || null,
        };
      }
      setConnections(map);
    };
    load();
    const i = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  const handleCreateAccount = async (pharmacyId: string) => {
    if (!accountForm.email || !accountForm.password || accountForm.password.length < 6) {
      toast.error("Email et mot de passe (6+ caractères) requis");
      return;
    }
    setSubmittingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pharmacy-account", {
        body: {
          email: accountForm.email,
          password: accountForm.password,
          full_name: accountForm.full_name || accountForm.email,
          pharmacy_id: pharmacyId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Apply selected role if not default preparateur
      if (accountForm.role !== "preparateur" && data?.user_id) {
        await supabase.from("user_roles").insert({
          user_id: data.user_id,
          role: accountForm.role as any,
        });
      }

      toast.success(`Compte créé pour ${accountForm.email}`);
      setAccountForm({ email: "", password: "", full_name: "", role: "preparateur" });
      setCreatingAccount(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSubmittingAccount(false);
    }
  };

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

  const [showCreatePharmacy, setShowCreatePharmacy] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({
    name: "", city: "", postal_code: "",
    email: "", password: "", full_name: "", role: "manager",
  });
  const [submittingPharmacy, setSubmittingPharmacy] = useState(false);

  const handleCreatePharmacy = async () => {
    if (!newPharmacy.name || !newPharmacy.email || !newPharmacy.password || newPharmacy.password.length < 6) {
      toast.error("Nom de pharmacie, email et mot de passe (6+ car.) requis");
      return;
    }
    setSubmittingPharmacy(true);
    try {
      const { data: pharmacy, error: pharmErr } = await supabase
        .from("pharmacies")
        .insert({ name: newPharmacy.name, city: newPharmacy.city || null, postal_code: newPharmacy.postal_code || null })
        .select()
        .single();
      if (pharmErr) throw pharmErr;

      const { data, error } = await supabase.functions.invoke("create-pharmacy-account", {
        body: {
          email: newPharmacy.email,
          password: newPharmacy.password,
          full_name: newPharmacy.full_name || newPharmacy.email,
          pharmacy_id: pharmacy.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (newPharmacy.role !== "preparateur" && data?.user_id) {
        await supabase.from("user_roles").insert({
          user_id: data.user_id,
          role: newPharmacy.role as any,
        });
      }

      toast.success(`Pharmacie ${newPharmacy.name} créée avec compte ${newPharmacy.email}`);
      setNewPharmacy({ name: "", city: "", postal_code: "", email: "", password: "", full_name: "", role: "manager" });
      setShowCreatePharmacy(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSubmittingPharmacy(false);
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

  const createPharmacyPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pharmacies ({pharmacies.length})</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreatePharmacy(s => !s)}>
          <Plus className="h-3.5 w-3.5" />
          {showCreatePharmacy ? "Annuler" : "Créer une pharmacie"}
        </Button>
      </div>

      {showCreatePharmacy && (
        <div className="space-y-2 rounded-md border border-primary/30 p-4 bg-primary/5">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Nouvelle pharmacie + premier compte d'accès
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Nom de la pharmacie *" value={newPharmacy.name} onChange={e => setNewPharmacy(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" />
            <Input placeholder="Ville" value={newPharmacy.city} onChange={e => setNewPharmacy(f => ({ ...f, city: e.target.value }))} className="h-9 text-sm" />
            <Input placeholder="Code postal" value={newPharmacy.postal_code} onChange={e => setNewPharmacy(f => ({ ...f, postal_code: e.target.value }))} className="h-9 text-sm" />
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">Premier compte utilisateur :</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input type="email" placeholder="Email *" value={newPharmacy.email} onChange={e => setNewPharmacy(f => ({ ...f, email: e.target.value }))} className="h-9 text-sm" />
            <Input placeholder="Nom complet" value={newPharmacy.full_name} onChange={e => setNewPharmacy(f => ({ ...f, full_name: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input type="password" placeholder="Mot de passe (6+ car.) *" value={newPharmacy.password} onChange={e => setNewPharmacy(f => ({ ...f, password: e.target.value }))} className="h-9 text-sm" />
            <select className="h-9 text-sm rounded-md border border-input bg-background px-3" value={newPharmacy.role} onChange={e => setNewPharmacy(f => ({ ...f, role: e.target.value }))}>
              <option value="preparateur">Préparateur</option>
              <option value="manager">Manager (recommandé)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setShowCreatePharmacy(false)} disabled={submittingPharmacy}>Annuler</Button>
            <Button size="sm" className="gap-1" onClick={handleCreatePharmacy} disabled={submittingPharmacy}>
              <Check className="h-3.5 w-3.5" />
              {submittingPharmacy ? "Création..." : "Créer pharmacie + compte"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (pharmacies.length === 0) {
    return (
      <div className="space-y-4">
        {createPharmacyPanel}
        <p className="text-sm text-muted-foreground text-center py-8">Aucune pharmacie</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {createPharmacyPanel}
      <div className="space-y-3">
      {pharmacies.map((pharm) => {
        const status = (pharm as any).status || "active";
        const isDisabled = loading === pharm.id;
        const conn = connections[pharm.id];
        const isOnline = (conn?.total || 0) > 0;

        return (
          <div key={pharm.id} className={`rounded-lg border p-4 space-y-3 ${status === "disabled" ? "border-destructive/30 bg-destructive/5 opacity-75" : status === "paused" ? "border-yellow-300 bg-yellow-50/50" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDetailPharmacy({ id: pharm.id, name: pharm.name })}
                  className="min-w-0 text-left hover:underline focus:outline-none focus:underline"
                  title="Voir les KPIs, scans et PC acceptés"
                >
                  <p className="font-semibold text-sm truncate">{pharm.name}</p>
                  {pharm.city && <p className="text-xs text-muted-foreground">{pharm.city}</p>}
                </button>
                {getStatusBadge(status)}
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 ${isOnline ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-muted-foreground/30 text-muted-foreground"}`}
                  title={conn?.lastActivity ? `Dernière activité : ${new Date(conn.lastActivity).toLocaleString("fr-FR")}` : "Aucune activité récente"}
                >
                  <Circle className={`h-2 w-2 ${isOnline ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40"}`} />
                  {isOnline ? `${conn.total} en ligne` : "hors ligne"}
                  {isOnline && conn.users !== conn.total && (
                    <span className="opacity-70">· {conn.users} utilisateur{conn.users > 1 ? "s" : ""}</span>
                  )}
                </Badge>
                {isOnline && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-2">
                    {conn.desktop > 0 && (
                      <span className="flex items-center gap-0.5" title="Instances Desktop">
                        <Monitor className="h-3 w-3" />{conn.desktop}
                      </span>
                    )}
                    {conn.web > 0 && (
                      <span className="flex items-center gap-0.5" title="Instances Web">
                        <Globe className="h-3 w-3" />{conn.web}
                      </span>
                    )}
                  </span>
                )}
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
                    setCreatingAccount(creatingAccount === pharm.id ? null : pharm.id);
                    setAccountForm({ email: "", password: "", full_name: "", role: "preparateur" });
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  Compte
                </Button>

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

            {creatingAccount === pharm.id && (
              <div className="space-y-2 rounded-md border border-primary/30 p-3 bg-primary/5">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Créer un compte pour cette pharmacie
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={accountForm.email}
                    onChange={e => setAccountForm(f => ({ ...f, email: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Nom complet"
                    value={accountForm.full_name}
                    onChange={e => setAccountForm(f => ({ ...f, full_name: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="password"
                    placeholder="Mot de passe (6+ caractères)"
                    value={accountForm.password}
                    onChange={e => setAccountForm(f => ({ ...f, password: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <select
                    className="h-9 text-sm rounded-md border border-input bg-background px-3"
                    value={accountForm.role}
                    onChange={e => setAccountForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="preparateur">Préparateur</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCreatingAccount(null)} disabled={submittingAccount}>Annuler</Button>
                  <Button size="sm" className="gap-1" onClick={() => handleCreateAccount(pharm.id)} disabled={submittingAccount}>
                    <UserPlus className="h-3.5 w-3.5" />
                    {submittingAccount ? "Création..." : "Créer le compte"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default PharmaciesTab;
