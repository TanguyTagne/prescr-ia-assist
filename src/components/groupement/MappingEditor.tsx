import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  groupementId: string;
}

interface MappingRow {
  id: string;
  categorie: string;
  produit_prioritaire: string;
  laboratoire_partenaire: string | null;
  cip_code: string | null;
  niveau_priorite: number;
  active: boolean;
}

interface SourceItem {
  produit: string;
  categorie: string | null;
  laboratoire: string | null;
}

const MappingEditor = ({ groupementId }: Props) => {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newProd, setNewProd] = useState("");
  const [newLab, setNewLab] = useState("");
  const [srcOpen, setSrcOpen] = useState(false);
  const [srcSearch, setSrcSearch] = useState("");
  const [srcResults, setSrcResults] = useState<SourceItem[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: m } = await supabase
      .from("group_product_mapping" as any)
      .select("*")
      .eq("groupement_id", groupementId)
      .order("categorie");
    setRows((m as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [groupementId]);

  // Server-side search on produits_complementaires (categorie OR produit)
  useEffect(() => {
    const t = setTimeout(async () => {
      setSearching(true);
      const term = srcSearch.trim();
      let query = supabase
        .from("produits_complementaires")
        .select("produit, categorie")
        .limit(80);
      if (term) {
        // "Commence par" : ilike 'terme%'
        query = query.or(`produit.ilike.${term}%,categorie.ilike.${term}%`).order("produit");
      } else {
        query = query.not("categorie", "is", null).order("categorie").limit(80);
      }
      const { data } = await query;
      // Deduplicate by "produit + categorie"
      const seen = new Set<string>();
      const items: SourceItem[] = [];
      (data || []).forEach((r: any) => {
        const key = `${r.categorie || ""}::${r.produit}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ produit: r.produit, categorie: r.categorie, laboratoire: null });
        }
      });
      setSrcResults(items);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [srcSearch]);

  const selectSource = (item: SourceItem) => {
    // Stocke le produit choisi (clé de matching côté moteur)
    setNewCat(item.produit);
    setSrcOpen(false);
    setSrcSearch("");
  };

  const addRow = async () => {
    if (!newCat.trim() || !newProd.trim()) {
      toast.error("Catégorie et nom du produit requis");
      return;
    }
    const { error } = await supabase.from("group_product_mapping" as any).insert({
      groupement_id: groupementId,
      categorie: newCat.trim(),
      produit_prioritaire: newProd.trim(),
      laboratoire_partenaire: newLab.trim() || null,
      niveau_priorite: 90,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${newProd} sera désormais proposé pour la catégorie « ${newCat} »`);
    setNewCat("");
    setNewProd("");
    setNewLab("");
    setAdding(false);
    load();
  };

  const updateField = async (id: string, field: keyof MappingRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    const { error } = await supabase.from("group_product_mapping" as any).update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("group_product_mapping" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mapping supprimé");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Mapping centralisé groupement
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Quand Asclion détecte une catégorie (ex: « Magnésium »), il proposera automatiquement votre produit prioritaire (ex: « Magnésium Avène ») dans toutes les officines du réseau.
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">1. Quand Asclion détecte…</label>
                <Popover open={srcOpen} onOpenChange={setSrcOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
                      <span className={cn("truncate", !newCat && "text-muted-foreground")}>{newCat || "Rechercher un produit ou une catégorie…"}</span>
                      <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="ex: magnésium, doliprane, vitamine D…"
                        value={srcSearch}
                        onValueChange={setSrcSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {searching ? (
                            <div className="text-xs text-muted-foreground py-2">Recherche…</div>
                          ) : srcSearch ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                setNewCat(srcSearch);
                                setSrcOpen(false);
                                setSrcSearch("");
                              }}
                            >
                              <Plus className="h-3 w-3 mr-2" /> Utiliser « {srcSearch} »
                            </Button>
                          ) : (
                            <div className="text-xs text-muted-foreground py-2">Aucun résultat</div>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {srcResults.map((item, idx) => (
                            <CommandItem
                              key={`${item.categorie}-${item.produit}-${idx}`}
                              value={`${item.produit}-${idx}`}
                              onSelect={() => selectSource(item)}
                              className="flex flex-col items-start gap-0.5 py-2"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <Check className={cn("h-3 w-3 shrink-0", newCat === (item.categorie || item.produit) ? "opacity-100" : "opacity-0")} />
                                <span className="font-medium text-sm truncate">{item.produit}</span>
                              </div>
                              {item.categorie && (
                                <Badge variant="secondary" className="text-[10px] ml-5 font-normal">{item.categorie}</Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">2. Proposer à la place…</label>
                <Input value={newProd} onChange={(e) => setNewProd(e.target.value)} placeholder="ex: Magnésium Avène" className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Labo partenaire (optionnel)</label>
                <Input value={newLab} onChange={(e) => setNewLab(e.target.value)} placeholder="ex: Avène" className="h-9" />
              </div>
            </div>
            {newCat && newProd && (
              <div className="text-xs bg-primary/5 border border-primary/20 rounded p-2">
                <span className="text-muted-foreground">Aperçu : </span>
                <span>Recommandation « <span className="line-through text-muted-foreground">{newCat}</span> » →</span>
                <span className="font-medium text-primary ml-1">« {newProd} »</span>
                {newLab && <Badge variant="secondary" className="ml-2 text-xs">{newLab}</Badge>}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewCat(""); setNewProd(""); setNewLab(""); }}>
                Annuler
              </Button>
              <Button size="sm" onClick={addRow}>Enregistrer</Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Détecté par Asclion</TableHead>
              <TableHead>Proposé à la place</TableHead>
              <TableHead>Laboratoire</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Input
                    defaultValue={r.categorie}
                    onBlur={(e) => updateField(r.id, "categorie", e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    defaultValue={r.produit_prioritaire}
                    onBlur={(e) => updateField(r.id, "produit_prioritaire", e.target.value)}
                    className="h-8 font-medium"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    defaultValue={r.laboratoire_partenaire || ""}
                    onBlur={(e) => updateField(r.id, "laboratoire_partenaire", e.target.value || null)}
                    className="h-8"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => deleteRow(r.id)} className="h-7 w-7">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && !adding && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                  Aucun mapping. Cliquez sur Ajouter pour définir vos marques prioritaires.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MappingEditor;
