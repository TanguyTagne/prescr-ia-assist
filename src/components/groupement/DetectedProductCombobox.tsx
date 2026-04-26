import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SourceItem {
  produit: string;
  categorie: string | null;
  laboratoire: string | null;
  source: "pc" | "medicament";
}

interface DetectedProductComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

const DetectedProductCombobox = ({
  value,
  onValueChange,
  onCommit,
  placeholder = "Rechercher un PC ou médicament…",
  className,
}: DetectedProductComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SourceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const latestSearch = useRef(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const term = query.trim();
    if (!open || !term) {
      setResults([]);
      setSearching(false);
      return;
    }

    const searchId = Date.now();
    latestSearch.current = searchId;
    setSearching(true);

    const timeout = window.setTimeout(async () => {
      const startsWith = `${term}%`;
      const [pcRes, medRes] = await Promise.all([
        supabase
          .from("produits_complementaires")
          .select("produit, nom_produit, categorie")
          .or(`produit.ilike.${startsWith},nom_produit.ilike.${startsWith},categorie.ilike.${startsWith}`)
          .order("produit")
          .limit(80),
        supabase
          .from("medicaments")
          .select("nom_commercial, laboratoire")
          .ilike("nom_commercial", startsWith)
          .order("nom_commercial")
          .limit(80),
      ]);

      if (latestSearch.current !== searchId) return;

      const seen = new Set<string>();
      const items: SourceItem[] = [];

      (pcRes.data || []).forEach((row: any) => {
        const productName = row.nom_produit || row.produit;
        const key = normalize(`pc:${productName}`);
        if (!productName || seen.has(key)) return;
        seen.add(key);
        items.push({ produit: productName, categorie: row.categorie, laboratoire: null, source: "pc" });
      });

      (medRes.data || []).forEach((row: any) => {
        const productName = row.nom_commercial;
        const key = normalize(`med:${productName}`);
        if (!productName || seen.has(key)) return;
        seen.add(key);
        items.push({ produit: productName, categorie: "Médicament", laboratoire: row.laboratoire, source: "medicament" });
      });

      setResults(items.slice(0, 120));
      setSearching(false);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [open, query]);

  const exactMatch = useMemo(
    () => results.some((item) => normalize(item.produit) === normalize(query)),
    [query, results],
  );

  const commitValue = (nextValue: string) => {
    const cleanValue = nextValue.trim();
    onValueChange(cleanValue);
    setQuery(cleanValue);
    onCommit?.(cleanValue);
  };

  const selectSource = (item: SourceItem) => {
    commitValue(item.produit);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              onValueChange(event.target.value);
              setOpen(true);
            }}
            onBlur={() => commitValue(query)}
            placeholder={placeholder}
            className={cn("h-8 pl-8", className)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[360px] p-0" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {searching && <div className="py-3 text-center text-xs text-muted-foreground">Recherche…</div>}

          {!searching && query.trim() && results.length === 0 && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                commitValue(query);
                setOpen(false);
              }}
            >
              <Check className="h-3 w-3" /> Utiliser « {query.trim()} »
            </button>
          )}

          {!searching && !query.trim() && (
            <div className="py-3 text-center text-xs text-muted-foreground">Tapez quelques lettres…</div>
          )}

          {!searching && results.map((item, index) => (
            <button
              type="button"
              key={`${item.source}-${item.produit}-${index}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSource(item)}
              className="flex w-full flex-col gap-1 rounded px-2 py-2 text-left hover:bg-accent"
            >
              <span className="truncate text-sm font-medium">{item.produit}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {item.categorie && <Badge variant="secondary" className="w-fit text-[10px] font-normal">{item.categorie}</Badge>}
                {item.laboratoire && <span className="text-[10px] text-muted-foreground">{item.laboratoire}</span>}
                {exactMatch && normalize(item.produit) === normalize(query) && <Check className="h-3 w-3 text-primary" />}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DetectedProductCombobox;