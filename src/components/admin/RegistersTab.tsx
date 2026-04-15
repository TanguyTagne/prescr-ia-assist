import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Monitor, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Register {
  id: string;
  pharmacy_id: string;
  label: string;
  device_id: string | null;
  active: boolean;
  created_at: string;
}

interface Pharmacy {
  id: string;
  name: string;
}

const RegistersTab = () => {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [regRes, pharmRes] = await Promise.all([
      supabase.from("pharmacy_registers" as any).select("*").order("created_at", { ascending: true }),
      supabase.from("pharmacies").select("id, name"),
    ]);
    setRegisters((regRes.data as any[]) || []);
    setPharmacies(pharmRes.data || []);
    if (pharmRes.data?.[0] && !selectedPharmacy) {
      setSelectedPharmacy(pharmRes.data[0].id);
    }
    setLoading(false);
  };

  const addRegister = async () => {
    if (!newLabel.trim() || !selectedPharmacy) return;
    const { error } = await supabase.from("pharmacy_registers" as any).insert({
      pharmacy_id: selectedPharmacy,
      label: newLabel.trim(),
    });
    if (error) {
      toast.error(error.message.includes("unique") ? "Ce nom de caisse existe déjà" : error.message);
      return;
    }
    toast.success(`Caisse "${newLabel}" créée`);
    setNewLabel("");
    loadData();
  };

  const toggleRegister = async (id: string, active: boolean) => {
    await supabase.from("pharmacy_registers" as any).update({ active: !active }).eq("id", id);
    loadData();
  };

  const deleteRegister = async (id: string) => {
    await supabase.from("pharmacy_registers" as any).delete().eq("id", id);
    toast.success("Caisse supprimée");
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const groupedByPharmacy = pharmacies.map((p) => ({
    ...p,
    registers: registers.filter((r) => r.pharmacy_id === p.id),
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Gestion des caisses
      </h3>

      {/* Add register */}
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Pharmacie</label>
              <select
                value={selectedPharmacy}
                onChange={(e) => setSelectedPharmacy(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Nom de la caisse</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Caisse 2"
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && addRegister()}
              />
            </div>
            <Button size="sm" onClick={addRegister} className="gap-1 h-8">
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registers per pharmacy */}
      {groupedByPharmacy.map((p) => (
        <div key={p.id} className="space-y-2">
          <h4 className="text-xs font-semibold">{p.name}</h4>
          {p.registers.length === 0 ? (
            <p className="text-[10px] text-muted-foreground pl-2">Aucune caisse configurée</p>
          ) : (
            <div className="grid gap-2">
              {p.registers.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-2.5 flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.device_id && (
                      <span className="text-[9px] text-muted-foreground ml-2">ID: {r.device_id.slice(0, 8)}…</span>
                    )}
                  </div>
                  <Badge variant={r.active ? "default" : "secondary"} className="text-[9px] cursor-pointer" onClick={() => toggleRegister(r.id, r.active)}>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRegister(r.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RegistersTab;
