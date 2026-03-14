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

    const [
      molecules,
      medicaments,
      pathologies,
      classeAtc,
      moleculePathologie,
      produitsComplementaires,
      conseilsAssocies,
      pathologyProtocol,
    ] = await Promise.all([
      supabase.from("molecules").select("*").order("nom_molecule"),
      supabase.from("medicaments").select("*").order("nom_commercial"),
      supabase.from("pathologies").select("*").order("nom_pathologie"),
      supabase.from("classe_atc").select("*").order("atc_code"),
      supabase.from("molecule_pathologie").select("*, molecules(nom_molecule), pathologies(nom_pathologie)").order("id"),
      supabase.from("produits_complementaires").select("*, pathologies(nom_pathologie)").order("produit"),
      supabase.from("conseils_associes").select("*, pathologies(nom_pathologie)").order("conseil"),
      supabase.from("pathology_protocol").select("*").order("pathologie"),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      stats: {
        molecules: molecules.data?.length || 0,
        medicaments: medicaments.data?.length || 0,
        pathologies: pathologies.data?.length || 0,
        classe_atc: classeAtc.data?.length || 0,
        molecule_pathologie: moleculePathologie.data?.length || 0,
        produits_complementaires: produitsComplementaires.data?.length || 0,
        conseils_associes: conseilsAssocies.data?.length || 0,
        pathology_protocol: pathologyProtocol.data?.length || 0,
      },
      molecules: molecules.data || [],
      medicaments: medicaments.data || [],
      pathologies: pathologies.data || [],
      classe_atc: classeAtc.data || [],
      molecule_pathologie: (moleculePathologie.data || []).map((mp: any) => ({
        molecule: mp.molecules?.nom_molecule,
        pathologie: mp.pathologies?.nom_pathologie,
      })),
      produits_complementaires: (produitsComplementaires.data || []).map((p: any) => ({
        produit: p.produit,
        categorie: p.categorie,
        description: p.description,
        priorite: p.priorite,
        pathologie: p.pathologies?.nom_pathologie,
      })),
      conseils_associes: (conseilsAssocies.data || []).map((c: any) => ({
        conseil: c.conseil,
        description: c.description,
        priorite: c.priorite,
        pathologie: c.pathologies?.nom_pathologie,
      })),
      pathology_protocol: pathologyProtocol.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="prescria-clinical-data-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
