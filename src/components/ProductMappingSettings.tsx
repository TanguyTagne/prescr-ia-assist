import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Save, Package, Pill } from "lucide-react";
import DetectedProductCombobox from "@/components/groupement/DetectedProductCombobox";
import SuggestCombobox from "@/components/SuggestCombobox";

interface ProductMapping {
  id?: string;
  categorie: string;
  produit_selectionne: string;
  cip_code?: string;
  active: boolean;
}

interface MedicamentMapping {
  id?: string;
  medicament_nom: string;
  pc_nom: string;
  pc_categorie?: string;
  active: boolean;
}

const ProductMappingSettings = () => {
  const { user } = useAuth();
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [medMappings, setMedMappings] = useState<MedicamentMapping[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMed, setSavingMed] = useState(false);
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user!.id)
      .single();

    if (!profile?.pharmacy_id) {
      setLoading(false);
      return;
    }
    setPharmacyId(profile.pharmacy_id);

    const [mappingsRes, categoriesRes, medMapRes] = await Promise.all([
      supabase
        .from("product_mapping")
        .select("*")
        .eq("pharmacy_id", profile.pharmacy_id)
        .order("categorie"),
      supabase
        .from("produits_complementaires")
        .select("categorie")
        .not("categorie", "is", null),
      supabase
        .from("medicament_pc_mapping")
        .select("*")
        .eq("pharmacy_id", profile.pharmacy_id)
        .order("medicament_nom"),
    ]);

    setMappings((mappingsRes.data || []).map((d: any) => ({
      id: d.id,
      categorie: d.categorie,
      produit_selectionne: d.produit_selectionne,
      cip_code: d.cip_code,
      active: d.active,
    })));

    setMedMappings((medMapRes.data || []).map((d: any) => ({
      id: d.id,
      medicament_nom: d.medicament_nom,
      pc_nom: d.pc_nom,
      pc_categorie: d.pc_categorie,
      active: d.active,
    })));

    const uniqueCats = [...new Set((categoriesRes.data || []).map((r: any) => r.categorie as string))].sort();
    setDbCategories(uniqueCats);

    setLoading(false);
  };

  const addMapping = () => {
    setMappings(prev => [...prev, { categorie: "", produit_selectionne: "", active: true }]);
  };
  const removeMapping = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };
  const updateMapping = (index: number, field: keyof ProductMapping, value: string | boolean) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const addMedMapping = () => {
    setMedMappings(prev => [...prev, { medicament_nom: "", pc_nom: "", active: true }]);
  };
  const removeMedMapping = (index: number) => {
    setMedMappings(prev => prev.filter((_, i) => i !== index));
  };
  const updateMedMapping = (index: number, field: keyof MedicamentMapping, value: string | boolean) => {
    setMedMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const saveAll = async () => {
    if (!pharmacyId) return;
    setSaving(true);
    try {
      await supabase.from("product_mapping").delete().eq("pharmacy_id", pharmacyId);

      const toInsert = mappings
        .filter(m => m.categorie && m.produit_selectionne)
        .map(m => ({
          pharmacy_id: pharmacyId,
          categorie: m.categorie,
          produit_selectionne: m.produit_selectionne,
          cip_code: m.cip_code || null,
          active: m.active,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("product_mapping").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Mappings catégorie sauvegardés");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const saveMedAll = async () => {
    if (!pharmacyId) return;
    setSavingMed(true);
    try {
      await supabase.from("medicament_pc_mapping").delete().eq("pharmacy_id", pharmacyId);

      const toInsert = medMappings
        .filter(m => m.medicament_nom.trim() && m.pc_nom.trim())
        .map(m => ({
          pharmacy_id: pharmacyId,
          medicament_nom: m.medicament_nom.trim(),
          pc_nom: m.pc_nom.trim(),
          pc_categorie: m.pc_categorie?.trim() || null,
          active: m.active,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("medicament_pc_mapping").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Mappings médicament → PC sauvegardés");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSavingMed(false);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Chargement...</div>;
  if (!pharmacyId) return <div className="text-xs text-muted-foreground p-4">Aucune pharmacie associée.</div>;

  return (
    <div className="space-y-8">
      {/* Section 1 : Catégorie → produit du stock */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Catégorie → produit du stock</h3>
          </div>
          <Button onClick={addMapping} size="sm" variant="outline" className="gap-1 text-xs h-7">
            <Plus className="h-3 w-3" /> Ajouter
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Remplacez les catégories génériques (ex: « Magnésium ») par votre produit préféré.
        </p>

        {mappings.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
            Aucun mapping configuré.
          </div>
        )}

        <div className="space-y-2">
          {mappings.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border">
              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Catégorie détectée</label>
                    <DetectedProductCombobox
                      value={m.categorie}
                      onValueChange={(v) => updateMapping(i, "categorie", v)}
                      onCommit={(v) => updateMapping(i, "categorie", v)}
                      placeholder="ex: Magnésium, Toplexil…"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Produit du stock</label>
                    <Input
                      value={m.produit_selectionne}
                      onChange={e => updateMapping(i, "produit_selectionne", e.target.value)}
                      placeholder="ex: Toplexil"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
              <Button onClick={() => removeMapping(i)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {mappings.length > 0 && (
          <Button onClick={saveAll} disabled={saving} className="w-full gap-1.5 text-xs h-8">
            <Save className="h-3 w-3" />
            {saving ? "Sauvegarde..." : "Sauvegarder les mappings catégorie"}
          </Button>
        )}
      </div>

      {/* Section 2 : Médicament → PC forcé */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Médicament → PC forcé</h3>
          </div>
          <Button onClick={addMedMapping} size="sm" variant="outline" className="gap-1 text-xs h-7">
            <Plus className="h-3 w-3" /> Ajouter
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Liez un médicament à un PC précis. Dès que ce médicament est analysé sur votre compte,
          le PC choisi sera proposé en priorité, quoi qu'il arrive.
        </p>

        {medMappings.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
            Aucun mapping médicament configuré.
          </div>
        )}

        <div className="space-y-2">
          {medMappings.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border">
              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Médicament</label>
                    <Input
                      value={m.medicament_nom}
                      onChange={e => updateMedMapping(i, "medicament_nom", e.target.value)}
                      placeholder="ex: Amoxicilline"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground uppercase tracking-wider">PC à proposer</label>
                    <Input
                      value={m.pc_nom}
                      onChange={e => updateMedMapping(i, "pc_nom", e.target.value)}
                      placeholder="ex: Ultra-Levure"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Catégorie (opt.)</label>
                    <Input
                      value={m.pc_categorie || ""}
                      onChange={e => updateMedMapping(i, "pc_categorie", e.target.value)}
                      placeholder="Probiotique"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
              <Button onClick={() => removeMedMapping(i)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {medMappings.length > 0 && (
          <Button onClick={saveMedAll} disabled={savingMed} className="w-full gap-1.5 text-xs h-8">
            <Save className="h-3 w-3" />
            {savingMed ? "Sauvegarde..." : "Sauvegarder les mappings médicament"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductMappingSettings;
