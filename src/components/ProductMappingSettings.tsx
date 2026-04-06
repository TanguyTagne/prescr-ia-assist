import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Save, Package } from "lucide-react";

interface ProductMapping {
  id?: string;
  categorie: string;
  produit_selectionne: string;
  cip_code?: string;
  active: boolean;
}

const ProductMappingSettings = () => {
  const { user } = useAuth();
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    // Fetch mappings and all DB categories in parallel
    const [mappingsRes, categoriesRes] = await Promise.all([
      supabase
        .from("product_mapping")
        .select("*")
        .eq("pharmacy_id", profile.pharmacy_id)
        .order("categorie"),
      supabase
        .from("produits_complementaires")
        .select("categorie")
        .not("categorie", "is", null),
    ]);

    setMappings((mappingsRes.data || []).map((d: any) => ({
      id: d.id,
      categorie: d.categorie,
      produit_selectionne: d.produit_selectionne,
      cip_code: d.cip_code,
      active: d.active,
    })));

    // Deduplicate and sort categories
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

  const saveAll = async () => {
    if (!pharmacyId) return;
    setSaving(true);
    try {
      // Delete existing
      await supabase.from("product_mapping").delete().eq("pharmacy_id", pharmacyId);

      // Insert all active
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

      toast.success("Mappings sauvegardés");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Chargement...</div>;
  if (!pharmacyId) return <div className="text-xs text-muted-foreground p-4">Aucune pharmacie associée.</div>;

  const ALL_CATEGORIES = dbCategories;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Produits personnalisés</h3>
        </div>
        <Button onClick={addMapping} size="sm" variant="outline" className="gap-1 text-xs h-7">
          <Plus className="h-3 w-3" /> Ajouter
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Remplacez les catégories génériques par vos produits spécifiques du stock.
      </p>

      {mappings.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
          Aucun mapping configuré. Ajoutez-en un pour personnaliser les recommandations.
        </div>
      )}

      <div className="space-y-2">
        {mappings.map((m, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border">
            <div className="flex-1 space-y-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Catégorie</label>
                  <Input
                    value={m.categorie}
                    onChange={e => updateMapping(i, "categorie", e.target.value)}
                    placeholder="ex: Sirop toux"
                    className="h-7 text-xs"
                    list={`cat-suggestions-${i}`}
                  />
                  <datalist id={`cat-suggestions-${i}`}>
                    {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                  </datalist>
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
          {saving ? "Sauvegarde..." : "Sauvegarder les mappings"}
        </Button>
      )}
    </div>
  );
};

export default ProductMappingSettings;
