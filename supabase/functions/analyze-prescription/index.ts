import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System prompt for medication extraction only (step 1 is now hybrid)
const EXTRACTION_PROMPT = `Tu es PrescrIA, un copilote pour préparateurs en pharmacie.
Tu dois UNIQUEMENT extraire les médicaments d'une ordonnance et les retourner en JSON.

## FORMAT JSON STRICT
{
  "medicaments_detectes": ["nom1", "nom2", ...]
}

RÈGLES :
- Extrais TOUS les noms de médicaments (commerciaux ou DCI)
- Normalise les noms (majuscule initiale)
- Ne retourne RIEN d'autre que ce JSON`;

// Prompt for AI enrichment when DB data is incomplete
const ENRICHMENT_PROMPT = `Tu es PrescrIA, un copilote pharmacien. On te donne un médicament non trouvé en base de données structurée.
Tu dois fournir ses informations pharmacologiques.

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
2. Langage probabiliste : "souvent associé à", "peut accompagner"

## FORMAT JSON STRICT
{
  "nom": "nom commercial",
  "molecule_active": "DCI",
  "code_atc": "code ATC si connu",
  "classe_therapeutique": "classe",
  "indications": ["indication 1", "indication 2"],
  "mecanisme_action": "mécanisme",
  "effets_secondaires": ["effet 1", "effet 2"],
  "contextes_therapeutiques": [
    {"description": "contexte possible 1", "score": 80},
    {"description": "contexte possible 2", "score": 60}
  ],
  "symptomes_questions": [
    {
      "symptome": "symptôme",
      "question": "question oui/non courte et naturelle",
      "contexte_explication": "ce que cette question aide à identifier",
      "besoin": "besoin patient si oui",
      "otc": [{"categorie": "catégorie produit", "description": "description", "icon": "emoji", "priorite": "haute|moyenne"}]
    }
  ]
}`;

const REFINE_PROMPT = `Tu es PrescrIA, un copilote pour préparateurs en pharmacie. Le préparateur a analysé une ordonnance et posé des questions au patient.

## DONNÉES STRUCTURÉES FOURNIES
On te fournit les données pharmacologiques structurées issues de la base PrescrIA : médicaments, contextes thérapeutiques, symptômes, besoins patients, et suggestions OTC.

## TA MISSION
En fonction des réponses Oui/Non du patient :
1. ÉLIMINE les contextes contredits par les réponses "Non"
2. PRIORISE les suggestions OTC liées aux réponses "Oui"
3. Si tout = "Non", propose des recommandations générales de confort
4. Maximum 4 suggestions OTC, minimum 1

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie
2. Les recommandations DOIVENT correspondre aux réponses du patient
3. Recommande uniquement des CATÉGORIES de produits (jamais de marques)
4. Le conseil doit être naturel, prêt à dire au patient

## FORMAT JSON STRICT
{
  "suggestions": [
    {"categorie": "catégorie produit", "raison": "justification liée aux réponses", "icon": "emoji", "priorite": "haute|moyenne"}
  ],
  "conseil": "Phrase de conseil personnalisée."
}`;

// Helper: search medications in DB by name (fuzzy)
async function findMedicationsInDB(supabase: any, names: string[]) {
  const results: any[] = [];

  for (const name of names) {
    const normalizedName = name.trim().toLowerCase();

    // Try exact match on nom_commercial
    const { data: exactMatch } = await supabase
      .from("medications")
      .select(`
        *,
        therapeutic_classes(*)
      `)
      .ilike("nom_commercial", normalizedName)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      results.push({ ...exactMatch[0], matched: true });
      continue;
    }

    // Try match on molecule_active
    const { data: moleculeMatch } = await supabase
      .from("medications")
      .select(`
        *,
        therapeutic_classes(*)
      `)
      .ilike("molecule_active", `%${normalizedName}%`)
      .limit(1);

    if (moleculeMatch && moleculeMatch.length > 0) {
      results.push({ ...moleculeMatch[0], matched: true });
      continue;
    }

    // Try partial match on nom_commercial
    const { data: partialMatch } = await supabase
      .from("medications")
      .select(`
        *,
        therapeutic_classes(*)
      `)
      .ilike("nom_commercial", `%${normalizedName}%`)
      .limit(1);

    if (partialMatch && partialMatch.length > 0) {
      results.push({ ...partialMatch[0], matched: true });
      continue;
    }

    // Not found in DB
    results.push({ nom_commercial: name, matched: false });
  }

  return results;
}

// Helper: get full therapeutic data for a medication
async function getTherapeuticData(supabase: any, medication: any) {
  if (!medication.classe_therapeutique_id) return null;

  // Get contexts for this class
  const { data: contexts } = await supabase
    .from("therapeutic_contexts")
    .select("*")
    .eq("classe_therapeutique_id", medication.classe_therapeutique_id)
    .order("frequence_score", { ascending: false });

  if (!contexts || contexts.length === 0) return null;

  // Get symptoms, questions, needs, OTC for each context
  const fullContexts = [];
  for (const ctx of contexts) {
    const { data: symptoms } = await supabase
      .from("symptoms")
      .select(`
        *,
        pharma_questions(*),
        patient_needs(*, otc_suggestions(*))
      `)
      .eq("contexte_id", ctx.id)
      .order("frequence_score", { ascending: false });

    fullContexts.push({ ...ctx, symptoms: symptoms || [] });
  }

  return fullContexts;
}

// Helper: use AI to enrich unknown medications
async function enrichWithAI(apiKey: string, medName: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: ENRICHMENT_PROMPT },
        { role: "user", content: `Médicament : ${medName}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Known interactions database
const INTERACTIONS = [
  { meds: ["AINS", "Anticoagulants oraux directs"], niveau: "majeure", desc: "Risque hémorragique accru" },
  { meds: ["Anti-inflammatoires non stéroïdiens", "Anticoagulants oraux directs"], niveau: "majeure", desc: "Risque hémorragique accru" },
  { meds: ["Anti-inflammatoires non stéroïdiens", "Inhibiteurs de l'enzyme de conversion"], niveau: "modérée", desc: "Risque d'insuffisance rénale, surtout avec diurétiques" },
  { meds: ["Antibiotiques - Macrolides", "Statines"], niveau: "modérée", desc: "Risque accru de rhabdomyolyse" },
  { meds: ["ISRS", "Antalgiques opioïdes faibles"], niveau: "modérée", desc: "Risque de syndrome sérotoninergique" },
  { meds: ["Corticoïdes systémiques", "Anti-inflammatoires non stéroïdiens"], niveau: "modérée", desc: "Risque accru d'ulcère gastroduodénal et d'hémorragie digestive" },
];

function checkInteractions(medications: any[]): any[] {
  const foundInteractions: any[] = [];
  const classeNames = medications.map((m: any) => m.therapeutic_classes?.nom || "").filter(Boolean);

  for (const inter of INTERACTIONS) {
    const match0 = classeNames.some((c: string) => c.includes(inter.meds[0]) || inter.meds[0].includes(c));
    const match1 = classeNames.some((c: string) => c.includes(inter.meds[1]) || inter.meds[1].includes(c));
    if (match0 && match1) {
      const med0 = medications.find((m: any) => {
        const cn = m.therapeutic_classes?.nom || "";
        return cn.includes(inter.meds[0]) || inter.meds[0].includes(cn);
      });
      const med1 = medications.find((m: any) => {
        const cn = m.therapeutic_classes?.nom || "";
        return cn.includes(inter.meds[1]) || inter.meds[1].includes(cn);
      });
      foundInteractions.push({
        medicaments: [med0?.nom_commercial || inter.meds[0], med1?.nom_commercial || inter.meds[1]],
        niveau: inter.niveau,
        description: inter.desc,
      });
    }
  }
  return foundInteractions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prescriptionText, imageBase64, mode, analysisContext, answers } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (mode === "refine") {
      // ============ REFINE MODE ============
      // Build structured context from DB data + answers
      const answersText = analysisContext.questions
        .map((q: any, i: number) => `Q: ${q.question}\nR: ${answers[i] ? "Oui" : "Non"}`)
        .join("\n\n");

      // Collect relevant OTC suggestions based on answers
      const relevantOTC: any[] = [];
      const eliminatedContexts: string[] = [];

      if (analysisContext.structuredData) {
        for (const q of analysisContext.questions) {
          const qIndex = analysisContext.questions.indexOf(q);
          const answered = answers[qIndex];

          if (answered && q.otcSuggestions) {
            relevantOTC.push(...q.otcSuggestions);
          }
          if (!answered && q.contexte) {
            eliminatedContexts.push(q.contexte);
          }
        }
      }

      // Use AI to refine with structured context
      const messages = [
        { role: "system", content: REFINE_PROMPT },
        {
          role: "user",
          content: `Ordonnance analysée :
Médicaments : ${analysisContext.medicaments.map((m: any) => `${m.nom} (${m.classe})`).join(", ")}
Contextes thérapeutiques possibles : ${(analysisContext.contextes || []).join(", ")}

Réponses du patient :
${answersText}

${relevantOTC.length > 0 ? `\nSuggestions OTC issues de la base structurée (à prioriser) :\n${relevantOTC.map((o: any) => `- ${o.categorie_produit || o.categorie}: ${o.description || o.desc}`).join("\n")}` : ""}

${eliminatedContexts.length > 0 ? `\nContextes ÉLIMINÉS par les réponses "Non" :\n${eliminatedContexts.join("\n")}` : ""}

Propose des recommandations OTC adaptées en tenant compte des données structurées et des réponses.`,
        },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.1 }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service error");
      }

      const aiRes = await response.json();
      const content = aiRes.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      const result = JSON.parse(jsonStr);
      if (result.suggestions) result.suggestions = result.suggestions.slice(0, 4);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ANALYSIS MODE ============

    // Step 1: Extract medication names using AI (handles OCR + text)
    let medNames: string[] = [];

    if (imageBase64) {
      // Use AI for OCR extraction
      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: [
              { type: "text", text: "Extrais les noms de médicaments de cette ordonnance." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ]},
          ],
          temperature: 0.1,
        }),
      });

      if (!ocrResponse.ok) throw new Error("OCR extraction failed");
      const ocrData = await ocrResponse.json();
      const ocrContent = ocrData.choices?.[0]?.message?.content;
      if (ocrContent) {
        let ocrJson = ocrContent;
        const m = ocrContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (m) ocrJson = m[1].trim();
        try {
          const parsed = JSON.parse(ocrJson);
          medNames = parsed.medicaments_detectes || [];
        } catch { /* fallback below */ }
      }
    } else if (prescriptionText) {
      // Simple text parsing + AI fallback
      const words = prescriptionText.split(/[,\n;]+/).map((w: string) => w.trim()).filter(Boolean);
      if (words.length > 0) {
        medNames = words;
      }
      // Also use AI to extract in case of complex text
      const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: `Extrais les médicaments :\n\n${prescriptionText}` },
          ],
          temperature: 0.1,
        }),
      });

      if (textResponse.ok) {
        const textData = await textResponse.json();
        const textContent = textData.choices?.[0]?.message?.content;
        if (textContent) {
          let tj = textContent;
          const tm = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (tm) tj = tm[1].trim();
          try {
            const parsed = JSON.parse(tj);
            if (parsed.medicaments_detectes?.length > 0) {
              medNames = parsed.medicaments_detectes;
            }
          } catch { /* keep original */ }
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Aucune donnée d'ordonnance fournie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (medNames.length === 0) {
      return new Response(JSON.stringify({
        medicaments: [], interactions: [], contextes: [], questions: [], conseil: "",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 2: Look up each medication in structured DB
    const dbMeds = await findMedicationsInDB(supabase, medNames);

    // Step 3: For unmatched meds, enrich with AI
    const enrichedMeds: any[] = [];
    for (const med of dbMeds) {
      if (med.matched) {
        enrichedMeds.push(med);
      } else {
        const aiData = await enrichWithAI(LOVABLE_API_KEY, med.nom_commercial);
        if (aiData) {
          enrichedMeds.push({
            ...med,
            molecule_active: aiData.molecule_active,
            code_atc: aiData.code_atc,
            therapeutic_classes: { nom: aiData.classe_therapeutique },
            indications_principales: aiData.indications,
            mecanisme_action: aiData.mecanisme_action,
            effets_secondaires_frequents: aiData.effets_secondaires,
            ai_enriched: true,
            ai_contexts: aiData.contextes_therapeutiques,
            ai_symptom_questions: aiData.symptomes_questions,
          });
        } else {
          enrichedMeds.push(med);
        }
      }
    }

    // Step 4: Get therapeutic data from DB
    const allContexts: string[] = [];
    const allQuestions: any[] = [];
    let hasStructuredData = false;

    for (const med of enrichedMeds) {
      if (med.matched) {
        const therapeuticData = await getTherapeuticData(supabase, med);
        if (therapeuticData) {
          hasStructuredData = true;
          for (const ctx of therapeuticData) {
            allContexts.push(ctx.description);
            for (const symptom of ctx.symptoms) {
              for (const q of (symptom.pharma_questions || [])) {
                const otcSuggs = (symptom.patient_needs || []).flatMap((n: any) => n.otc_suggestions || []);
                allQuestions.push({
                  question: q.question,
                  contexte: q.contexte_explication || ctx.description,
                  symptom_id: symptom.id,
                  context_id: ctx.id,
                  score: (ctx.frequence_score || 50) + (symptom.frequence_score || 50),
                  otcSuggestions: otcSuggs,
                });
              }
            }
          }
        }
      } else if (med.ai_enriched) {
        // Use AI-generated data
        if (med.ai_contexts) {
          for (const ctx of med.ai_contexts) {
            allContexts.push(ctx.description);
          }
        }
        if (med.ai_symptom_questions) {
          for (const sq of med.ai_symptom_questions) {
            allQuestions.push({
              question: sq.question,
              contexte: sq.contexte_explication,
              score: 40,
              otcSuggestions: (sq.otc || []).map((o: any) => ({
                categorie_produit: o.categorie,
                description: o.description,
                icon: o.icon,
                priorite: o.priorite,
              })),
            });
          }
        }
      }
    }

    // Step 5: Deduplicate and prioritize questions (max 4)
    const uniqueQuestions = allQuestions
      .filter((q, i, arr) => arr.findIndex((x) => x.question === q.question) === i)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 4);

    // Step 6: Check interactions
    const interactions = checkInteractions(enrichedMeds.filter((m) => m.matched || m.ai_enriched));

    // Step 7: Build result
    const uniqueContexts = [...new Set(allContexts)].slice(0, 5);

    const result = {
      medicaments: enrichedMeds.map((m) => ({
        nom: m.nom_commercial,
        classe: m.therapeutic_classes?.nom || "Non classifié",
      })),
      interactions,
      contextes: uniqueContexts,
      questions: uniqueQuestions.map((q) => ({
        question: q.question,
        contexte: q.contexte,
        otcSuggestions: q.otcSuggestions,
      })),
      conseil: "N'hésitez pas à me poser des questions sur votre traitement, je suis là pour vous accompagner.",
      structuredData: hasStructuredData,
    };

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
