import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Produits complémentaires pour pathologies sans couverture
const MISSING_PRODUCTS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number; phrase: string }[]> = {
  "Trouble obsessionnel compulsif": [
    { produit: "Magnésium bisglycinate 300mg", categorie: "Complément", desc: "Réduit l'anxiété et la tension nerveuse", type: "complement", prio: 85, phrase: "Le magnésium diminue l'hyperexcitabilité nerveuse fréquente sous traitement du TOC." },
    { produit: "Oméga-3 EPA haute concentration", categorie: "Complément", desc: "Soutien neuronal et anti-inflammatoire cérébral", type: "complement", prio: 80, phrase: "Les oméga-3 EPA soutiennent la neurotransmission sérotoninergique, complémentaire au traitement." },
    { produit: "Tisane Mélisse-Passiflore", categorie: "Phytothérapie", desc: "Apaisement naturel sans interaction médicamenteuse", type: "produit_conseil", prio: 70, phrase: "La mélisse et la passiflore apaisent sans interagir avec les ISRS prescrits dans le TOC." },
  ],
  "Obésité": [
    { produit: "Konjac glucomannane gélules", categorie: "Coupe-faim naturel", desc: "Fibre qui augmente la satiété", type: "complement", prio: 90, phrase: "Le glucomannane gonfle dans l'estomac et augmente la sensation de satiété entre les repas." },
    { produit: "Protéines de lactosérum poudre", categorie: "Nutrition", desc: "Maintien de la masse musculaire pendant la perte de poids", type: "complement", prio: 80, phrase: "Les protéines préservent la masse musculaire lors de la restriction calorique sous traitement." },
    { produit: "Chrome picolinate 200µg", categorie: "Complément", desc: "Régulation de la glycémie et des envies sucrées", type: "complement", prio: 75, phrase: "Le chrome stabilise la glycémie et réduit les envies de sucre, fréquentes en surpoids." },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stats = { links_created: 0, products_created: 0, protocoles_created: 0, errors: [] as string[] };

    // 1. Create medicament_pathologie links from molecule_pathologie for orphan medicaments
    const { data: orphanMeds } = await supabase.from("medicaments").select(`
      id, nom_commercial, molecule_id
    `);

    const { data: existingLinks } = await supabase.from("medicament_pathologie").select("medicament_id");
    const linkedMedIds = new Set((existingLinks || []).map(l => l.medicament_id));

    const orphans = (orphanMeds || []).filter(m => m.molecule_id && !linkedMedIds.has(m.id));

    // Get all molecule_pathologie links
    const { data: molPathoLinks } = await supabase.from("molecule_pathologie").select("molecule_id, pathologie_id, score_pertinence");
    const molPathoMap = new Map<string, { pathologie_id: string; score: number }[]>();
    for (const mp of molPathoLinks || []) {
      if (!molPathoMap.has(mp.molecule_id)) molPathoMap.set(mp.molecule_id, []);
      molPathoMap.get(mp.molecule_id)!.push({ pathologie_id: mp.pathologie_id, score: mp.score_pertinence || 50 });
    }

    for (const med of orphans) {
      const pathos = molPathoMap.get(med.molecule_id) || [];
      for (const p of pathos) {
        const { error } = await supabase.from("medicament_pathologie").insert({
          medicament_id: med.id,
          pathologie_id: p.pathologie_id,
          score_pertinence: p.score,
          source_mapping: "auto_molecule_link",
        });
        if (!error) stats.links_created++;
        else if (!error.message.includes("duplicate")) stats.errors.push(`Link ${med.nom_commercial}: ${error.message}`);
      }
    }

    // 2. Add missing products for TOC and Obésité
    const { data: allPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    const pathoMap: Record<string, string> = {};
    for (const p of allPathos || []) pathoMap[p.nom_pathologie] = p.id;

    for (const [pathoName, products] of Object.entries(MISSING_PRODUCTS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) { stats.errors.push(`Patho not found: ${pathoName}`); continue; }

      const { data: existing } = await supabase.from("produits_complementaires").select("produit").eq("pathologie_id", pathoId);
      const existingNames = new Set((existing || []).map(e => e.produit));
      const produitIds: string[] = [];

      for (const prod of products) {
        if (existingNames.has(prod.produit)) continue;
        const { data, error } = await supabase.from("produits_complementaires").insert({
          produit: prod.produit, categorie: prod.categorie, description: prod.desc,
          type_produit: prod.type, priorite: prod.prio, pathologie_id: pathoId,
          phrase_conseil: prod.phrase,
          est_otc: prod.type === "produit_conseil", est_complement: prod.type === "complement",
          est_dispositif_medical: prod.type === "dispositif_medical", est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) { produitIds.push(data.id); stats.products_created++; }
        if (error) stats.errors.push(`Prod ${prod.produit}: ${error.message}`);
      }

      // Create protocole if missing
      if (produitIds.length >= 3) {
        const { data: existingProto } = await supabase.from("protocole_pathologie").select("id").eq("pathologie_id", pathoId).eq("actif", true).limit(1);
        if (!existingProto || existingProto.length === 0) {
          // Create conseils
          const conseilIds: string[] = [];
          for (const c of [
            { label: `Conseil hygiéno-diététique`, desc: `Mesures générales pour ${pathoName.toLowerCase()}` },
            { label: `Suivi et surveillance`, desc: `Quand reconsulter pour ${pathoName.toLowerCase()}` },
          ]) {
            const { data } = await supabase.from("conseils_associes").insert({ pathologie_id: pathoId, conseil: c.label, description: c.desc, priorite: 80 }).select("id").single();
            if (data) conseilIds.push(data.id);
          }
          if (conseilIds.length >= 2) {
            const { error } = await supabase.from("protocole_pathologie").insert({
              pathologie_id: pathoId, conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
              produit_complementaire_1_id: produitIds[0], produit_complementaire_2_id: produitIds[1],
              produit_complementaire_3_id: produitIds[2], actif: true,
            });
            if (!error) stats.protocoles_created++;
          }
        }
      }
    }

    // 3. Create protocoles for pathologies that have products but no protocole
    const { data: pathosWithProducts } = await supabase.rpc("get_pathos_missing_protocoles" as any);
    // Fallback: manually check
    const { data: allPathosForProto } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const patho of allPathosForProto || []) {
      const { data: proto } = await supabase.from("protocole_pathologie").select("id").eq("pathologie_id", patho.id).eq("actif", true).limit(1);
      if (proto && proto.length > 0) continue;

      const { data: prods } = await supabase.from("produits_complementaires").select("id").eq("pathologie_id", patho.id).order("priorite", { ascending: false }).limit(3);
      if (!prods || prods.length < 3) continue;

      const { data: conseils } = await supabase.from("conseils_associes").select("id").eq("pathologie_id", patho.id).limit(2);
      let conseilIds = (conseils || []).map(c => c.id);

      if (conseilIds.length < 2) {
        for (const c of [
          { label: `Conseil hygiéno-diététique`, desc: `Mesures pour ${patho.nom_pathologie.toLowerCase()}` },
          { label: `Suivi et surveillance`, desc: `Surveillance pour ${patho.nom_pathologie.toLowerCase()}` },
        ]) {
          if (conseilIds.length >= 2) break;
          const { data } = await supabase.from("conseils_associes").insert({ pathologie_id: patho.id, conseil: c.label, description: c.desc, priorite: 80 }).select("id").single();
          if (data) conseilIds.push(data.id);
        }
      }

      if (conseilIds.length >= 2) {
        const { error } = await supabase.from("protocole_pathologie").insert({
          pathologie_id: patho.id, conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
          produit_complementaire_1_id: prods[0].id, produit_complementaire_2_id: prods[1].id,
          produit_complementaire_3_id: prods[2].id, actif: true,
        });
        if (!error) stats.protocoles_created++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Fixé: ${stats.links_created} liens médicament-pathologie, ${stats.products_created} produits, ${stats.protocoles_created} protocoles`,
      stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
