import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LineageInfo {
  source_code: string | null;
  source_nom: string | null;
  source_licence: string | null;
  source_derniere_synchro: string | null;
  source_reference: string | null;
  validated_at: string | null;
  rule_version: number | null;
}

/**
 * Charge la traçabilité (source officielle, validation, version) pour une liste
 * de noms de produits complémentaires affichés dans l'analyse d'ordonnance.
 *
 * Renvoie une Map indexée par le nom du produit (lowercase trim).
 */
export function useProductLineage(productNames: string[]) {
  const [lineage, setLineage] = useState<Map<string, LineageInfo>>(new Map());
  const [loading, setLoading] = useState(false);

  // Stable key for effect
  const key = [...new Set(productNames.map((n) => n?.trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join("|");

  useEffect(() => {
    if (!key) {
      setLineage(new Map());
      return;
    }
    const names = key.split("|");
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: pcs } = await supabase
          .from("produits_complementaires")
          .select(
            "produit, source_code, source_reference, validated_at, rule_version"
          )
          .in(
            "produit",
            // Recherche insensible à la casse via filtres OR
            names
          );

        // Fallback : recherche ilike pour les noms qui n'ont pas matché en exact
        const map = new Map<string, LineageInfo>();
        const matchedNames = new Set<string>();

        for (const row of (pcs as any[]) || []) {
          const k = (row.produit as string)?.trim().toLowerCase();
          if (!k) continue;
          matchedNames.add(k);
          map.set(k, {
            source_code: row.source_code || null,
            source_nom: null,
            source_licence: null,
            source_derniere_synchro: null,
            source_reference: row.source_reference || null,
            validated_at: row.validated_at || null,
            rule_version: row.rule_version ?? 1,
          });
        }

        // Pour les noms manquants, tenter ilike un par un (limité)
        const missing = names.filter((n) => !matchedNames.has(n)).slice(0, 10);
        if (missing.length > 0) {
          const orFilter = missing.map((n) => `produit.ilike.${n}`).join(",");
          const { data: fuzzy } = await supabase
            .from("produits_complementaires")
            .select(
              "produit, source_code, source_reference, validated_at, rule_version"
            )
            .or(orFilter)
            .limit(50);

          for (const row of (fuzzy as any[]) || []) {
            const produit = (row.produit as string)?.trim().toLowerCase();
            if (!produit) continue;
            // Map sur le nom recherché correspondant
            for (const n of missing) {
              if (produit === n || produit.includes(n) || n.includes(produit)) {
                if (!map.has(n)) {
                  map.set(n, {
                    source_code: row.source_code || null,
                    source_nom: null,
                    source_licence: null,
                    source_derniere_synchro: null,
                    source_reference: row.source_reference || null,
                    validated_at: row.validated_at || null,
                    rule_version: row.rule_version ?? 1,
                  });
                }
              }
            }
          }
        }

        // Charger les infos de sources pour enrichir
        const sourceCodes = [
          ...new Set(
            Array.from(map.values())
              .map((v) => v.source_code)
              .filter(Boolean) as string[]
          ),
        ];
        if (sourceCodes.length > 0) {
          const { data: sources } = await supabase
            .from("clinical_sources")
            .select("code, nom_complet, licence, derniere_synchro")
            .in("code", sourceCodes);

          const sourceMap = new Map<string, any>();
          for (const s of (sources as any[]) || []) sourceMap.set(s.code, s);

          for (const [k, v] of map) {
            if (v.source_code && sourceMap.has(v.source_code)) {
              const s = sourceMap.get(v.source_code);
              map.set(k, {
                ...v,
                source_nom: s.nom_complet,
                source_licence: s.licence,
                source_derniere_synchro: s.derniere_synchro,
              });
            }
          }
        }

        if (!cancelled) setLineage(map);
      } catch (e) {
        console.error("useProductLineage error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { lineage, loading };
}
