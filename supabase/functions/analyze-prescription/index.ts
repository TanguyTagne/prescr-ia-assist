import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== PUBLIC API INTEGRATIONS ======

// RxNav API (NIH/NLM) - ATC classification, free, no key needed
async function rxnavGetATC(drugName: string): Promise<{ classId: string; className: string } | null> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json?drugName=${encodeURIComponent(drugName)}&relaSource=ATC`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const infos = data?.rxclassDrugInfoList?.rxclassDrugInfo;
    if (!infos || infos.length === 0) return null;
    // Return the most specific ATC classification
    const atc = infos.find((i: any) => i.rxclassMinConceptItem?.classType === "ATC1-4");
    if (atc) return { classId: atc.rxclassMinConceptItem.classId, className: atc.rxclassMinConceptItem.className };
    return { classId: infos[0].rxclassMinConceptItem.classId, className: infos[0].rxclassMinConceptItem.className };
  } catch (e) {
    console.error("RxNav ATC lookup failed:", e);
    return null;
  }
}

// OpenFDA API - Drug label data (indications, warnings, interactions), free, no key needed
async function openFDAGetDrugInfo(drugName: string): Promise<{
  indications: string;
  warnings: string;
  drugInteractions: string;
  adverseReactions: string;
  pharmacoClass: string[];
} | null> {
  try {
    // Try generic_name first, then brand_name
    let url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
    let res = await fetch(url);
    let data = await res.json();

    if (!data.results || data.results.length === 0) {
      url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=1`;
      res = await fetch(url);
      data = await res.json();
    }

    if (!data.results || data.results.length === 0) {
      // Try a broader search
      url = `https://api.fda.gov/drug/label.json?search="${encodeURIComponent(drugName)}"&limit=1`;
      res = await fetch(url);
      data = await res.json();
    }

    if (!data.results || data.results.length === 0) return null;

    const label = data.results[0];
    return {
      indications: (label.indications_and_usage || []).join(" ").substring(0, 1000),
      warnings: (label.warnings_and_cautions || label.warnings || []).join(" ").substring(0, 500),
      drugInteractions: (label.drug_interactions || []).join(" ").substring(0, 500),
      adverseReactions: (label.adverse_reactions || []).join(" ").substring(0, 500),
      pharmacoClass: label.openfda?.pharm_class_epc || [],
    };
  } catch (e) {
    console.error("OpenFDA lookup failed:", e);
    return null;
  }
}

// OpenFDA Adverse Events API - report interactions between drugs
async function openFDAGetInteractions(drug1: string, drug2: string): Promise<string | null> {
  try {
    const url = `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:"${encodeURIComponent(drug1)}"+AND+patient.drug.openfda.generic_name:"${encodeURIComponent(drug2)}"&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.meta?.results?.total > 10) {
      return `${data.meta.results.total} effets indésirables rapportés avec cette association`;
    }
    return null;
  } catch {
    return null;
  }
}

// ====== PROMPTS ======

const EXTRACTION_PROMPT = `Tu es PrescrIA, un copilote pour préparateurs en pharmacie.
Tu dois UNIQUEMENT extraire les médicaments d'une ordonnance et les retourner en JSON.

## FORMAT JSON STRICT
{
  "medicaments_detectes": [
    {"nom_commercial": "nom tel qu'écrit", "molecule_probable": "DCI si connue, sinon null"}
  ]
}

RÈGLES :
- Extrais TOUS les noms de médicaments (commerciaux ou DCI)
- Si tu reconnais la DCI, indique-la
- Ne retourne RIEN d'autre que ce JSON`;

const ENRICHMENT_PROMPT = `Tu es PrescrIA, un copilote pharmacien. On te donne un médicament et ses données issues de bases publiques (RxNav ATC, OpenFDA).
Utilise ces données OFFICIELLES pour structurer les informations pharmacologiques.

## DONNÉES PUBLIQUES FOURNIES (à utiliser en priorité)
{PUBLIC_DATA}

## FORMAT JSON STRICT
{
  "nom": "nom commercial",
  "molecule_active": "DCI",
  "code_atc": "code ATC",
  "classe_therapeutique": "classe en français",
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
      "question": "question FERMÉE (réponse Oui ou Non uniquement). Ex: 'Ressentez-vous des douleurs ?' JAMAIS de question ouverte comme 'Quelles douleurs ressentez-vous ?'",
      "contexte_explication": "ce que cette question aide à identifier",
      "besoin": "besoin patient si oui",
      "otc": [{"categorie": "catégorie produit OTC", "description": "description", "priorite": "haute|moyenne"}]
    }
  ]
}

RÈGLES :
- JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
- Langage probabiliste : "souvent associé à", "peut accompagner"
- Les questions doivent couvrir des AXES DIFFÉRENTS (pas toutes sur le même thème)
- Maximum 4 questions
- TOUTES les questions DOIVENT être FERMÉES (réponse Oui ou Non UNIQUEMENT)
- INTERDIT : questions ouvertes (commençant par "Quel", "Comment", "Où", "Quand", "Pourquoi", "Décrivez")
- OBLIGATOIRE : questions commençant par "Ressentez-vous", "Avez-vous", "Est-ce que", "Prenez-vous", etc.
- Baser les indications et effets secondaires SUR LES DONNÉES PUBLIQUES fournies`;

const REFINE_PROMPT = `Tu es PrescrIA, un copilote pour préparateurs en pharmacie. Le préparateur a analysé une ordonnance et posé des questions au patient.

## DONNÉES STRUCTURÉES FOURNIES
On te fournit les données pharmacologiques structurées issues de bases publiques (ANSM, ATC/WHO, OpenFDA) et de la base PrescrIA.

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

// ====== DB HELPERS ======

async function findMedicationsInDB(supabase: any, names: string[]) {
  const results: any[] = [];
  for (const name of names) {
    const n = name.trim().toLowerCase();
    // Try nom_commercial exact
    let { data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("nom_commercial", n).limit(1);
    if (data?.length > 0) { results.push({ ...data[0], matched: true }); continue; }
    // Try molecule_active
    ({ data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("molecule_active", `%${n}%`).limit(1));
    if (data?.length > 0) { results.push({ ...data[0], matched: true }); continue; }
    // Try partial nom_commercial
    ({ data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("nom_commercial", `%${n}%`).limit(1));
    if (data?.length > 0) { results.push({ ...data[0], matched: true }); continue; }
    results.push({ nom_commercial: name, matched: false });
  }
  return results;
}

async function getTherapeuticData(supabase: any, medication: any) {
  if (!medication.classe_therapeutique_id) return null;
  const { data: contexts } = await supabase
    .from("therapeutic_contexts").select("*")
    .eq("classe_therapeutique_id", medication.classe_therapeutique_id)
    .order("frequence_score", { ascending: false });
  if (!contexts?.length) return null;

  const fullContexts = [];
  for (const ctx of contexts) {
    const { data: symptoms } = await supabase
      .from("symptoms").select("*, pharma_questions(*), patient_needs(*, otc_suggestions(*))")
      .eq("contexte_id", ctx.id).order("frequence_score", { ascending: false });
    fullContexts.push({ ...ctx, symptoms: symptoms || [] });
  }
  return fullContexts;
}

// ====== INTERACTION CHECK (DB + OpenFDA) ======

const KNOWN_INTERACTIONS = [
  { classes: ["Anti-inflammatoires non stéroïdiens", "Anticoagulants oraux directs"], niveau: "majeure", desc: "Risque hémorragique accru (source: ANSM/HAS)" },
  { classes: ["Anti-inflammatoires non stéroïdiens", "Inhibiteurs de l'enzyme de conversion"], niveau: "modérée", desc: "Risque d'insuffisance rénale, surtout avec diurétiques (source: ANSM)" },
  { classes: ["Antibiotiques - Macrolides", "Statines"], niveau: "modérée", desc: "Risque accru de rhabdomyolyse (source: ANSM)" },
  { classes: ["ISRS", "Antalgiques opioïdes faibles"], niveau: "modérée", desc: "Risque de syndrome sérotoninergique (source: ANSM)" },
  { classes: ["Corticoïdes systémiques", "Anti-inflammatoires non stéroïdiens"], niveau: "modérée", desc: "Risque accru d'ulcère gastroduodénal (source: HAS)" },
  { classes: ["Anti-inflammatoires non stéroïdiens", "Biguanides"], niveau: "modérée", desc: "Risque d'insuffisance rénale aiguë (source: ANSM)" },
];

function checkLocalInteractions(medications: any[]): any[] {
  const found: any[] = [];
  const classes = medications.map((m: any) => m.therapeutic_classes?.nom || "").filter(Boolean);
  for (const inter of KNOWN_INTERACTIONS) {
    const m0 = classes.some((c: string) => c.includes(inter.classes[0]) || inter.classes[0].includes(c));
    const m1 = classes.some((c: string) => c.includes(inter.classes[1]) || inter.classes[1].includes(c));
    if (m0 && m1) {
      const med0 = medications.find((m: any) => (m.therapeutic_classes?.nom || "").includes(inter.classes[0]) || inter.classes[0].includes(m.therapeutic_classes?.nom || ""));
      const med1 = medications.find((m: any) => (m.therapeutic_classes?.nom || "").includes(inter.classes[1]) || inter.classes[1].includes(m.therapeutic_classes?.nom || ""));
      found.push({
        medicaments: [med0?.nom_commercial || inter.classes[0], med1?.nom_commercial || inter.classes[1]],
        niveau: inter.niveau, description: inter.desc,
      });
    }
  }
  return found;
}

// ====== AI HELPERS ======

async function callAI(apiKey: string, messages: any[], temperature = 0.1) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI error: ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  let jsonStr = content;
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1].trim();
  return JSON.parse(jsonStr);
}

// ====== MAIN HANDLER ======

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

    // ============ REFINE MODE ============
    if (mode === "refine") {
      const answersText = analysisContext.questions
        .map((q: any, i: number) => `Q: ${q.question}\nR: ${answers[i] ? "Oui" : "Non"}`)
        .join("\n\n");

      const relevantOTC: any[] = [];
      const eliminatedContexts: string[] = [];

      for (let i = 0; i < analysisContext.questions.length; i++) {
        const q = analysisContext.questions[i];
        if (answers[i] && q.otcSuggestions) {
          relevantOTC.push(...q.otcSuggestions);
        }
        if (!answers[i] && q.contexte) {
          eliminatedContexts.push(q.contexte);
        }
      }

      const result = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: REFINE_PROMPT },
        { role: "user", content: `Ordonnance analysée :
Médicaments : ${analysisContext.medicaments.map((m: any) => `${m.nom} (${m.classe})`).join(", ")}
Contextes thérapeutiques : ${(analysisContext.contextes || []).join(", ")}
Sources : Base PrescrIA (ANSM/ATC), OpenFDA, RxNav

Réponses du patient :
${answersText}

${relevantOTC.length > 0 ? `Suggestions OTC de la base structurée (à prioriser) :\n${relevantOTC.map((o: any) => `- ${o.categorie_produit || o.categorie}: ${o.description || o.desc}`).join("\n")}` : ""}

${eliminatedContexts.length > 0 ? `Contextes ÉLIMINÉS par les "Non" :\n${eliminatedContexts.join("\n")}` : ""}

Propose des recommandations OTC adaptées.` },
      ]);

      if (result.suggestions) result.suggestions = result.suggestions.slice(0, 4);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ANALYSIS MODE ============

    // Step 1: Extract medication names
    let medEntries: { nom_commercial: string; molecule_probable?: string }[] = [];

    if (imageBase64) {
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extrais les noms de médicaments de cette ordonnance." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ]},
      ]);
      medEntries = parsed.medicaments_detectes || [];
    } else if (prescriptionText) {
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extrais les médicaments :\n\n${prescriptionText}` },
      ]);
      medEntries = parsed.medicaments_detectes || [];
    } else {
      return new Response(JSON.stringify({ error: "Aucune donnée d'ordonnance fournie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (medEntries.length === 0) {
      return new Response(JSON.stringify({
        medicaments: [], interactions: [], contextes: [], questions: [], conseil: "", sources: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const medNames = medEntries.map((m: any) => typeof m === "string" ? m : m.nom_commercial);
    const medMolecules = medEntries.map((m: any) => typeof m === "string" ? null : m.molecule_probable);

    // Step 2: DB lookup
    const dbMeds = await findMedicationsInDB(supabase, medNames);

    // Step 3: For unmatched meds, query PUBLIC APIs then enrich with AI
    const enrichedMeds: any[] = [];
    const sources: string[] = ["Base PrescrIA (données structurées)"];

    for (let i = 0; i < dbMeds.length; i++) {
      const med = dbMeds[i];
      if (med.matched) {
        enrichedMeds.push(med);
        continue;
      }

      // Query public APIs for this medication
      const searchName = medMolecules[i] || medNames[i];
      console.log(`Querying public APIs for: ${searchName}`);

      // Parallel API calls to RxNav and OpenFDA
      const [atcData, fdaData] = await Promise.all([
        rxnavGetATC(searchName),
        openFDAGetDrugInfo(searchName),
      ]);

      if (atcData) {
        if (!sources.includes("RxNav/NIH (classification ATC)")) sources.push("RxNav/NIH (classification ATC)");
      }
      if (fdaData) {
        if (!sources.includes("OpenFDA (données médicament)")) sources.push("OpenFDA (données médicament)");
      }

      // Build public data context for AI enrichment
      const publicData: any = {};
      if (atcData) {
        publicData.atc = { code: atcData.classId, className: atcData.className };
      }
      if (fdaData) {
        publicData.openfda = {
          indications: fdaData.indications?.substring(0, 500),
          warnings: fdaData.warnings?.substring(0, 300),
          drug_interactions: fdaData.drugInteractions?.substring(0, 300),
          adverse_reactions: fdaData.adverseReactions?.substring(0, 300),
          pharmacological_class: fdaData.pharmacoClass,
        };
      }

      // Use AI to structure the public data into our format
      const prompt = ENRICHMENT_PROMPT.replace("{PUBLIC_DATA}", JSON.stringify(publicData, null, 2));
      try {
        const aiData = await callAI(LOVABLE_API_KEY, [
          { role: "system", content: prompt },
          { role: "user", content: `Médicament : ${medNames[i]}${medMolecules[i] ? ` (DCI probable: ${medMolecules[i]})` : ""}` },
        ]);

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
          public_data: publicData,
        });
      } catch (e) {
        console.error("AI enrichment failed:", e);
        enrichedMeds.push(med);
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
                  source: "Base PrescrIA",
                });
              }
            }
          }
        }
      } else if (med.ai_enriched) {
        if (med.ai_contexts) {
          for (const ctx of med.ai_contexts) allContexts.push(ctx.description);
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
              source: med.public_data?.openfda ? "OpenFDA + RxNav" : "IA",
            });
          }
        }
      }
    }

    // Step 5: Check interactions (local DB + OpenFDA adverse events)
    const matchedMeds = enrichedMeds.filter((m) => m.matched || m.ai_enriched);
    const interactions = checkLocalInteractions(matchedMeds);

    // Also check OpenFDA for unreported interactions between pairs
    if (matchedMeds.length >= 2) {
      for (let i = 0; i < matchedMeds.length - 1; i++) {
        for (let j = i + 1; j < matchedMeds.length; j++) {
          const mol1 = matchedMeds[i].molecule_active;
          const mol2 = matchedMeds[j].molecule_active;
          if (mol1 && mol2) {
            const alreadyFound = interactions.some((inter: any) =>
              inter.medicaments.includes(matchedMeds[i].nom_commercial) &&
              inter.medicaments.includes(matchedMeds[j].nom_commercial)
            );
            if (!alreadyFound) {
              const fdaInteraction = await openFDAGetInteractions(mol1, mol2);
              if (fdaInteraction) {
                interactions.push({
                  medicaments: [matchedMeds[i].nom_commercial, matchedMeds[j].nom_commercial],
                  niveau: "modérée",
                  description: `${fdaInteraction} (source: OpenFDA)`,
                });
                if (!sources.includes("OpenFDA (effets indésirables)")) sources.push("OpenFDA (effets indésirables)");
              }
            }
          }
        }
      }
    }

    // Step 6: Deduplicate and limit questions (max 4)
    const uniqueQuestions = allQuestions
      .filter((q, i, arr) => arr.findIndex((x) => x.question === q.question) === i)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 4);

    // Step 7: Build result
    const result = {
      medicaments: enrichedMeds.map((m) => ({
        nom: m.nom_commercial,
        classe: m.therapeutic_classes?.nom || "Non classifié",
        molecule: m.molecule_active || null,
        code_atc: m.code_atc || null,
      })),
      interactions,
      contextes: [...new Set(allContexts)].slice(0, 5),
      questions: uniqueQuestions.map((q) => ({
        question: q.question,
        contexte: q.contexte,
        otcSuggestions: q.otcSuggestions,
        source: q.source,
      })),
      conseil: "N'hésitez pas à me poser des questions sur votre traitement, je suis là pour vous accompagner.",
      structuredData: hasStructuredData,
      sources,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-prescription error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    if (msg === "RATE_LIMIT") return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (msg === "CREDITS_EXHAUSTED") return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
