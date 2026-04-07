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
      medicamentPathologie,
      produitsComplementaires,
      conseilsAssocies,
      protocolePathologie,
      pathologyProtocol,
      symptomesOfficine,
      symptomePathologie,
    ] = await Promise.all([
      supabase.from("molecules").select("*").order("nom_molecule"),
      supabase.from("medicaments").select("*").order("nom_commercial"),
      supabase.from("pathologies").select("*").order("nom_pathologie"),
      supabase.from("classe_atc").select("*").order("atc_code"),
      supabase.from("molecule_pathologie").select("*, molecules(nom_molecule), pathologies(nom_pathologie)").order("id"),
      supabase.from("medicament_pathologie").select("*, medicaments(nom_commercial), pathologies(nom_pathologie)").order("id"),
      supabase.from("produits_complementaires").select("*, pathologies(nom_pathologie)").order("produit"),
      supabase.from("conseils_associes").select("*, pathologies(nom_pathologie)").order("conseil"),
      supabase.from("protocole_pathologie").select(`
        *, pathologies(nom_pathologie),
        conseil_1:conseils_associes!protocole_pathologie_conseil_1_id_fkey(conseil, description),
        conseil_2:conseils_associes!protocole_pathologie_conseil_2_id_fkey(conseil, description),
        produit_1:produits_complementaires!protocole_pathologie_produit_complementaire_1_id_fkey(produit, categorie),
        produit_2:produits_complementaires!protocole_pathologie_produit_complementaire_2_id_fkey(produit, categorie),
        produit_3:produits_complementaires!protocole_pathologie_produit_complementaire_3_id_fkey(produit, categorie)
      `).order("pathologie_id"),
      supabase.from("pathology_protocol").select("*").order("pathologie"),
      supabase.from("symptomes_officine").select("*").order("nom_symptome"),
      supabase.from("symptome_pathologie").select("*, symptomes_officine(nom_symptome), pathologies(nom_pathologie)").order("id"),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      version: "2.0",
      stats: {
        molecules: molecules.data?.length || 0,
        medicaments: medicaments.data?.length || 0,
        pathologies: pathologies.data?.length || 0,
        classe_atc: classeAtc.data?.length || 0,
        molecule_pathologie: moleculePathologie.data?.length || 0,
        medicament_pathologie: medicamentPathologie.data?.length || 0,
        produits_complementaires: produitsComplementaires.data?.length || 0,
        conseils_associes: conseilsAssocies.data?.length || 0,
        protocole_pathologie: protocolePathologie.data?.length || 0,
        pathology_protocol_legacy: pathologyProtocol.data?.length || 0,
        symptomes_officine: symptomesOfficine.data?.length || 0,
        symptome_pathologie: symptomePathologie.data?.length || 0,
      },
      molecules: molecules.data || [],
      medicaments: medicaments.data || [],
      pathologies: pathologies.data || [],
      classe_atc: classeAtc.data || [],
      molecule_pathologie: (moleculePathologie.data || []).map((mp: any) => ({
        molecule: mp.molecules?.nom_molecule,
        pathologie: mp.pathologies?.nom_pathologie,
        score_pertinence: mp.score_pertinence,
        source_mapping: mp.source_mapping,
      })),
      medicament_pathologie: (medicamentPathologie.data || []).map((mp: any) => ({
        medicament: mp.medicaments?.nom_commercial,
        pathologie: mp.pathologies?.nom_pathologie,
        score_pertinence: mp.score_pertinence,
        source_mapping: mp.source_mapping,
      })),
      produits_complementaires: (produitsComplementaires.data || []).map((p: any) => ({
        produit: p.produit,
        nom_produit: p.nom_produit,
        categorie: p.categorie,
        description: p.description,
        priorite: p.priorite,
        type_produit: p.type_produit,
        est_dispositif_medical: p.est_dispositif_medical,
        est_complement: p.est_complement,
        est_otc: p.est_otc,
        pathologie: p.pathologies?.nom_pathologie,
      })),
      conseils_associes: (conseilsAssocies.data || []).map((c: any) => ({
        conseil: c.conseil,
        conseil_code: c.conseil_code,
        description: c.description,
        priorite: c.priorite,
        pathologie: c.pathologies?.nom_pathologie,
      })),
      protocoles_pathologie: (protocolePathologie.data || []).map((p: any) => ({
        pathologie: p.pathologies?.nom_pathologie,
        actif: p.actif,
        version: p.version_protocole,
        conseil_1: p.conseil_1?.conseil,
        conseil_2: p.conseil_2?.conseil,
        produit_1: p.produit_1?.produit,
        produit_2: p.produit_2?.produit,
        produit_3: p.produit_3?.produit,
        justification_1: p.justification_1,
        justification_2: p.justification_2,
        justification_3: p.justification_3,
        priorite_produit_1: p.priorite_produit_1,
        priorite_produit_2: p.priorite_produit_2,
        priorite_produit_3: p.priorite_produit_3,
      })),
      pathology_protocol_legacy: pathologyProtocol.data || [],
      symptomes_officine: symptomesOfficine.data || [],
      symptome_pathologie: (symptomePathologie.data || []).map((sp: any) => ({
        symptome: sp.symptomes_officine?.nom_symptome,
        pathologie: sp.pathologies?.nom_pathologie,
        score_pertinence: sp.score_pertinence,
      })),
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="asclion-clinical-data-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
