import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `Tu es PrescrIA, un copilote discret pour préparateurs en pharmacie. Tu analyses les médicaments d'une ordonnance et fournis des informations utiles au comptoir.

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
2. Langage probabiliste uniquement : "souvent associé à", "peut accompagner", "si besoin évoqué"
3. Génère entre 3 et 5 questions fermées (oui/non) pertinentes à poser au patient
4. Les questions doivent couvrir différents aspects : confort digestif, douleurs, sommeil, peau, hydratation, effets secondaires potentiels, habitudes, etc.
5. Chaque question doit permettre d'explorer un besoin potentiel de produit complémentaire
6. Une phrase de conseil prête à dire au patient, simple et non médicale

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
    {"question": "Question fermée oui/non pertinente ?", "contexte": "Explication courte de pourquoi cette question est utile"}
  ],
  "conseil": "Phrase prête à dire au patient, simple et bienveillante."
}

IMPORTANT :
- Entre 3 et 5 questions fermées (oui/non) que le préparateur pose au patient.
- Chaque question explore un axe différent (digestion, douleur, sommeil, peau, hydratation, stress, etc.)
- Le champ "contexte" explique brièvement pourquoi la question est pertinente vu l'ordonnance.
- Le conseil doit être une phrase naturelle que le préparateur peut dire directement.
- NE PAS inclure de suggestions dans cette première étape.`;

const REFINE_PROMPT = `Tu es PrescrIA, un copilote discret pour préparateurs en pharmacie. Le préparateur a analysé une ordonnance et a posé des questions au patient. En fonction des réponses, tu dois maintenant proposer des recommandations de produits OTC (sans marques) pour accompagner l'ordonnance.

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
2. Langage probabiliste : "peut accompagner", "souvent utile dans ce contexte"
3. Recommande uniquement des CATÉGORIES de produits OTC (jamais de marques)
4. Chaque recommandation doit être justifiée par les réponses du patient ET l'ordonnance
5. Maximum 4 recommandations, minimum 1
6. Une phrase de conseil mise à jour tenant compte des réponses

## FORMAT JSON STRICT (rien d'autre)
{
  "suggestions": [
    {"categorie": "Nom catégorie produit", "raison": "Justification courte liée aux réponses", "icon": "emoji", "priorite": "haute|moyenne"}
  ],
  "conseil": "Phrase de conseil personnalisée tenant compte des réponses du patient."
}

IMPORTANT :
- Les suggestions doivent être directement liées aux réponses positives du patient
- Si le patient a répondu "non" à tout, propose quand même 1-2 suggestions de base liées à l'ordonnance
- Classe les suggestions par priorité (haute = directement lié aux réponses, moyenne = prévention générale)
- Le conseil doit être naturel, prêt à dire au patient`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prescriptionText, imageBase64, mode, analysisContext, answers } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const messages: any[] = [];

    if (mode === "refine") {
      // Second call: refine recommendations based on answers
      messages.push({ role: "system", content: REFINE_PROMPT });

      const answersText = analysisContext.questions
        .map((q: any, i: number) => `Q: ${q.question}\nR: ${answers[i] ? "Oui" : "Non"}`)
        .join("\n\n");

      messages.push({
        role: "user",
        content: `Ordonnance analysée :
Médicaments : ${analysisContext.medicaments.map((m: any) => `${m.nom} (${m.classe})`).join(", ")}
Contextes : ${analysisContext.contextes.join(", ")}

Réponses du patient aux questions :
${answersText}

Propose des recommandations OTC adaptées.`,
      });
    } else {
      // First call: analyze prescription
      messages.push({ role: "system", content: ANALYSIS_PROMPT });

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

    // Enforce limits
    if (mode === "refine") {
      if (result.suggestions) result.suggestions = result.suggestions.slice(0, 4);
    } else {
      if (result.questions) result.questions = result.questions.slice(0, 5);
    }

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
