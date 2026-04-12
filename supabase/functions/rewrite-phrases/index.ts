import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un expert en conseil officinal. Tu réécris des phrases conseil que le pharmacien dit au client pour lui proposer un produit complémentaire.

RÈGLES STRICTES :
- 15-25 mots maximum, UNE seule phrase
- Structure : [effet ressenti / besoin du patient] + [ce que le produit apporte concrètement]
- Ton : pharmacien bienveillant qui conseille naturellement, PAS qui prescrit
- Vouvoiement uniquement
- INTERDIT : "médiateurs inflammatoires", "pharmacocinétique", "unguéal", "adsorbe", "biodisponibilité", "neuromusculaire", "microcirculation", "kératine", "cytokines", "prostaglandines", "COX", "récepteurs", "métabolisme", "synthèse", "excitabilité", "stase veineuse", "dysbiose", "microflore", "microbiome", "adhésion bactérienne"
- AUTORISÉ : "flore intestinale", "vitamine", "magnésium", "articulations", "circulation", "défenses naturelles", "énergie", "sommeil", "digestion", "peau", "cheveux"
- Ne commence JAMAIS par le nom du produit
- La phrase doit donner envie d'acheter tout en restant crédible

FORMAT : Retourne UNIQUEMENT un JSON array [{id, phrase}] sans markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const { offset = 0, batch_size = 40 } = await req.json();

    // Fetch batch
    const { data: items, error: fetchErr } = await supabase
      .from("produits_complementaires")
      .select("id, produit, phrase_conseil, pathologies:pathologie_id(nom_pathologie)")
      .order("id")
      .range(offset, offset + batch_size - 1);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ done: true, updated: 0, offset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt
    const promptItems = items.map((item: any) => ({
      id: item.id,
      produit: item.produit,
      pathologie: item.pathologies?.nom_pathologie || "inconnu",
      phrase_actuelle: item.phrase_conseil || "",
    }));

    const prompt = `Réécris ces ${promptItems.length} phrases conseil. Retourne un JSON array [{"id":"...","phrase":"..."}].\n\n${JSON.stringify(promptItems, null, 0)}`;

    // Call AI
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${t}`);
    }

    const aiData = await aiResp.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown fences
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const updates: { id: string; phrase: string }[] = JSON.parse(content);

    // Update DB
    let updated = 0;
    const errors: string[] = [];
    for (const u of updates) {
      const { error } = await supabase
        .from("produits_complementaires")
        .update({ phrase_conseil: u.phrase })
        .eq("id", u.id);
      if (error) errors.push(`${u.id}: ${error.message}`);
      else updated++;
    }

    return new Response(JSON.stringify({
      done: items.length < batch_size,
      updated,
      errors: errors.length,
      error_details: errors.slice(0, 3),
      next_offset: offset + batch_size,
      fetched: items.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
