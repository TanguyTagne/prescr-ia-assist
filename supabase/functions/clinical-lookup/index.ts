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

    // Step 3: Get pathologies via molecule_pathologie + medicament_pathologie
    let pathologies: any[] = [];
    const pathologieIdSet = new Set<string>();

    if (molecule?.id) {
      const { data } = await supabase
        .from("molecule_pathologie")
        .select("pathologie_id, score_pertinence, pathologies(*)")
        .eq("molecule_id", molecule.id);
      for (const mp of data || []) {
        if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
          pathologieIdSet.add(mp.pathologies.id);
          pathologies.push({ ...mp.pathologies, score_pertinence: mp.score_pertinence });
        }
      }
    }

    if (medicament?.id) {
      const { data } = await supabase
        .from("medicament_pathologie")
        .select("pathologie_id, score_pertinence, pathologies(*)")
        .eq("medicament_id", medicament.id);
      for (const mp of data || []) {
        if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
          pathologieIdSet.add(mp.pathologies.id);
          pathologies.push({ ...mp.pathologies, score_pertinence: mp.score_pertinence });
        }
      }
    }

    const pathologieIds = [...pathologieIdSet];

    // Step 4: Get protocoles for all pathologies (new table)
    let protocoles: any[] = [];
    let conseils: any[] = [];
    let produits: any[] = [];

    if (pathologieIds.length > 0) {
      const [protocolesRes, conseilsRes, produitsRes] = await Promise.all([
        supabase
          .from("protocole_pathologie")
          .select(`
            *, pathologies(nom_pathologie),
            conseil_1:conseils_associes!protocole_pathologie_conseil_1_id_fkey(conseil, description, conseil_code),
            conseil_2:conseils_associes!protocole_pathologie_conseil_2_id_fkey(conseil, description, conseil_code),
            produit_1:produits_complementaires!protocole_pathologie_produit_complementaire_1_id_fkey(produit, categorie, description, priorite, type_produit),
            produit_2:produits_complementaires!protocole_pathologie_produit_complementaire_2_id_fkey(produit, categorie, description, priorite, type_produit),
            produit_3:produits_complementaires!protocole_pathologie_produit_complementaire_3_id_fkey(produit, categorie, description, priorite, type_produit)
          `)
          .in("pathologie_id", pathologieIds)
          .eq("actif", true),
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
      protocoles = protocolesRes.data || [];
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
        est_otc: medicament.est_otc,
        est_produit_conseil: medicament.est_produit_conseil,
        statut_officine: medicament.statut_officine,
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
        niveau_gravite: p.niveau_gravite,
        score_pertinence: p.score_pertinence,
      })),
      protocoles: protocoles.map((p: any) => ({
        pathologie: p.pathologies?.nom_pathologie,
        conseils: [
          p.conseil_1 ? { conseil: p.conseil_1.conseil, description: p.conseil_1.description } : null,
          p.conseil_2 ? { conseil: p.conseil_2.conseil, description: p.conseil_2.description } : null,
        ].filter(Boolean),
        produits_complementaires: [
          p.produit_1 ? { produit: p.produit_1.produit, categorie: p.produit_1.categorie, justification: p.justification_1, priorite: p.priorite_produit_1 } : null,
          p.produit_2 ? { produit: p.produit_2.produit, categorie: p.produit_2.categorie, justification: p.justification_2, priorite: p.priorite_produit_2 } : null,
          p.produit_3 ? { produit: p.produit_3.produit, categorie: p.produit_3.categorie, justification: p.justification_3, priorite: p.priorite_produit_3 } : null,
        ].filter(Boolean),
        actif: p.actif,
        version: p.version_protocole,
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
        type_produit: p.type_produit,
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
