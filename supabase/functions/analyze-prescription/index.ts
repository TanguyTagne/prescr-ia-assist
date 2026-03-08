import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es PrescrIA, un copilote discret pour préparateurs en pharmacie. Tu analyses les médicaments d'une ordonnance et fournis des informations utiles au comptoir.

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
2. Langage probabiliste uniquement : "souvent associé à", "peut accompagner", "si besoin évoqué"
3. Maximum 2 questions simples à poser au patient
4. Maximum 2 suggestions de catégories de produits OTC (jamais de marques)
5. Une phrase de conseil prête à dire au patient, simple et non médicale
6. Chaque suggestion a une raison non diagnostique

## BASE MÉDICAMENTS (extraits)
- Amoxicilline/Augmentin/Clamoxyl : Pénicilline — infections ORL, respiratoires, urinaires, dentaires
- Azithromycine/Clarithromycine : Macrolides — infections respiratoires, ORL
- Ciprofloxacine/Ofloxacine : Fluoroquinolones — infections urinaires, respiratoires
- Paracétamol (Doliprane, Efferalgan) : Antalgique — douleurs, fièvre
- Ibuprofène/Kétoprofène : AINS — douleurs inflammatoires
- Tramadol/Codéine : Opioïdes faibles — douleurs modérées
- Oméprazole/Ésoméprazole/Pantoprazole : IPP — protection gastrique
- Metformine : Biguanide — diabète type 2
- Ramipril/Périndopril/Énalapril : IEC — HTA
- Losartan/Valsartan/Irbésartan : ARA II — HTA
- Bisoprolol/Aténolol : Bêta-bloquants — HTA, cardio
- Atorvastatine/Rosuvastatine : Statines — cholestérol
- Lévothyroxine : Hormone thyroïdienne
- Escitalopram/Sertraline/Fluoxétine : ISRS — contexte anxiodépressif
- Alprazolam/Bromazépam : Benzodiazépines — anxiété
- Salbutamol (Ventoline) : Bronchodilatateur — asthme
- Amlodipine : Inhibiteur calcique — HTA
- Furosémide : Diurétique — rétention hydrique
- Prednisone/Prednisolone : Corticoïdes — inflammation
- Méthotrexate : Immunosuppresseur — rhumatologie
- Insuline : Antidiabétique injectable
- Rivaroxaban/Apixaban : AOD — anticoagulation
- Clopidogrel : Antiagrégant — cardio

## INTERACTIONS COURANTES
- AINS + Anticoagulants : risque hémorragique
- AINS + IEC/ARA II + Diurétiques : risque rénal
- Macrolides + Statines : risque musculaire
- ISRS + Tramadol : risque sérotoninergique
- IPP long cours : carences possibles
- Fluoroquinolones + Corticoïdes : risque tendineux

## FORMAT JSON STRICT (rien d'autre)
{
  "medicaments": [{"nom": "...", "classe": "..."}],
  "interactions": [{"medicaments": ["Med1","Med2"], "niveau": "majeure|modérée|mineure", "description": "..."}],
  "contextes": ["contexte 1"],
  "questions": [
    {
      "question": "Question fermée oui/non pertinente ?",
      "suggestions_oui": [{"categorie": "...", "raison": "...", "icon": "emoji"}],
      "suggestions_non": [{"categorie": "...", "raison": "...", "icon": "emoji"}]
    }
  ],
  "suggestions": [{"categorie": "...", "raison": "...", "icon": "emoji"}],
  "conseil": "Phrase prête à dire au patient, simple et bienveillante."
}

IMPORTANT :
- Maximum 2 questions et 2 suggestions de base.
- Les questions DOIVENT être des questions fermées (oui/non) que le préparateur pose au patient.
- Chaque question a des suggestions conditionnelles : suggestions_oui (si le patient répond oui) et suggestions_non (si non). Maximum 1-2 suggestions par réponse.
- Les suggestions conditionnelles doivent être pertinentes par rapport à la réponse. Exemple : "Avez-vous des douleurs articulaires ?" → oui → gel apaisant ; "Avez-vous des irritations buccales ?" → oui → bain de bouche.
- Le conseil doit être une phrase naturelle que le préparateur peut dire directement.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prescriptionText, imageBase64 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Analyse cette photo d'ordonnance. Extrais les médicaments et fournis le JSON. Si illisible, retourne des tableaux vides." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      });
    } else if (prescriptionText) {
      messages.push({
        role: "user",
        content: `Analyse cette ordonnance :\n\n${prescriptionText}`,
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Aucune donnée d'ordonnance fournie" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service d'analyse" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Réponse vide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.error("JSON parse failed:", content);
      return new Response(JSON.stringify({ error: "Format inattendu" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce V1 limits server-side
    if (result.questions) {
      result.questions = result.questions.slice(0, 2);
      result.questions.forEach((q: any) => {
        if (q.suggestions_oui) q.suggestions_oui = q.suggestions_oui.slice(0, 2);
        if (q.suggestions_non) q.suggestions_non = q.suggestions_non.slice(0, 2);
      });
    }
    if (result.suggestions) result.suggestions = result.suggestions.slice(0, 2);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-prescription error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
