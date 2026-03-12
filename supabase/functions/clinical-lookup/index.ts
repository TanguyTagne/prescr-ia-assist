import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { query, cip_code } = await req.json();

    // Step 1: Find medicament by CIP or name
    let medicament = null;
    if (cip_code) {
      const { data } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .eq("cip_code", cip_code)
        .maybeSingle();
      medicament = data;
    }
    if (!medicament && query) {
      const { data } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .ilike("nom_commercial", `%${query}%`)
        .limit(1)
        .maybeSingle();
      medicament = data;
    }

    if (!medicament) {
      // Try matching molecule directly
      const { data: mol } = await supabase
        .from("molecules")
        .select("*")
        .ilike("nom_molecule", `%${query}%`)
        .limit(1)
        .maybeSingle();

      if (!mol) {
        return new Response(
          JSON.stringify({ found: false, message: "Médicament non trouvé dans la base clinique" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build response from molecule
      medicament = { nom_commercial: query, molecules: mol, atc_code: mol.atc_code };
    }

    const molecule = medicament.molecules;
    const atcCode = medicament.atc_code || molecule?.atc_code;

    // Step 2: Get ATC class info
    let classeAtc = null;
    if (atcCode) {
      const { data } = await supabase
        .from("classe_atc")
        .select("*")
        .eq("atc_code", atcCode)
        .maybeSingle();
      classeAtc = data;
    }

    // Step 3: Get pathologies via molecule_pathologie
    let pathologies: any[] = [];
    if (molecule?.id) {
      const { data } = await supabase
        .from("molecule_pathologie")
        .select("pathologie_id, pathologies(*)")
        .eq("molecule_id", molecule.id);
      pathologies = (data || []).map((mp: any) => mp.pathologies).filter(Boolean);
    }

    // Step 4: Get conseils and produits for all pathologies
    const pathologieIds = pathologies.map((p: any) => p.id);
    let conseils: any[] = [];
    let produits: any[] = [];

    if (pathologieIds.length > 0) {
      const [conseilsRes, produitsRes] = await Promise.all([
        supabase
          .from("conseils_associes")
          .select("*, pathologies(nom_pathologie)")
          .in("pathologie_id", pathologieIds)
          .order("priorite", { ascending: false }),
        supabase
          .from("produits_complementaires")
          .select("*, pathologies(nom_pathologie)")
          .in("pathologie_id", pathologieIds)
          .order("priorite", { ascending: false }),
      ]);
      conseils = conseilsRes.data || [];
      produits = produitsRes.data || [];
    }

    // Step 5: Build structured response
    const response = {
      found: true,
      medicament: {
        nom_commercial: medicament.nom_commercial,
        cip_code: medicament.cip_code,
        laboratoire: medicament.laboratoire,
        forme_galenique: medicament.forme_galenique,
        dosage: medicament.dosage,
      },
      molecule: molecule ? {
        nom: molecule.nom_molecule,
        atc_code: molecule.atc_code,
        classe_therapeutique: molecule.classe_therapeutique,
      } : null,
      classe_atc: classeAtc ? {
        code: classeAtc.atc_code,
        nom: classeAtc.nom_classe,
        description: classeAtc.description,
      } : null,
      pathologies: pathologies.map((p: any) => ({
        nom: p.nom_pathologie,
        categorie: p.categorie,
      })),
      conseils: conseils.map((c: any) => ({
        conseil: c.conseil,
        description: c.description,
        priorite: c.priorite,
        pathologie: c.pathologies?.nom_pathologie,
      })),
      produits_complementaires: produits.map((p: any) => ({
        produit: p.produit,
        categorie: p.categorie,
        description: p.description,
        priorite: p.priorite,
        pathologie: p.pathologies?.nom_pathologie,
      })),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
