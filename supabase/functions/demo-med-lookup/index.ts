import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractCore(name: string): string {
  return (name || "")
    .trim()
    .replace(/\d+\s*(mg|g|ml|ui|µg|mcg|%)/gi, "")
    .replace(
      /\b(comprim[ée]s?|g[ée]lules?|sachets?|sirop|suspension|solution|cr[èe]me|gel|patch|spray|gouttes|pommade|injectable|lyoc|effervescent|orodispersible|lp|fort|adulte|enfant|nourrisson|buvable)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "lookup");
    const query = String(body.query || "").trim().slice(0, 120);

    // ── Autocomplete ──
    if (mode === "suggest") {
      if (query.length < 2) return json({ suggestions: [] });
      const { data } = await supabase
        .from("medicaments")
        .select("nom_commercial")
        .ilike("nom_commercial", `${query}%`)
        .limit(8);
      const seen = new Set<string>();
      const suggestions = (data || [])
        .map((m: any) => m.nom_commercial)
        .filter((n: string) => {
          const k = (n || "").toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      return json({ suggestions });
    }

    if (query.length < 2) return json({ found: false, message: "Requête trop courte" });

    // ── Find medication (progressive fuzzy) ──
    let medicament: any = null;
    const attempts = [query, `%${query}%`];
    const core = extractCore(query);
    if (core && core !== query) attempts.push(`%${core}%`);
    const firstWord = core.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3) attempts.push(`%${firstWord}%`);

    for (const pattern of attempts) {
      const { data } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .ilike("nom_commercial", pattern)
        .limit(1)
        .maybeSingle();
      if (data) {
        medicament = data;
        break;
      }
    }

    if (!medicament) {
      const { data: mol } = await supabase
        .from("molecules")
        .select("*")
        .ilike("nom_molecule", `%${core || query}%`)
        .limit(1)
        .maybeSingle();
      if (!mol) return json({ found: false, message: "Médicament non trouvé dans la base clinique" });
      medicament = { nom_commercial: query, molecules: mol, atc_code: mol.atc_code };
    }

    const molecule = medicament.molecules;
    const atcCode = medicament.atc_code || molecule?.atc_code;

    // ── Pathologies ──
    const pathologieIds = new Set<string>();
    if (molecule?.id) {
      const { data } = await supabase
        .from("molecule_pathologie")
        .select("pathologie_id")
        .eq("molecule_id", molecule.id);
      (data || []).forEach((r: any) => r.pathologie_id && pathologieIds.add(r.pathologie_id));
    }
    if (medicament?.id) {
      const { data } = await supabase
        .from("medicament_pathologie")
        .select("pathologie_id")
        .eq("medicament_id", medicament.id);
      (data || []).forEach((r: any) => r.pathologie_id && pathologieIds.add(r.pathologie_id));
    }

    // ── Complementary products ──
    let produits: any[] = [];

    // 1) Curated PCs (highest priority source)
    if (medicament?.id) {
      const { data: curated } = await supabase
        .from("medicament_curated_pcs")
        .select("pc_1, pc_2, pertinence_pc1, pertinence_pc2, phrase_conseil_pc1, phrase_conseil_pc2")
        .eq("medicament_id", medicament.id)
        .maybeSingle();
      if (curated) {
        const pairs = [
          { name: curated.pc_1, phrase: curated.phrase_conseil_pc1, pertinence: curated.pertinence_pc1 },
          { name: curated.pc_2, phrase: curated.phrase_conseil_pc2, pertinence: curated.pertinence_pc2 },
        ].filter((p) => p.name && String(p.name).trim());
        produits = pairs.map((p, i) => ({
          produit: String(p.name).trim(),
          categorie: "Conseil associé",
          priorite: 100 - i,
          phrase_conseil: (p.phrase || "").trim() || undefined,
          description: (p.pertinence || "").trim() || undefined,
        }));
      }

      // 2) Validated PCs bound to the medication
      const { data: mpv } = await supabase
        .from("medicament_pc_valide")
        .select("score, pc:produits_complementaires(produit, categorie, description, phrase_conseil, pathologies(nom_pathologie))")
        .eq("medicament_id", medicament.id)
        .order("score", { ascending: false })
        .limit(10);
      produits = [
        ...produits,
        ...(mpv || [])
          .filter((r: any) => r.pc)
          .map((r: any) => ({ ...r.pc, priorite: Math.max(r.score || 0, 90) })),
      ];

      const { data } = await supabase
        .from("produits_complementaires")
        .select("produit, categorie, description, priorite, phrase_conseil, pathologies(nom_pathologie)")
        .eq("medicament_id", medicament.id)
        .order("priorite", { ascending: false })
        .limit(10);
      produits = [...produits, ...(data || []).map((p: any) => ({ ...p, priorite: Math.max(p.priorite || 0, 85) }))];
    }

    // 3) Pathology-based PCs
    if (pathologieIds.size > 0) {
      const { data } = await supabase
        .from("produits_complementaires")
        .select("produit, categorie, description, priorite, phrase_conseil, pathologies(nom_pathologie)")
        .in("pathologie_id", [...pathologieIds])
        .order("priorite", { ascending: false })
        .limit(20);
      produits = [...produits, ...(data || [])];
    }

    // 4) ATC-class fallback — other medications sharing the same ATC code
    if (produits.length === 0 && atcCode) {
      const { data: siblings } = await supabase
        .from("medicaments")
        .select("id")
        .eq("atc_code", atcCode)
        .limit(20);
      const ids = (siblings || []).map((s: any) => s.id).filter((id: string) => id !== medicament.id);
      if (ids.length > 0) {
        const { data: curatedSib } = await supabase
          .from("medicament_curated_pcs")
          .select("pc_1, phrase_conseil_pc1, pertinence_pc1")
          .in("medicament_id", ids)
          .limit(5);
        produits = (curatedSib || [])
          .filter((c: any) => c.pc_1)
          .map((c: any, i: number) => ({
            produit: String(c.pc_1).trim(),
            categorie: "Conseil associé",
            priorite: 90 - i,
            phrase_conseil: (c.phrase_conseil_pc1 || "").trim() || undefined,
            description: (c.pertinence_pc1 || "").trim() || undefined,
          }));
      }
    }


    const seen = new Set<string>();
    const recommendations = produits
      .filter((p: any) => {
        const k = (p.produit || "").toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 3)
      .map((p: any) => ({
        produit: p.produit,
        categorie: p.categorie || "Conseil",
        description: p.description || undefined,
        priorite: p.priorite || 70,
        pathologie: p.pathologies?.nom_pathologie || undefined,
        phrase_conseil: p.phrase_conseil || undefined,
      }));

    // ── Counseling advice from the pathology protocol ──
    let conseil = "";
    if (pathologieIds.size > 0) {
      const { data } = await supabase
        .from("conseils_associes")
        .select("conseil, description")
        .in("pathologie_id", [...pathologieIds])
        .order("priorite", { ascending: false })
        .limit(1);
      const c = data?.[0];
      if (c) conseil = [c.conseil, c.description].filter(Boolean).join(" — ");
    }

    return json({
      found: true,
      medicament: {
        nom: medicament.nom_commercial,
        classe: molecule?.classe_therapeutique || "—",
        molecule: molecule?.nom_molecule || undefined,
        code_atc: atcCode || undefined,
        conseil_associe: conseil || undefined,
        recommendations,
      },
    });
  } catch (error) {
    console.error("demo-med-lookup error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
