import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Item {
  produit: string;
  categorie?: string | null;
  laboratoire?: string | null;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  onSelect?: (item: Item) => void;
  kind: "medicament" | "pc";
  placeholder?: string;
  className?: string;
}

const SuggestCombobox = ({ value, onValueChange, onSelect, kind, placeholder, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const term = query.trim();
    if (!open || !term) { setResults([]); setSearching(false); return; }
    const id = Date.now();
    latest.current = id;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const startsWith = `${term}%`;
      let items: Item[] = [];
      if (kind === "medicament") {
        const { data } = await supabase
          .from("medicaments")
          .select("nom_commercial, laboratoire")
          .ilike("nom_commercial", startsWith)
          .order("nom_commercial")
          .limit(60);
        items = (data || []).map((r: any) => ({
          produit: r.nom_commercial,
          categorie: "Médicament",
          laboratoire: r.laboratoire,
        }));
      } else {
        const { data } = await supabase
          .from("produits_complementaires")
          .select("produit, nom_produit, categorie")
          .or(`produit.ilike.${startsWith},nom_produit.ilike.${startsWith},categorie.ilike.${startsWith}`)
          .order("produit")
          .limit(80);
        const seen = new Set<string>();
        (data || []).forEach((r: any) => {
          const name = r.nom_produit || r.produit;
          if (!name) return;
          const k = name.toLowerCase();
          if (seen.has(k)) return;
          seen.add(k);
          items.push({ produit: name, categorie: r.categorie });
        });
      }
      if (latest.current !== id) return;
      setResults(items);
      setSearching(false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [open, query, kind]);

  const commit = (v: string) => {
    onValueChange(v.trim());
    setQuery(v.trim());
  };

  const pick = (item: Item) => {
    onValueChange(item.produit);
    setQuery(item.produit);
    onSelect?.(item);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); onValueChange(e.target.value); setOpen(true); }}
            onBlur={() => commit(query)}
            placeholder={placeholder}
            className={cn("pl-7", className)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {searching && <div className="py-2 text-center text-[11px] text-muted-foreground">Recherche…</div>}
          {!searching && !query.trim() && <div className="py-2 text-center text-[11px] text-muted-foreground">Tapez quelques lettres…</div>}
          {!searching && query.trim() && results.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">Aucun résultat — la valeur saisie sera utilisée.</div>
          )}
          {!searching && results.map((item, i) => (
            <button
              type="button"
              key={`${item.produit}-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
              className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="truncate text-xs font-medium">{item.produit}</span>
              <span className="flex flex-wrap items-center gap-1">
                {item.categorie && <Badge variant="secondary" className="w-fit text-[9px] font-normal">{item.categorie}</Badge>}
                {item.laboratoire && <span className="text-[9px] text-muted-foreground">{item.laboratoire}</span>}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SuggestCombobox;
