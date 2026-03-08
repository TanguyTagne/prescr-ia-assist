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
3. Génère entre 3 et 5 questions fermées (oui/non) à poser au patient
4. Une phrase de conseil prête à dire au patient, simple et non médicale

## RÈGLES POUR LES QUESTIONS (CRITIQUE — LIRE ATTENTIVEMENT)
Les médicaments prescrits peuvent correspondre à des SITUATIONS TRÈS DIFFÉRENTES. Les questions doivent aider à identifier LAQUELLE.

EXEMPLE CONCRET : Paracétamol + Chlorhexidine → au moins 5 situations possibles :
- Mal de gorge / angine
- Extraction dentaire récente  
- Plaie cutanée (coupure, brûlure légère)
- Aphtes / ulcérations buccales
- Post-chirurgie (points de suture)
- Fièvre + désinfection d'une plaie sans rapport

DONC les questions doivent couvrir des AXES COMPLÈTEMENT DIFFÉRENTS :
- Q1 : Localisation → "Est-ce que la gêne se situe au niveau de la bouche ou de la gorge ?"
- Q2 : Zone alternative → "Est-ce lié à une plaie ou blessure sur la peau ?"  
- Q3 : Contexte médical → "Avez-vous eu une intervention récente (dentaire ou autre) ?"
- Q4 : Symptôme associé → "Ressentez-vous de la fièvre ou des frissons ?"
- Q5 : Confort → "Avez-vous des difficultés à manger ou à avaler ?"

INTERDIT :
- Poser 3+ questions qui tournent autour de la MÊME zone corporelle ou du MÊME thème
- Présumer que c'est un problème buccal, cutané, ou autre avant d'avoir les réponses
- Chaque question DOIT explorer une hypothèse DIFFÉRENTE

## BASE MÉDICAMENTS (extraits)
- Amoxicilline/Augmentin/Clamoxyl : Pénicilline — infections ORL, respiratoires, urinaires, dentaires
- Azithromycine/Clarithromycine : Macrolides — infections respiratoires, ORL
- Paracétamol (Doliprane, Efferalgan) : Antalgique — douleurs, fièvre (usage très large)
- Ibuprofène/Kétoprofène : AINS — douleurs inflammatoires (multiples causes)
- Chlorhexidine : Antiseptique — usage buccal ET cutané ET post-opératoire
- Tramadol/Codéine : Opioïdes faibles — douleurs modérées
- Oméprazole/Ésoméprazole/Pantoprazole : IPP — protection gastrique
- Metformine : Biguanide — diabète type 2
- Ramipril/Périndopril/Énalapril : IEC — HTA
- Bisoprolol/Aténolol : Bêta-bloquants — HTA, cardio
- Atorvastatine/Rosuvastatine : Statines — cholestérol
- Escitalopram/Sertraline/Fluoxétine : ISRS — contexte anxiodépressif
- Salbutamol (Ventoline) : Bronchodilatateur — asthme
- Prednisone/Prednisolone : Corticoïdes — inflammation
- Rivaroxaban/Apixaban : AOD — anticoagulation

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
  "contextes": ["situation possible 1", "situation possible 2", "situation possible 3"],
  "questions": [
    {"question": "Question oui/non explorant un axe spécifique", "contexte": "Quelle hypothèse cette question permet d'éliminer ou confirmer"}
  ],
  "conseil": "Phrase prête à dire au patient, simple et bienveillante."
}

IMPORTANT :
- Le champ "contextes" DOIT lister AU MOINS 3 situations différentes possibles pour cette ordonnance.
- Les questions doivent permettre de DISCRIMINER entre ces situations — pas de les confirmer toutes.
- Si 2 questions explorent la même zone corporelle, c'est une ERREUR.
- NE PAS inclure de suggestions dans cette première étape.`;

const REFINE_PROMPT = `Tu es PrescrIA, un copilote discret pour préparateurs en pharmacie. Le préparateur a analysé une ordonnance et posé des questions au patient. En fonction des réponses, tu dois IDENTIFIER la situation la plus probable et proposer des recommandations OTC adaptées.

## LOGIQUE DE RAISONNEMENT (CRITIQUE)
1. Analyse les réponses Oui/Non pour DÉDUIRE la situation réelle du patient
2. Élimine les hypothèses contredites par les réponses "Non"
3. Concentre les recommandations sur la situation identifiée
4. Si toutes les réponses sont "Non", propose des recommandations GÉNÉRALES de confort (pas liées à une pathologie spécifique)

EXEMPLE : Paracétamol + Chlorhexidine
- Si "bouche/gorge = Oui" + "plaie peau = Non" + "intervention = Non" → mal de gorge probable → pastilles apaisantes, spray gorge
- Si "bouche/gorge = Non" + "plaie peau = Oui" → plaie cutanée → compresses, pansements
- Si "intervention = Oui" → post-op → bain de bouche doux, alimentation adaptée
- Si TOUT = Non → recommandations générales de confort, hydratation

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie
2. Les recommandations DOIVENT correspondre à la situation déduite des réponses
3. NE PAS recommander des produits buccaux si le patient a dit "Non" à tout ce qui touche la bouche
4. Recommande uniquement des CATÉGORIES de produits OTC (jamais de marques)
5. Maximum 4 recommandations, minimum 1
6. Le conseil doit refléter la situation identifiée

## FORMAT JSON STRICT (rien d'autre)
{
  "suggestions": [
    {"categorie": "Nom catégorie produit", "raison": "Justification courte liée aux réponses", "icon": "emoji", "priorite": "haute|moyenne"}
  ],
  "conseil": "Phrase de conseil personnalisée tenant compte des réponses du patient."
}

IMPORTANT :
- Les suggestions doivent être COHÉRENTES avec les réponses — si le patient dit "Non" à un axe, NE PAS recommander de produits pour cet axe
- Si toutes les réponses sont "Non", propose des recommandations de confort GÉNÉRAL (hydratation, repos, bien-être)
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
