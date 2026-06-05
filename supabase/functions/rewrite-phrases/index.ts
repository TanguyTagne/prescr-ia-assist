import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORBIDDEN_WORDS = [
  "médiateurs inflammatoires","pharmacocinétique","unguéal","adsorbe","biodisponibilité",
  "neuromusculaire","microcirculation","kératine","cytokines","prostaglandines","COX",
  "récepteurs","métabolisme","synthèse","excitabilité","stase veineuse","dysbiose",
  "microflore","microbiome","adhésion bactérienne","muqueuse","tensionnel","diarrhéique",
  "comédogène","hypertension artérielle","œdème","acidité gastrique","hypothyroïdie",
  "œsophagienne","épithéliale","neurotransmetteurs","vasculaire","hémodynamique",
  "catabolisme","anabolisme",
];

const SYSTEM_PROMPT = `Tu rédiges des micro-conseils ultra-courts pour un pharmacien (UI discrète).

FORMAT IMPÉRATIF :
- **3 à 7 mots maximum**, **60 caractères max**
- UNE phrase verbale, **bénéfice patient unique**, sans ponctuation finale
- **Commence par un verbe d'action à la 3e personne** en minuscule
- NE répète JAMAIS le nom du produit
- Pas de majuscule initiale, pas de point final, pas de virgule

VERBES PRÉFÉRÉS : apaise, calme, soulage, hydrate, protège, renforce, nourrit, désinfecte, facilite, complète, restaure, prévient, aide, accompagne, réduit, stimule

EXEMPLES VALIDES :
- "apaise les tensions"
- "calme la diarrhée"
- "désinfecte la gorge"
- "soulage les douleurs articulaires"
- "renforce les défenses naturelles"
- "facilite la digestion"

INTERDIT (mots techniques) : ${FORBIDDEN_WORDS.join(", ")}

AUTORISÉ : flore intestinale, vitamine, magnésium, articulations, circulation, défenses naturelles, énergie, sommeil, digestion, peau, cheveux, confort, bien-être, tension, transit

FORMAT RETOUR : UNIQUEMENT un JSON array [{"id":"...","phrase":"..."}] sans markdown.`;

function validatePhrase(phrase: string, produit: string): { ok: boolean; reason?: string } {
  if (!phrase) return { ok: false, reason: "empty" };
  const trimmed = phrase.trim();
  if (trimmed.length > 60) return { ok: false, reason: "too_long_chars" };
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 7) return { ok: false, reason: "too_long_words" };
  if (wordCount < 2) return { ok: false, reason: "too_short" };
  const lower = trimmed.toLowerCase();
  const prodLower = (produit || "").toLowerCase().split(/\s+/)[0];
  if (prodLower && prodLower.length > 3 && lower.includes(prodLower)) {
    return { ok: false, reason: "contains_product_name" };
  }
  for (const w of FORBIDDEN_WORDS) {
    if (lower.includes(w.toLowerCase())) return { ok: false, reason: `forbidden:${w}` };
  }
  return { ok: true };
}

async function callAI(LOVABLE_API_KEY: string, promptItems: any[]): Promise<{ id: string; phrase: string }[]> {
  const prompt = `Génère un micro-conseil pour chacun de ces ${promptItems.length} produits. Retourne un JSON array [{"id":"...","phrase":"..."}].\n\n${JSON.stringify(promptItems, null, 0)}`;

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
  content = content.trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Admin auth guard ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheckClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminCheckClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  try {
    const { offset = 0, batch_size = 40, ids } = await req.json();

    let query = supabase
      .from("produits_complementaires")
      .select("id, produit, phrase_conseil, pathologies:pathologie_id(nom_pathologie)");

    if (ids && Array.isArray(ids) && ids.length > 0) {
      query = query.in("id", ids);
    } else {
      query = query.order("id").range(offset, offset + batch_size - 1);
    }

    const { data: items, error: fetchErr } = await query;
    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ done: true, updated: 0, offset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptItems = items.map((item: any) => ({
      id: item.id,
      produit: item.produit,
      pathologie: item.pathologies?.nom_pathologie || "inconnu",
    }));

    // First pass
    let updates: { id: string; phrase: string }[] = await callAI(LOVABLE_API_KEY, promptItems);
    const byId = new Map(items.map((i: any) => [i.id, i]));

    // Validate + retry invalid ones once
    const invalid: any[] = [];
    const validUpdates: { id: string; phrase: string }[] = [];
    for (const u of updates) {
      const src: any = byId.get(u.id);
      const phrase = (u.phrase || "").trim().replace(/[.;!?]+$/, "");
      const check = validatePhrase(phrase, src?.produit || "");
      if (check.ok) {
        validUpdates.push({ id: u.id, phrase });
      } else if (src) {
        invalid.push({ id: src.id, produit: src.produit, pathologie: src.pathologies?.nom_pathologie || "inconnu" });
      }
    }

    if (invalid.length > 0) {
      try {
        const retry = await callAI(LOVABLE_API_KEY, invalid);
        for (const u of retry) {
          const src: any = byId.get(u.id);
          const phrase = (u.phrase || "").trim().replace(/[.;!?]+$/, "");
          const check = validatePhrase(phrase, src?.produit || "");
          if (check.ok) validUpdates.push({ id: u.id, phrase });
        }
      } catch (_) { /* ignore retry failure */ }
    }

    // Update DB
    let updated = 0;
    const errors: string[] = [];
    for (const u of validUpdates) {
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
      rejected: items.length - updated,
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
