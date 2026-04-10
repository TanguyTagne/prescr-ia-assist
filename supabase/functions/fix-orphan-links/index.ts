import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MISSING_PRODUCTS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number; phrase: string }[]> = {
  "Trouble obsessionnel compulsif": [
    { produit: "Magnésium bisglycinate 300mg", categorie: "Complément", desc: "Réduit l'anxiété et la tension nerveuse", type: "complement", prio: 85, phrase: "Le magnésium diminue l'hyperexcitabilité nerveuse fréquente sous traitement du TOC." },
    { produit: "Oméga-3 EPA haute concentration", categorie: "Complément", desc: "Soutien neuronal et anti-inflammatoire cérébral", type: "complement", prio: 80, phrase: "Les oméga-3 EPA soutiennent la neurotransmission sérotoninergique, complémentaire au traitement." },
    { produit: "Tisane Mélisse-Passiflore", categorie: "Phytothérapie", desc: "Apaisement naturel sans interaction", type: "produit_conseil", prio: 70, phrase: "La mélisse et la passiflore apaisent sans interagir avec les ISRS prescrits dans le TOC." },
  ],
  "Obésité": [
    { produit: "Konjac glucomannane gélules", categorie: "Coupe-faim naturel", desc: "Fibre qui augmente la satiété", type: "complement", prio: 90, phrase: "Le glucomannane gonfle dans l'estomac et augmente la sensation de satiété entre les repas." },
    { produit: "Protéines de lactosérum poudre", categorie: "Nutrition", desc: "Maintien de la masse musculaire", type: "complement", prio: 80, phrase: "Les protéines préservent la masse musculaire lors de la restriction calorique sous traitement." },
    { produit: "Chrome picolinate 200µg", categorie: "Complément", desc: "Régulation glycémie et envies sucrées", type: "complement", prio: 75, phrase: "Le chrome stabilise la glycémie et réduit les envies de sucre, fréquentes en surpoids." },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stats = { links_created: 0, products_created: 0, protocoles_created: 0, errors: [] as string[] };

    // 1. Batch create medicament_pathologie links from molecule_pathologie
    const [medsRes, linksRes, molPathoRes] = await Promise.all([
      supabase.from("medicaments").select("id, nom_commercial, molecule_id"),
      supabase.from("medicament_pathologie").select("medicament_id"),
      supabase.from("molecule_pathologie").select("molecule_id, pathologie_id, score_pertinence"),
    ]);

    const linkedMedIds = new Set((linksRes.data || []).map(l => l.medicament_id));
    const molPathoMap = new Map<string, { pathologie_id: string; score: number }[]>();
    for (const mp of molPathoRes.data || []) {
      if (!molPathoMap.has(mp.molecule_id)) molPathoMap.set(mp.molecule_id, []);
      molPathoMap.get(mp.molecule_id)!.push({ pathologie_id: mp.pathologie_id, score: mp.score_pertinence || 50 });
    }

    const orphans = (medsRes.data || []).filter(m => m.molecule_id && !linkedMedIds.has(m.id));
    const batchInserts: any[] = [];
    for (const med of orphans) {
      for (const p of (molPathoMap.get(med.molecule_id) || [])) {
        batchInserts.push({
          medicament_id: med.id, pathologie_id: p.pathologie_id,
          score_pertinence: p.score, source_mapping: "auto_molecule_link",
        });
      }
    }

    // Insert in chunks of 50
    for (let i = 0; i < batchInserts.length; i += 50) {
      const chunk = batchInserts.slice(i, i + 50);
      const { data, error } = await supabase.from("medicament_pathologie").insert(chunk).select("id");
      if (data) stats.links_created += data.length;
      if (error) stats.errors.push(`Batch links: ${error.message}`);
    }

    // 2. Add missing products
    const { data: allPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    const pathoMap: Record<string, string> = {};
    for (const p of allPathos || []) pathoMap[p.nom_pathologie] = p.id;

    for (const [pathoName, products] of Object.entries(MISSING_PRODUCTS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) continue;

      const { data: existing } = await supabase.from("produits_complementaires").select("produit").eq("pathologie_id", pathoId);
      const existingNames = new Set((existing || []).map(e => e.produit));
      const toInsert = products.filter(p => !existingNames.has(p.produit)).map(prod => ({
        produit: prod.produit, categorie: prod.categorie, description: prod.desc,
        type_produit: prod.type, priorite: prod.prio, pathologie_id: pathoId,
        phrase_conseil: prod.phrase,
        est_otc: prod.type === "produit_conseil", est_complement: prod.type === "complement",
        est_dispositif_medical: prod.type === "dispositif_medical", est_eligible_cross_sell: true,
      }));

      if (toInsert.length > 0) {
        const { data, error } = await supabase.from("produits_complementaires").insert(toInsert).select("id");
        if (data) stats.products_created += data.length;
        if (error) stats.errors.push(`Prods ${pathoName}: ${error.message}`);
      }
    }

    // 3. Create protocoles for pathologies that have ≥3 products but no active protocole
    const { data: protosExisting } = await supabase.from("protocole_pathologie").select("pathologie_id").eq("actif", true);
    const protoCovered = new Set((protosExisting || []).map(p => p.pathologie_id));

    for (const patho of allPathos || []) {
      if (protoCovered.has(patho.id)) continue;

      const { data: prods } = await supabase.from("produits_complementaires").select("id").eq("pathologie_id", patho.id).order("priorite", { ascending: false }).limit(3);
      if (!prods || prods.length < 3) continue;

      // Get or create conseils
      let { data: conseils } = await supabase.from("conseils_associes").select("id").eq("pathologie_id", patho.id).limit(2);
      const conseilIds = (conseils || []).map(c => c.id);

      if (conseilIds.length < 2) {
        const needed = [
          { conseil: "Conseil hygiéno-diététique", description: `Mesures pour ${patho.nom_pathologie.toLowerCase()}`, pathologie_id: patho.id, priorite: 80 },
          { conseil: "Suivi et surveillance", description: `Surveillance pour ${patho.nom_pathologie.toLowerCase()}`, pathologie_id: patho.id, priorite: 80 },
        ].slice(0, 2 - conseilIds.length);

        const { data: newConseils } = await supabase.from("conseils_associes").insert(needed).select("id");
        if (newConseils) conseilIds.push(...newConseils.map(c => c.id));
      }

      if (conseilIds.length >= 2) {
        const { error } = await supabase.from("protocole_pathologie").insert({
          pathologie_id: patho.id, conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
          produit_complementaire_1_id: prods[0].id, produit_complementaire_2_id: prods[1].id,
          produit_complementaire_3_id: prods[2].id, actif: true,
        });
        if (!error) stats.protocoles_created++;
        else stats.errors.push(`Proto ${patho.nom_pathologie}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Fixé: ${stats.links_created} liens, ${stats.products_created} produits, ${stats.protocoles_created} protocoles`,
      stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
