import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== PUBLIC API INTEGRATIONS ======

async function rxnavGetATC(drugName: string): Promise<{ classId: string; className: string } | null> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json?drugName=${encodeURIComponent(drugName)}&relaSource=ATC`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const infos = data?.rxclassDrugInfoList?.rxclassDrugInfo;
    if (!infos || infos.length === 0) return null;
    const atc = infos.find((i: any) => i.rxclassMinConceptItem?.classType === "ATC1-4");
    if (atc) return { classId: atc.rxclassMinConceptItem.classId, className: atc.rxclassMinConceptItem.className };
    return { classId: infos[0].rxclassMinConceptItem.classId, className: infos[0].rxclassMinConceptItem.className };
  } catch (e) {
    console.error("RxNav ATC lookup failed:", e);
    return null;
  }
}

async function openFDAGetDrugInfo(drugName: string): Promise<{
  indications: string;
  warnings: string;
  drugInteractions: string;
  adverseReactions: string;
  pharmacoClass: string[];
} | null> {
  try {
    let url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
    let res = await fetch(url);
    let data = await res.json();
    if (!data.results || data.results.length === 0) {
      url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=1`;
      res = await fetch(url);
      data = await res.json();
    }
    if (!data.results || data.results.length === 0) {
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
Tu dois extraire les médicaments ET le nom du patient d'une ordonnance et les retourner en JSON.

ATTENTION : Les ordonnances peuvent être MANUSCRITES (écriture de médecin, parfois difficile à lire).
- Utilise le contexte médical pour deviner les noms de médicaments même si l'écriture est peu lisible
- Les dosages courants (500mg, 1g, 20mg, etc.) aident à confirmer le médicament
- Les formes galéniques (cp, gél, sachet, etc.) sont des indices supplémentaires
- En cas de doute, propose le médicament le plus probable avec une note

## FORMAT JSON STRICT
{
  "patient_nom": "Nom et prénom du patient tels qu'écrits sur l'ordonnance, ou null si non trouvé",
  "medicaments_detectes": [
    {"nom_commercial": "nom tel qu'écrit ou interprété", "molecule_probable": "DCI si connue, sinon null", "confiance": "haute|moyenne|basse"}
  ]
}

RÈGLES :
- Extrais le nom du patient s'il est visible sur l'ordonnance
- Extrais TOUS les noms de médicaments (commerciaux ou DCI)
- Si tu reconnais la DCI, indique-la
- Indique le niveau de confiance de lecture (haute si clair, basse si écriture illisible)
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
      "question": "question FERMÉE (réponse Oui ou Non uniquement). Ex: 'Ressentez-vous des douleurs ?' JAMAIS de question ouverte",
      "contexte_explication": "ce que cette question aide à identifier",
      "besoin": "besoin patient si oui",
      "otc": [{"categorie": "catégorie produit OTC", "description": "description", "priorite": "haute|moyenne"}]
    }
  ]
}

RÈGLES :
- JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
- Langage probabiliste : "souvent associé à", "peut accompagner"
- Les questions doivent couvrir des AXES DIFFÉRENTS
- Maximum 4 questions
- TOUTES les questions DOIVENT être FERMÉES (réponse Oui ou Non UNIQUEMENT)
- Baser les indications et effets secondaires SUR LES DONNÉES PUBLIQUES fournies`;

const REFINE_PROMPT = `Tu es PrescrIA, un copilote pour préparateurs en pharmacie. Le préparateur a analysé une ordonnance et posé des questions au patient.

## DONNÉES STRUCTURÉES FOURNIES
On te fournit les données pharmacologiques structurées issues de bases publiques (ANSM, ATC/WHO, OpenFDA) et de la base clinique PrescrIA.
On te fournit aussi les PRODUITS COMPLÉMENTAIRES issus de la base de données, CLASSÉS PAR PRIORITÉ. Tu DOIS les utiliser en priorité.

## TA MISSION
En fonction des réponses Oui/Non du patient :
1. ÉLIMINE les contextes contredits par les réponses "Non"
2. PRIORISE les suggestions liées aux réponses "Oui"
3. UTILISE EN PRIORITÉ les produits complémentaires de la base PrescrIA fournis ci-dessous
4. Si tout = "Non", propose des recommandations générales de confort
5. Maximum 4 suggestions, minimum 1

## RÈGLES ABSOLUES
1. JAMAIS de diagnostic, JAMAIS nommer une pathologie
2. Les recommandations DOIVENT correspondre aux réponses du patient
3. Recommande des CATÉGORIES de produits (pas de marques sauf si fourni par la base)
4. Le conseil doit être naturel, prêt à dire au patient
5. INCLUS les conseils associés de la base dans ta "phrase conseil"

## FORMAT JSON STRICT
{
  "suggestions": [
    {"categorie": "catégorie produit", "raison": "justification liée aux réponses", "icon": "emoji", "priorite": "haute|moyenne", "produits_db": ["nom produit 1", "nom produit 2"]}
  ],
  "conseil": "Phrase de conseil personnalisée intégrant les conseils de la base."
}`;

// ====== CLINICAL KNOWLEDGE BASE LOOKUP ======

async function clinicalLookup(supabase: any, medName: string, moleculeName?: string | null) {
  // Step 1: Find in medicaments table (new clinical KB)
  let medicament = null;
  let molecule = null;

  // Try exact match on nom_commercial
  const { data: exactMatch } = await supabase
    .from("medicaments")
    .select("*, molecules(*)")
    .ilike("nom_commercial", medName.trim())
    .limit(1)
    .maybeSingle();
  
  if (exactMatch) {
    medicament = exactMatch;
    molecule = exactMatch.molecules;
  }

  // Try partial match
  if (!medicament) {
    const { data: partialMatch } = await supabase
      .from("medicaments")
      .select("*, molecules(*)")
      .ilike("nom_commercial", `%${medName.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (partialMatch) {
      medicament = partialMatch;
      molecule = partialMatch.molecules;
    }
  }

  // Try molecule name directly
  if (!molecule && moleculeName) {
    const { data: molMatch } = await supabase
      .from("molecules")
      .select("*")
      .ilike("nom_molecule", `%${moleculeName.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (molMatch) molecule = molMatch;
  }

  // Try medName as molecule
  if (!molecule && !medicament) {
    const { data: molMatch } = await supabase
      .from("molecules")
      .select("*")
      .ilike("nom_molecule", `%${medName.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (molMatch) molecule = molMatch;
  }

  if (!medicament && !molecule) return null;

  const atcCode = medicament?.atc_code || molecule?.atc_code;

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

  // Step 3: Get pathologies via molecule_pathologie
  let pathologies: any[] = [];
  const moleculeId = molecule?.id;
  if (moleculeId) {
    const { data } = await supabase
      .from("molecule_pathologie")
      .select("pathologie_id, pathologies(*)")
      .eq("molecule_id", moleculeId);
    pathologies = (data || []).map((mp: any) => mp.pathologies).filter(Boolean);
  }

  // Step 4: Get conseils and produits for all pathologies
  const pathologieIds = pathologies.map((p: any) => p.id);
  let conseils: any[] = [];
  let produits: any[] = [];

  if (pathologieIds.length > 0) {
    const [conseilsRes, produitsRes] = await Promise.all([
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
    conseils = conseilsRes.data || [];
    produits = produitsRes.data || [];
  }

  return {
    found: true,
    medicament: medicament ? {
      nom_commercial: medicament.nom_commercial,
      cip_code: medicament.cip_code,
      laboratoire: medicament.laboratoire,
      forme_galenique: medicament.forme_galenique,
      dosage: medicament.dosage,
    } : null,
    molecule: molecule ? {
      id: molecule.id,
      nom: molecule.nom_molecule,
      atc_code: molecule.atc_code,
      classe_therapeutique: molecule.classe_therapeutique,
    } : null,
    classe_atc: classeAtc ? {
      code: classeAtc.atc_code,
      nom: classeAtc.nom_classe,
      description: classeAtc.description,
    } : null,
    pathologies,
    conseils,
    produits,
  };
}

// ====== OLD DB HELPERS (legacy medications table fallback) ======

async function findMedicationsInDB(supabase: any, names: string[]) {
  const results: any[] = [];
  for (const name of names) {
    const n = name.trim().toLowerCase();
    let { data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("nom_commercial", n).limit(1);
    if (data?.length > 0) { results.push({ ...data[0], matched: true }); continue; }
    ({ data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("molecule_active", `%${n}%`).limit(1));
    if (data?.length > 0) { results.push({ ...data[0], matched: true }); continue; }
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

// ====== INTERACTION CHECK ======

const KNOWN_INTERACTIONS = [
  { classes: ["Anti-inflammatoires non stéroïdiens", "Anticoagulants oraux directs"], niveau: "majeure", desc: "Risque hémorragique accru (source: ANSM/HAS)" },
  { classes: ["Anti-inflammatoires non stéroïdiens", "Inhibiteurs de l'enzyme de conversion"], niveau: "modérée", desc: "Risque d'insuffisance rénale, surtout avec diurétiques (source: ANSM)" },
  { classes: ["Antibiotiques - Macrolides", "Statines"], niveau: "modérée", desc: "Risque accru de rhabdomyolyse (source: ANSM)" },
  { classes: ["ISRS", "Antalgiques opioïdes faibles"], niveau: "modérée", desc: "Risque de syndrome sérotoninergique (source: ANSM)" },
  { classes: ["Corticoïdes systémiques", "Anti-inflammatoires non stéroïdiens"], niveau: "modérée", desc: "Risque accru d'ulcère gastroduodénal (source: HAS)" },
  { classes: ["Anti-inflammatoires non stéroïdiens", "Biguanides"], niveau: "modérée", desc: "Risque d'insuffisance rénale aiguë (source: ANSM)" },
  { classes: ["AVK", "Anti-inflammatoires non stéroïdiens"], niveau: "majeure", desc: "Risque hémorragique majeur (source: ANSM)" },
  { classes: ["AVK", "Antibiotiques - Macrolides"], niveau: "modérée", desc: "Potentialisation de l'effet anticoagulant (source: ANSM)" },
  { classes: ["Inhibiteurs de la pompe à protons", "Antiagrégants plaquettaires"], niveau: "modérée", desc: "Réduction de l'efficacité du clopidogrel (source: ANSM)" },
  { classes: ["Bêta-bloquants", "Inhibiteurs calciques"], niveau: "modérée", desc: "Risque de bradycardie et hypotension (source: ANSM)" },
  { classes: ["ISRS", "AINS"], niveau: "modérée", desc: "Risque hémorragique digestif accru (source: ANSM)" },
  { classes: ["Statines", "Fibrates"], niveau: "majeure", desc: "Risque accru de rhabdomyolyse (source: ANSM)" },
];

function checkLocalInteractions(medications: any[]): any[] {
  const found: any[] = [];
  const classes = medications.map((m: any) => m.classe_therapeutique || m.therapeutic_classes?.nom || "").filter(Boolean);
  for (const inter of KNOWN_INTERACTIONS) {
    const m0 = classes.some((c: string) => c.includes(inter.classes[0]) || inter.classes[0].includes(c));
    const m1 = classes.some((c: string) => c.includes(inter.classes[1]) || inter.classes[1].includes(c));
    if (m0 && m1) {
      const med0 = medications.find((m: any) => {
        const cl = m.classe_therapeutique || m.therapeutic_classes?.nom || "";
        return cl.includes(inter.classes[0]) || inter.classes[0].includes(cl);
      });
      const med1 = medications.find((m: any) => {
        const cl = m.classe_therapeutique || m.therapeutic_classes?.nom || "";
        return cl.includes(inter.classes[1]) || inter.classes[1].includes(cl);
      });
      found.push({
        medicaments: [med0?.nom_commercial || med0?.nom || inter.classes[0], med1?.nom_commercial || med1?.nom || inter.classes[1]],
        niveau: inter.niveau, description: inter.desc,
      });
    }
  }
  return found;
}

// ====== AI HELPERS ======

// Use the BEST model for OCR (handwritten prescriptions)
const OCR_MODEL = "google/gemini-2.5-pro";
// Use fast model for text processing
const TEXT_MODEL = "google/gemini-2.5-flash";

async function callAI(apiKey: string, messages: any[], temperature = 0.1, model = TEXT_MODEL) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
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

// ====== LGO STOCK LOOKUP ======

interface LGOProduct {
  nom: string;
  cip: string;
  prix: number;
  stock: number;
  categorie?: string;
}

async function lookupLGOStock(supabase: any, pharmacyId: string, categories: string[]): Promise<LGOProduct[]> {
  if (!pharmacyId || categories.length === 0) return [];
  const { data: lgoConfig } = await supabase
    .from("pharmacy_lgo_config").select("*")
    .eq("pharmacy_id", pharmacyId).eq("enabled", true).single();
  if (!lgoConfig) return [];
  try {
    const results: LGOProduct[] = [];
    for (const categorie of categories) {
      const searchUrl = `${lgoConfig.api_base_url}/stock/search`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (lgoConfig.auth_method === "api_key" && lgoConfig.api_key_encrypted) {
        headers["X-API-Key"] = lgoConfig.api_key_encrypted;
      } else if (lgoConfig.auth_method === "bearer" && lgoConfig.api_key_encrypted) {
        headers["Authorization"] = `Bearer ${lgoConfig.api_key_encrypted}`;
      }
      const res = await fetch(searchUrl, {
        method: "POST", headers,
        body: JSON.stringify({ query: categorie, in_stock: true, limit: 3 }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const products = (data.products || data.results || data || []).slice(0, 3).map((p: any) => ({
        nom: p.nom || p.name || p.designation,
        cip: p.cip || p.cip13 || p.code_cip || "",
        prix: p.prix || p.price || p.prix_ttc || 0,
        stock: p.stock || p.quantite || p.qty || 0,
        categorie,
      }));
      results.push(...products);
    }
    await supabase.from("pharmacy_lgo_config").update({ last_sync_at: new Date().toISOString() }).eq("id", lgoConfig.id);
    return results;
  } catch (e) {
    console.error("LGO stock lookup failed:", e);
    return [];
  }
}

async function getPharmacyIdFromAuth(supabase: any, authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data } = await adminSupabase.auth.getUser();
    if (!data?.user?.id) return null;
    const { data: profile } = await supabase.from("profiles").select("pharmacy_id").eq("id", data.user.id).single();
    return profile?.pharmacy_id || null;
  } catch {
    return null;
  }
}

// ====== MAIN HANDLER ======

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prescriptionText, imageBase64 } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============ ANALYSIS MODE (only mode now - no more questions/refine) ============

    // Step 1: Extract medication names and patient name
    let medEntries: { nom_commercial: string; molecule_probable?: string; confiance?: string }[] = [];
    let extractedPatientName: string | null = null;

    if (imageBase64) {
      console.log("Using OCR model (gemini-2.5-pro) for handwritten prescription analysis");
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extrais les noms de médicaments et le nom du patient de cette ordonnance. L'écriture peut être manuscrite et difficile à lire — utilise le contexte médical pour interpréter." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ]},
      ], 0.1, OCR_MODEL);
      medEntries = parsed.medicaments_detectes || [];
      extractedPatientName = parsed.patient_nom || null;
    } else if (prescriptionText) {
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extrais les médicaments et le nom du patient :\n\n${prescriptionText}` },
      ], 0.1, TEXT_MODEL);
      medEntries = parsed.medicaments_detectes || [];
      extractedPatientName = parsed.patient_nom || null;
    } else {
      return new Response(JSON.stringify({ error: "Aucune donnée d'ordonnance fournie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (medEntries.length === 0) {
      return new Response(JSON.stringify({
        medicaments: [], interactions: [], contextes: [], conseil: "", sources: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const medNames = medEntries.map((m: any) => typeof m === "string" ? m : m.nom_commercial);
    const medMolecules = medEntries.map((m: any) => typeof m === "string" ? null : m.molecule_probable);

    // Step 2: Clinical Knowledge Base lookup (primary source)
    const clinicalResults: any[] = [];
    const allPathologieIds: string[] = [];
    const allDbConseils: any[] = [];
    const allDbProduits: any[] = [];
    const sources: string[] = [];

    for (let i = 0; i < medNames.length; i++) {
      const clinical = await clinicalLookup(supabase, medNames[i], medMolecules[i]);
      if (clinical) {
        clinicalResults.push({ index: i, ...clinical });
        if (clinical.pathologies) {
          for (const p of clinical.pathologies) {
            if (!allPathologieIds.includes(p.id)) allPathologieIds.push(p.id);
          }
        }
        if (clinical.conseils) allDbConseils.push(...clinical.conseils);
        if (clinical.produits) allDbProduits.push(...clinical.produits);
        if (!sources.includes("Base clinique PrescrIA")) sources.push("Base clinique PrescrIA");
      }
    }

    // Step 3: Fallback to old medications table + public APIs for unmatched meds
    const dbMeds = await findMedicationsInDB(supabase, medNames);

    const enrichedMeds: any[] = [];

    for (let i = 0; i < medNames.length; i++) {
      const clinical = clinicalResults.find((c) => c.index === i);
      const dbMed = dbMeds[i];

      if (clinical?.found) {
        enrichedMeds.push({
          nom_commercial: clinical.medicament?.nom_commercial || medNames[i],
          molecule_active: clinical.molecule?.nom || null,
          code_atc: clinical.molecule?.atc_code || clinical.classe_atc?.code || null,
          classe_therapeutique: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || null,
          therapeutic_classes: { nom: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || "" },
          matched: true,
          clinical_kb: true,
          pathologies: clinical.pathologies || [],
        });
        continue;
      }

      if (dbMed?.matched) {
        enrichedMeds.push({ ...dbMed, clinical_kb: false });
        if (!sources.includes("Base PrescrIA (données structurées)")) sources.push("Base PrescrIA (données structurées)");
        continue;
      }

      const searchName = medMolecules[i] || medNames[i];
      console.log(`Querying public APIs for: ${searchName}`);

      const [atcData, fdaData] = await Promise.all([
        rxnavGetATC(searchName),
        openFDAGetDrugInfo(searchName),
      ]);

      if (atcData && !sources.includes("RxNav/NIH (classification ATC)")) sources.push("RxNav/NIH (classification ATC)");
      if (fdaData && !sources.includes("OpenFDA (données médicament)")) sources.push("OpenFDA (données médicament)");

      const publicData: any = {};
      if (atcData) publicData.atc = { code: atcData.classId, className: atcData.className };
      if (fdaData) {
        publicData.openfda = {
          indications: fdaData.indications?.substring(0, 500),
          warnings: fdaData.warnings?.substring(0, 300),
          drug_interactions: fdaData.drugInteractions?.substring(0, 300),
          adverse_reactions: fdaData.adverseReactions?.substring(0, 300),
          pharmacological_class: fdaData.pharmacoClass,
        };
      }

      const prompt = ENRICHMENT_PROMPT.replace("{PUBLIC_DATA}", JSON.stringify(publicData, null, 2));
      try {
        const aiData = await callAI(LOVABLE_API_KEY, [
          { role: "system", content: prompt },
          { role: "user", content: `Médicament : ${medNames[i]}${medMolecules[i] ? ` (DCI probable: ${medMolecules[i]})` : ""}` },
        ]);
        enrichedMeds.push({
          ...dbMed,
          molecule_active: aiData.molecule_active,
          code_atc: aiData.code_atc,
          classe_therapeutique: aiData.classe_therapeutique,
          therapeutic_classes: { nom: aiData.classe_therapeutique },
          matched: true,
          ai_enriched: true,
          ai_contexts: aiData.contextes_therapeutiques,
          public_data: publicData,
        });
      } catch (e) {
        console.error("AI enrichment failed:", e);
        enrichedMeds.push(dbMed);
      }
    }

    // Step 4: Build direct recommendations per medication (max 3 per med)
    const allContexts: string[] = [];
    let hasStructuredData = clinicalResults.length > 0;
    const medRecommendations: Map<number, any[]> = new Map();

    for (let i = 0; i < enrichedMeds.length; i++) {
      const med = enrichedMeds[i];
      const recs: any[] = [];

      if (med.clinical_kb) {
        hasStructuredData = true;
        const pathNames = (med.pathologies || []).map((p: any) => p.nom_pathologie);
        for (const pName of pathNames) {
          allContexts.push(`Traitement souvent associé à : ${pName}`);
        }
        const clinical = clinicalResults.find((c: any) => c.index === i);
        if (clinical?.produits) {
          const seen = new Set<string>();
          for (const p of clinical.produits) {
            if (seen.has(p.produit)) continue;
            seen.add(p.produit);
            recs.push({
              produit: p.produit,
              categorie: p.categorie || "Complément",
              description: p.description || "",
              priorite: p.priorite || 50,
              pathologie: p.pathologies?.nom_pathologie || "",
            });
            if (recs.length >= 3) break;
          }
        }
      } else if (med.matched && !med.clinical_kb && !med.ai_enriched) {
        const therapeuticData = await getTherapeuticData(supabase, med);
        if (therapeuticData) {
          hasStructuredData = true;
          for (const ctx of therapeuticData) {
            allContexts.push(ctx.description);
          }
        }
      } else if (med.ai_enriched) {
        if (med.ai_contexts) {
          for (const ctx of med.ai_contexts) allContexts.push(ctx.description);
        }
      }

      // Fallback: find from allDbProduits
      if (recs.length === 0 && med.pathologies?.length > 0) {
        const pathIds = med.pathologies.map((p: any) => p.id);
        const seen = new Set<string>();
        for (const p of allDbProduits) {
          if (pathIds.includes(p.pathologie_id) && !seen.has(p.produit)) {
            seen.add(p.produit);
            recs.push({
              produit: p.produit,
              categorie: p.categorie || "Complément",
              description: p.description || "",
              priorite: p.priorite || 50,
              pathologie: p.pathologies?.nom_pathologie || "",
            });
            if (recs.length >= 3) break;
          }
        }
      }

      medRecommendations.set(i, recs);
    }

    // Step 5: Check interactions
    const matchedMeds = enrichedMeds.filter((m: any) => m.matched || m.ai_enriched);
    const interactions = checkLocalInteractions(matchedMeds);

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

    // Step 6: Build conseil from DB
    let conseilText = "N'hésitez pas à me poser des questions sur votre traitement, je suis là pour vous accompagner.";
    if (allDbConseils.length > 0) {
      const topConseils = allDbConseils
        .filter((c: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.conseil === c.conseil) === idx)
        .sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0))
        .slice(0, 2);
      conseilText = topConseils.map((c: any) => c.conseil + (c.description ? ` (${c.description})` : "")).join(". ") + ". " + conseilText;
    }

    // Step 7: Build result
    const totalRecs = [...medRecommendations.values()].reduce((sum, r) => sum + r.length, 0);
    const result: any = {
      medicaments: enrichedMeds.map((m: any, i: number) => ({
        nom: m.nom_commercial,
        classe: m.classe_therapeutique || m.therapeutic_classes?.nom || "Non classifié",
        molecule: m.molecule_active || null,
        code_atc: m.code_atc || null,
        recommendations: medRecommendations.get(i) || [],
      })),
      interactions,
      contextes: [...new Set(allContexts)].slice(0, 5),
      conseil: conseilText,
      structuredData: hasStructuredData,
      sources,
      patient_name: extractedPatientName,
    };

    // Step 8: Save to analysis_history
    try {
      const authHeader = req.headers.get("authorization");
      const pharmacyId = await getPharmacyIdFromAuth(supabase, authHeader);
      
      if (pharmacyId && authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.sub;

        const inputText = prescriptionText || medNames.join(",");
        const encoder = new TextEncoder();
        const prescriptionHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(inputText));
        const prescriptionHash = Array.from(new Uint8Array(prescriptionHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        
        const patientName = extractedPatientName || null;
        const patientSig = patientName ? patientName.trim().toLowerCase().replace(/\s+/g, " ") : medNames.sort().join("|").toLowerCase();
        const patientHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(patientSig));
        const patientHash = Array.from(new Uint8Array(patientHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const hasMajor = interactions.some((inter: any) => inter.niveau === "majeure");

        await supabase.from("analysis_history").insert({
          pharmacy_id: pharmacyId,
          user_id: userId,
          patient_hash: patientHash,
          patient_name: patientName,
          prescription_hash: prescriptionHash,
          medicaments: result.medicaments,
          interactions_count: interactions.length,
          suggestions_count: totalRecs,
          has_major_interaction: hasMajor,
          metadata: { sources, contextes_count: allContexts.length, clinical_kb_matches: clinicalResults.length },
        });

        const { data: duplicates } = await supabase
          .from("analysis_history").select("id, created_at")
          .eq("pharmacy_id", pharmacyId).eq("prescription_hash", prescriptionHash)
          .neq("id", "placeholder")
          .order("created_at", { ascending: false }).limit(5);

        if (duplicates && duplicates.length > 1) {
          result.duplicate_warning = { count: duplicates.length, last_seen: duplicates[1]?.created_at };
        }

        const { data: patientHistory } = await supabase
          .from("analysis_history").select("id, created_at, medicaments")
          .eq("pharmacy_id", pharmacyId).eq("patient_hash", patientHash)
          .order("created_at", { ascending: false }).limit(10);

        if (patientHistory && patientHistory.length > 1) {
          result.patient_history = {
            previous_analyses: patientHistory.length - 1,
            first_seen: patientHistory[patientHistory.length - 1]?.created_at,
          };
        }
      }
    } catch (historyErr) {
      console.error("Failed to save analysis history:", historyErr);
    }

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

      // ====== NEW: Pull produits_complementaires from DB based on clinical data ======
      let dbProduits: any[] = [];
      let dbConseils: any[] = [];

      // Get pathologie IDs from the clinical data passed in context
      const clinicalPathologieIds: string[] = analysisContext.clinicalPathologieIds || [];
      
      if (clinicalPathologieIds.length > 0) {
        const [produitsRes, conseilsRes] = await Promise.all([
          supabase
            .from("produits_complementaires")
            .select("*, pathologies(nom_pathologie)")
            .in("pathologie_id", clinicalPathologieIds)
            .order("priorite", { ascending: false })
            .limit(20),
          supabase
            .from("conseils_associes")
            .select("*, pathologies(nom_pathologie)")
            .in("pathologie_id", clinicalPathologieIds)
            .order("priorite", { ascending: false })
            .limit(10),
        ]);
        dbProduits = produitsRes.data || [];
        dbConseils = conseilsRes.data || [];
      }

      // Also try clinical lookup for each medicament to get cross-referenced products
      if (dbProduits.length === 0 && analysisContext.medicaments?.length > 0) {
        for (const med of analysisContext.medicaments) {
          const clinical = await clinicalLookup(supabase, med.nom, med.molecule);
          if (clinical?.produits) {
            dbProduits.push(...clinical.produits);
          }
          if (clinical?.conseils) {
            dbConseils.push(...clinical.conseils);
          }
        }
      }

      // Deduplicate produits by name
      const seenProduits = new Set<string>();
      dbProduits = dbProduits.filter((p: any) => {
        const key = p.produit;
        if (seenProduits.has(key)) return false;
        seenProduits.add(key);
        return true;
      });

      const produitsSection = dbProduits.length > 0
        ? `\n\nPRODUITS COMPLÉMENTAIRES DE LA BASE PrescrIA (À UTILISER EN PRIORITÉ) :\n${dbProduits.map((p: any) => `- ${p.produit} (${p.categorie || 'Complément'}) : ${p.description || ''} [priorité: ${p.priorite}] [pathologie: ${p.pathologies?.nom_pathologie || ''}]`).join("\n")}`
        : "";

      const conseilsSection = dbConseils.length > 0
        ? `\n\nCONSEILS CLINIQUES DE LA BASE PrescrIA (À INTÉGRER DANS LA PHRASE CONSEIL) :\n${dbConseils.map((c: any) => `- ${c.conseil}: ${c.description || ''} [pathologie: ${c.pathologies?.nom_pathologie || ''}]`).join("\n")}`
        : "";

      const result = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: REFINE_PROMPT },
        { role: "user", content: `Ordonnance analysée :
Médicaments : ${analysisContext.medicaments.map((m: any) => `${m.nom} (${m.classe}${m.molecule ? ', DCI: ' + m.molecule : ''})`).join(", ")}
Contextes thérapeutiques : ${(analysisContext.contextes || []).join(", ")}
Sources : Base PrescrIA (ANSM/ATC), OpenFDA, RxNav
${produitsSection}
${conseilsSection}

Réponses du patient :
${answersText}

${relevantOTC.length > 0 ? `Suggestions OTC de la base structurée :\n${relevantOTC.map((o: any) => `- ${o.categorie_produit || o.categorie}: ${o.description || o.desc}`).join("\n")}` : ""}

${eliminatedContexts.length > 0 ? `Contextes ÉLIMINÉS par les "Non" :\n${eliminatedContexts.join("\n")}` : ""}

IMPORTANT: Utilise les produits complémentaires de la base PrescrIA ci-dessus pour tes suggestions. Cite les noms exacts des produits dans le champ "produits_db".` },
      ]);

      if (result.suggestions) result.suggestions = result.suggestions.slice(0, 4);

      // Enrich suggestions with LGO stock data
      const authHeader = req.headers.get("authorization");
      const pharmacyId = await getPharmacyIdFromAuth(supabase, authHeader);
      
      if (pharmacyId && result.suggestions?.length > 0) {
        const categories = result.suggestions.map((s: any) => s.categorie);
        const lgoProducts = await lookupLGOStock(supabase, pharmacyId, categories);
        if (lgoProducts.length > 0) {
          for (const sug of result.suggestions) {
            sug.produits_lgo = lgoProducts.filter((p: any) => p.categorie === sug.categorie);
          }
          result.lgo_enriched = true;
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ANALYSIS MODE ============

    // Step 1: Extract medication names and patient name
    // Use gemini-2.5-pro for IMAGE OCR (best for handwritten prescriptions)
    // Use gemini-2.5-flash for text extraction (faster, cheaper)
    let medEntries: { nom_commercial: string; molecule_probable?: string; confiance?: string }[] = [];
    let extractedPatientName: string | null = null;

    if (imageBase64) {
      console.log("Using OCR model (gemini-2.5-pro) for handwritten prescription analysis");
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extrais les noms de médicaments et le nom du patient de cette ordonnance. L'écriture peut être manuscrite et difficile à lire — utilise le contexte médical pour interpréter." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ]},
      ], 0.1, OCR_MODEL);
      medEntries = parsed.medicaments_detectes || [];
      extractedPatientName = parsed.patient_nom || null;
    } else if (prescriptionText) {
      const parsed = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extrais les médicaments et le nom du patient :\n\n${prescriptionText}` },
      ], 0.1, TEXT_MODEL);
      medEntries = parsed.medicaments_detectes || [];
      extractedPatientName = parsed.patient_nom || null;
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

    // Step 2: Clinical Knowledge Base lookup (NEW — primary source)
    const clinicalResults: any[] = [];
    const allPathologieIds: string[] = [];
    const allDbConseils: any[] = [];
    const allDbProduits: any[] = [];
    const sources: string[] = [];

    for (let i = 0; i < medNames.length; i++) {
      const clinical = await clinicalLookup(supabase, medNames[i], medMolecules[i]);
      if (clinical) {
        clinicalResults.push({ index: i, ...clinical });
        if (clinical.pathologies) {
          for (const p of clinical.pathologies) {
            if (!allPathologieIds.includes(p.id)) allPathologieIds.push(p.id);
          }
        }
        if (clinical.conseils) allDbConseils.push(...clinical.conseils);
        if (clinical.produits) allDbProduits.push(...clinical.produits);
        if (!sources.includes("Base clinique PrescrIA")) sources.push("Base clinique PrescrIA");
      }
    }

    // Step 3: Fallback to old medications table + public APIs for unmatched meds
    const dbMeds = await findMedicationsInDB(supabase, medNames);

    const enrichedMeds: any[] = [];

    for (let i = 0; i < medNames.length; i++) {
      const clinical = clinicalResults.find((c) => c.index === i);
      const dbMed = dbMeds[i];

      // Priority 1: Clinical KB found
      if (clinical?.found) {
        enrichedMeds.push({
          nom_commercial: clinical.medicament?.nom_commercial || medNames[i],
          molecule_active: clinical.molecule?.nom || null,
          code_atc: clinical.molecule?.atc_code || clinical.classe_atc?.code || null,
          classe_therapeutique: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || null,
          therapeutic_classes: { nom: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || "" },
          matched: true,
          clinical_kb: true,
          pathologies: clinical.pathologies || [],
        });
        continue;
      }

      // Priority 2: Old medications table
      if (dbMed?.matched) {
        enrichedMeds.push({ ...dbMed, clinical_kb: false });
        if (!sources.includes("Base PrescrIA (données structurées)")) sources.push("Base PrescrIA (données structurées)");
        continue;
      }

      // Priority 3: Public APIs + AI enrichment
      const searchName = medMolecules[i] || medNames[i];
      console.log(`Querying public APIs for: ${searchName}`);

      const [atcData, fdaData] = await Promise.all([
        rxnavGetATC(searchName),
        openFDAGetDrugInfo(searchName),
      ]);

      if (atcData && !sources.includes("RxNav/NIH (classification ATC)")) sources.push("RxNav/NIH (classification ATC)");
      if (fdaData && !sources.includes("OpenFDA (données médicament)")) sources.push("OpenFDA (données médicament)");

      const publicData: any = {};
      if (atcData) publicData.atc = { code: atcData.classId, className: atcData.className };
      if (fdaData) {
        publicData.openfda = {
          indications: fdaData.indications?.substring(0, 500),
          warnings: fdaData.warnings?.substring(0, 300),
          drug_interactions: fdaData.drugInteractions?.substring(0, 300),
          adverse_reactions: fdaData.adverseReactions?.substring(0, 300),
          pharmacological_class: fdaData.pharmacoClass,
        };
      }

      const prompt = ENRICHMENT_PROMPT.replace("{PUBLIC_DATA}", JSON.stringify(publicData, null, 2));
      try {
        const aiData = await callAI(LOVABLE_API_KEY, [
          { role: "system", content: prompt },
          { role: "user", content: `Médicament : ${medNames[i]}${medMolecules[i] ? ` (DCI probable: ${medMolecules[i]})` : ""}` },
        ]);
        enrichedMeds.push({
          ...dbMed,
          molecule_active: aiData.molecule_active,
          code_atc: aiData.code_atc,
          classe_therapeutique: aiData.classe_therapeutique,
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
        enrichedMeds.push(dbMed);
      }
    }

    // Step 4: Build direct recommendations per medication (no questions)
    const allContexts: string[] = [];
    let hasStructuredData = clinicalResults.length > 0;
    const medRecommendations: Map<number, any[]> = new Map();

    for (let i = 0; i < enrichedMeds.length; i++) {
      const med = enrichedMeds[i];
      const recs: any[] = [];

      if (med.clinical_kb) {
        hasStructuredData = true;
        const pathNames = (med.pathologies || []).map((p: any) => p.nom_pathologie);
        for (const pName of pathNames) {
          allContexts.push(`Traitement souvent associé à : ${pName}`);
        }
        const clinical = clinicalResults.find((c: any) => c.index === i);
        if (clinical?.produits) {
          const seen = new Set<string>();
          for (const p of clinical.produits) {
            if (seen.has(p.produit)) continue;
            seen.add(p.produit);
            recs.push({
              produit: p.produit,
              categorie: p.categorie || "Complément",
              description: p.description || "",
              priorite: p.priorite || 50,
              pathologie: p.pathologies?.nom_pathologie || "",
            });
            if (recs.length >= 3) break;
          }
        }
      } else if (med.matched && !med.clinical_kb) {
        const therapeuticData = await getTherapeuticData(supabase, med);
        if (therapeuticData) {
          hasStructuredData = true;
          for (const ctx of therapeuticData) {
            allContexts.push(ctx.description);
          }
        }
      } else if (med.ai_enriched) {
        if (med.ai_contexts) {
          for (const ctx of med.ai_contexts) allContexts.push(ctx.description);
        }
      }

      if (recs.length === 0 && med.pathologies?.length > 0) {
        const pathIds = med.pathologies.map((p: any) => p.id);
        const seen = new Set<string>();
        for (const p of allDbProduits) {
          if (pathIds.includes(p.pathologie_id) && !seen.has(p.produit)) {
            seen.add(p.produit);
            recs.push({
              produit: p.produit,
              categorie: p.categorie || "Complément",
              description: p.description || "",
              priorite: p.priorite || 50,
              pathologie: p.pathologies?.nom_pathologie || "",
            });
            if (recs.length >= 3) break;
          }
        }
      }

      medRecommendations.set(i, recs);
    }

    // Step 5: Check interactions
    const matchedMeds = enrichedMeds.filter((m: any) => m.matched || m.ai_enriched);
    const interactions = checkLocalInteractions(matchedMeds);

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

    // Step 6: Build conseil from DB conseils
    let conseilText = "N'hésitez pas à me poser des questions sur votre traitement, je suis là pour vous accompagner.";
    if (allDbConseils.length > 0) {
      const topConseils = allDbConseils
        .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.conseil === c.conseil) === i)
        .sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0))
        .slice(0, 2);
      conseilText = topConseils.map((c: any) => c.conseil + (c.description ? ` (${c.description})` : "")).join(". ") + ". " + conseilText;
    }

    // Step 7: Build result with recommendations per medication
    const result: any = {
      medicaments: enrichedMeds.map((m: any, i: number) => ({
        nom: m.nom_commercial,
        classe: m.classe_therapeutique || m.therapeutic_classes?.nom || "Non classifié",
        molecule: m.molecule_active || null,
        code_atc: m.code_atc || null,
        recommendations: medRecommendations.get(i) || [],
      })),
      interactions,
      contextes: [...new Set(allContexts)].slice(0, 5),
      conseil: conseilText,
      structuredData: hasStructuredData,
      sources,
      patient_name: extractedPatientName,
    };


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

    // Step 4b: Generate smart questions from clinical KB produits if we lack questions
    if (allQuestions.length < 4 && allDbProduits.length > 0) {
      // Group produits by categorie to generate targeted questions
      const categorieGroups = new Map<string, any[]>();
      for (const p of allDbProduits) {
        const cat = p.categorie || "Complément";
        if (!categorieGroups.has(cat)) categorieGroups.set(cat, []);
        categorieGroups.get(cat)!.push(p);
      }

      const questionTemplates = [
        { keyword: "Probiotique", question: "Ressentez-vous des troubles digestifs (ballonnements, transit perturbé) ?", contexte: "Évaluation du confort digestif sous traitement" },
        { keyword: "Vitamine", question: "Ressentez-vous une fatigue inhabituelle ces dernières semaines ?", contexte: "Évaluation d'une carence potentielle en vitamines ou minéraux" },
        { keyword: "Phytothérapie", question: "Avez-vous des difficultés d'endormissement ou un sommeil perturbé ?", contexte: "Évaluation du stress et du sommeil" },
        { keyword: "Complément", question: "Ressentez-vous des douleurs articulaires ou musculaires ?", contexte: "Évaluation du confort articulaire et musculaire" },
        { keyword: "Topique", question: "Avez-vous des problèmes de peau (sécheresse, irritations) ?", contexte: "Évaluation du confort cutané" },
        { keyword: "Hygiène", question: "Avez-vous des problèmes bucco-dentaires (gencives sensibles, aphtes) ?", contexte: "Évaluation de l'hygiène buccale" },
      ];

      for (const tmpl of questionTemplates) {
        if (allQuestions.length >= 4) break;
        const matchingCat = [...categorieGroups.keys()].find(k => k.includes(tmpl.keyword) || tmpl.keyword.includes(k));
        if (matchingCat) {
          const prods = categorieGroups.get(matchingCat)!;
          const alreadyAsked = allQuestions.some(q => q.question === tmpl.question);
          if (!alreadyAsked) {
            allQuestions.push({
              question: tmpl.question,
              contexte: tmpl.contexte,
              score: 60,
              otcSuggestions: prods.slice(0, 3).map((p: any) => ({
                categorie_produit: p.categorie || p.produit,
                description: p.description || p.produit,
                icon: "💊",
                priorite: p.priorite > 80 ? "haute" : "moyenne",
              })),
              source: "Base clinique PrescrIA",
            });
          }
        }
      }
    }

    // Step 5: Check interactions (local DB + OpenFDA adverse events)
    const matchedMeds = enrichedMeds.filter((m) => m.matched || m.ai_enriched);
    const interactions = checkLocalInteractions(matchedMeds);

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
    const result: any = {
      medicaments: enrichedMeds.map((m) => ({
        nom: m.nom_commercial,
        classe: m.classe_therapeutique || m.therapeutic_classes?.nom || "Non classifié",
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
      patient_name: extractedPatientName,
      // Pass pathologie IDs to refine mode for cross-referenced product lookup
      clinicalPathologieIds: allPathologieIds,
    };

    // Step 8: Save to analysis_history
    try {
      const authHeader = req.headers.get("authorization");
      const pharmacyId = await getPharmacyIdFromAuth(supabase, authHeader);
      
      if (pharmacyId && authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.sub;

        const inputText = prescriptionText || medNames.join(",");
        const encoder = new TextEncoder();
        const prescriptionHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(inputText));
        const prescriptionHash = Array.from(new Uint8Array(prescriptionHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        
        const patientName = extractedPatientName || null;
        const patientSig = patientName ? patientName.trim().toLowerCase().replace(/\s+/g, " ") : medNames.sort().join("|").toLowerCase();
        const patientHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(patientSig));
        const patientHash = Array.from(new Uint8Array(patientHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const hasMajor = interactions.some((i: any) => i.niveau === "majeure");

        await supabase.from("analysis_history").insert({
          pharmacy_id: pharmacyId,
          user_id: userId,
          patient_hash: patientHash,
          patient_name: patientName,
          prescription_hash: prescriptionHash,
          medicaments: result.medicaments,
          interactions_count: interactions.length,
          suggestions_count: uniqueQuestions.length,
          has_major_interaction: hasMajor,
          metadata: { sources, contextes_count: allContexts.length, clinical_kb_matches: clinicalResults.length },
        });

        const { data: duplicates } = await supabase
          .from("analysis_history").select("id, created_at")
          .eq("pharmacy_id", pharmacyId).eq("prescription_hash", prescriptionHash)
          .neq("id", "placeholder")
          .order("created_at", { ascending: false }).limit(5);

        if (duplicates && duplicates.length > 1) {
          result.duplicate_warning = { count: duplicates.length, last_seen: duplicates[1]?.created_at };
        }

        const { data: patientHistory } = await supabase
          .from("analysis_history").select("id, created_at, medicaments")
          .eq("pharmacy_id", pharmacyId).eq("patient_hash", patientHash)
          .order("created_at", { ascending: false }).limit(10);

        if (patientHistory && patientHistory.length > 1) {
          result.patient_history = {
            previous_analyses: patientHistory.length - 1,
            first_seen: patientHistory[patientHistory.length - 1]?.created_at,
          };
        }
      }
    } catch (historyErr) {
      console.error("Failed to save analysis history:", historyErr);
    }

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
