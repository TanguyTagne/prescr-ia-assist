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
  ]
}

RÈGLES :
- JAMAIS de diagnostic, JAMAIS nommer une pathologie chez le patient
- Langage probabiliste : "souvent associé à", "peut accompagner"
- Baser les indications et effets secondaires SUR LES DONNÉES PUBLIQUES fournies`;

// ====== CLINICAL KNOWLEDGE BASE LOOKUP ======

async function clinicalLookup(supabase: any, medName: string, moleculeName?: string | null) {
  let medicament = null;
  let molecule = null;

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

  if (!molecule && moleculeName) {
    const { data: molMatch } = await supabase
      .from("molecules")
      .select("*")
      .ilike("nom_molecule", `%${moleculeName.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (molMatch) molecule = molMatch;
  }

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

  let classeAtc = null;
  if (atcCode) {
    const { data } = await supabase
      .from("classe_atc")
      .select("*")
      .eq("atc_code", atcCode)
      .maybeSingle();
    classeAtc = data;
  }

  let pathologies: any[] = [];
  const moleculeId = molecule?.id;
  if (moleculeId) {
    const { data } = await supabase
      .from("molecule_pathologie")
      .select("pathologie_id, pathologies(*)")
      .eq("molecule_id", moleculeId);
    pathologies = (data || []).map((mp: any) => mp.pathologies).filter(Boolean);
  }

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

// ====== CLINICAL FALLBACK HELPERS ======

const MAX_RECOMMENDATIONS_PER_MED = 3;
const LOW_FRICTION_BLOCKLIST = [
  "inhalateur",
  "nébuliseur",
  "nebuliseur",
  "orthèse",
  "orthese",
  "fauteuil",
  "appareil coûteux",
];

function normalizeText(value: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isLowFrictionProduct(productName: string) {
  const normalized = normalizeText(productName);
  return normalized && !LOW_FRICTION_BLOCKLIST.some((blocked) => normalized.includes(normalizeText(blocked)));
}

function normalizeAdviceSentence(text: string) {
  return (text || "").trim().replace(/[.\s]+$/g, "");
}

function pickDistinctProducts(products: any[], max = MAX_RECOMMENDATIONS_PER_MED) {
  const selected: any[] = [];
  const seen = new Set<string>();

  for (const product of products || []) {
    const key = normalizeText(product?.produit || "");
    if (!key || seen.has(key) || !isLowFrictionProduct(product?.produit || "")) continue;
    seen.add(key);
    selected.push(product);
    if (selected.length >= max) break;
  }

  return selected;
}

function pickMainAdviceFromConseils(conseils: any[]) {
  if (!conseils?.length) return null;

  const sorted = [...conseils].sort((a: any, b: any) => (b?.priorite || 0) - (a?.priorite || 0));
  const best = sorted[0];
  if (!best?.conseil) return null;
  return best.description ? `${best.conseil} (${best.description})` : best.conseil;
}

function findProtocolForPathologies(protocols: any[], pathologies: any[]) {
  if (!protocols?.length || !pathologies?.length) return null;

  const pathIds = pathologies.map((p: any) => p?.id).filter(Boolean);
  if (!pathIds.length) return null;

  // Match by pathologie_id (new protocole_pathologie table)
  const matches = protocols.filter((row: any) => {
    return pathIds.includes(row?.pathologie_id);
  });

  if (matches.length === 0) {
    // Fallback: match by name (legacy pathology_protocol table)
    const pathNames = pathologies.map((p: any) => normalizeText(p?.nom_pathologie || "")).filter(Boolean);
    const nameMatches = protocols.filter((row: any) => {
      const protocolPath = normalizeText(row?.pathologie || row?.pathologie_nom || "");
      if (!protocolPath) return false;
      return pathNames.some((p) => p.includes(protocolPath) || protocolPath.includes(p));
    });
    if (nameMatches.length === 0) return null;
    return nameMatches.sort((a: any, b: any) => (b?.priorite_produit_1 || b?.priority || 0) - (a?.priorite_produit_1 || a?.priority || 0))[0];
  }

  return matches.sort((a: any, b: any) => (b?.priorite_produit_1 || 0) - (a?.priorite_produit_1 || 0))[0];
}

async function getRecommendationsFromMoleculeIds(supabase: any, moleculeIds: string[]) {
  if (moleculeIds.length === 0) return [];

  const { data: moleculePathologies } = await supabase
    .from("molecule_pathologie")
    .select("pathologie_id")
    .in("molecule_id", moleculeIds)
    .limit(200);

  const pathologieIds = [...new Set((moleculePathologies || []).map((mp: any) => mp.pathologie_id).filter(Boolean))];
  if (pathologieIds.length === 0) return [];

  const { data: produits } = await supabase
    .from("produits_complementaires")
    .select("*, pathologies(nom_pathologie)")
    .in("pathologie_id", pathologieIds)
    .order("priorite", { ascending: false })
    .limit(40);

  return pickDistinctProducts((produits || []).map((p: any) => ({
    produit: p.produit,
    categorie: p.categorie || "Complément",
    description: p.description || "",
    priorite: p.priorite || 50,
    pathologie: p.pathologies?.nom_pathologie || "",
  })));
}

async function getAtcFallbackRecommendations(supabase: any, atcCode: string) {
  if (!atcCode) return [];

  const { data: molecules } = await supabase
    .from("molecules")
    .select("id")
    .eq("atc_code", atcCode)
    .limit(50);

  const moleculeIds = (molecules || []).map((m: any) => m.id).filter(Boolean);
  return getRecommendationsFromMoleculeIds(supabase, moleculeIds);
}

async function getClassFallbackRecommendations(supabase: any, therapeuticClass: string) {
  if (!therapeuticClass) return [];

  let { data: exactClassMolecules } = await supabase
    .from("molecules")
    .select("id")
    .ilike("classe_therapeutique", therapeuticClass.trim())
    .limit(50);

  if (!exactClassMolecules?.length) {
    const { data: partialClassMolecules } = await supabase
      .from("molecules")
      .select("id")
      .ilike("classe_therapeutique", `%${therapeuticClass.trim()}%`)
      .limit(50);
    exactClassMolecules = partialClassMolecules || [];
  }

  if (!exactClassMolecules?.length) {
    const classKeywords = normalizeText(therapeuticClass)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 5)
      .slice(0, 3);

    if (classKeywords.length > 0) {
      const keywordMatches = await Promise.all(
        classKeywords.map(async (keyword) => {
          const { data } = await supabase
            .from("molecules")
            .select("id, classe_therapeutique")
            .ilike("classe_therapeutique", `%${keyword}%`)
            .limit(50);
          return data || [];
        })
      );

      const seen = new Set<string>();
      exactClassMolecules = keywordMatches.flat().filter((molecule: any) => {
        if (!molecule?.id || seen.has(molecule.id)) return false;
        seen.add(molecule.id);
        return true;
      });
    }
  }

  const moleculeIds = (exactClassMolecules || []).map((m: any) => m.id).filter(Boolean);
  return getRecommendationsFromMoleculeIds(supabase, moleculeIds);
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

const OCR_MODEL = "google/gemini-2.5-pro";
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

// ====== AUTH HELPER ======

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
    const allDbConseils: any[] = [];
    const allDbProduits: any[] = [];
    const sources: string[] = [];

    for (let i = 0; i < medNames.length; i++) {
      const clinical = await clinicalLookup(supabase, medNames[i], medMolecules[i]);
      if (clinical) {
        clinicalResults.push({ index: i, ...clinical });
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

    // Step 4: Build direct recommendations per medication (1 conseil + 2 produits max)
    const allContexts: string[] = [];
    let hasStructuredData = clinicalResults.length > 0;
    const medRecommendations: Map<number, any[]> = new Map();
    const medMainAdvice: Map<number, string> = new Map();

    const { data: pathologyProtocols } = await supabase
      .from("pathology_protocol")
      .select("pathologie, conseil, produit_1, produit_2, priority")
      .order("priority", { ascending: false });

    // Preload ATC/class fallback recommendations from clinical DB for medications with no direct mapping
    const atcFallbackMap = new Map<string, any[]>();
    const classFallbackMap = new Map<string, any[]>();

    const atcCodes = [...new Set(enrichedMeds.map((m: any) => m.code_atc).filter(Boolean))] as string[];
    const therapeuticClasses = [...new Set(enrichedMeds.map((m: any) => m.classe_therapeutique).filter(Boolean))] as string[];

    await Promise.all([
      ...atcCodes.map(async (code) => {
        const recs = await getAtcFallbackRecommendations(supabase, code);
        if (recs.length > 0) {
          atcFallbackMap.set(code, recs);
          if (!sources.includes("Base clinique PrescrIA")) sources.push("Base clinique PrescrIA");
        }
      }),
      ...therapeuticClasses.map(async (therapeuticClass) => {
        const recs = await getClassFallbackRecommendations(supabase, therapeuticClass);
        if (recs.length > 0) {
          classFallbackMap.set(therapeuticClass, recs);
          if (!sources.includes("Base clinique PrescrIA")) sources.push("Base clinique PrescrIA");
        }
      }),
    ]);

    for (let i = 0; i < enrichedMeds.length; i++) {
      const med = enrichedMeds[i];
      const recs: any[] = [];
      let advice: string | null = null;

      if (med.clinical_kb) {
        hasStructuredData = true;
        const pathNames = (med.pathologies || []).map((p: any) => p.nom_pathologie);
        for (const pName of pathNames) {
          allContexts.push(`Traitement souvent associé à : ${pName}`);
        }

        const clinical = clinicalResults.find((c: any) => c.index === i);

        // Priority rule: protocol table (pathology_protocol)
        const matchedProtocol = findProtocolForPathologies(pathologyProtocols || [], med.pathologies || []);
        if (matchedProtocol) {
          advice = matchedProtocol.conseil;

          const protocolProducts = [matchedProtocol.produit_1, matchedProtocol.produit_2]
            .filter(Boolean)
            .map((productName: string, idx: number) => {
              const fromClinical = (clinical?.produits || []).find((p: any) =>
                normalizeText(p?.produit || "") === normalizeText(productName)
              );

              return {
                produit: productName,
                categorie: fromClinical?.categorie || "Complément",
                description: fromClinical?.description || "Produit pertinent et facile à conseiller au comptoir",
                priorite: fromClinical?.priorite || (matchedProtocol.priority || 80) - idx,
                pathologie: fromClinical?.pathologies?.nom_pathologie || matchedProtocol.pathologie,
              };
            });

          recs.push(...pickDistinctProducts(protocolProducts, MAX_RECOMMENDATIONS_PER_MED));
        }

        // Fallback on existing clinical product rows
        if (recs.length === 0 && clinical?.produits) {
          const mappedClinicalProducts = (clinical.produits || []).map((p: any) => ({
            produit: p.produit,
            categorie: p.categorie || "Complément",
            description: p.description || "",
            priorite: p.priorite || 50,
            pathologie: p.pathologies?.nom_pathologie || "",
          }));

          recs.push(...pickDistinctProducts(mappedClinicalProducts, MAX_RECOMMENDATIONS_PER_MED));
        }

        if (!advice && clinical?.conseils?.length) {
          advice = pickMainAdviceFromConseils(clinical.conseils);
        }
      } else if (med.matched && !med.clinical_kb && !med.ai_enriched) {
        const therapeuticData = await getTherapeuticData(supabase, med);
        if (therapeuticData) {
          hasStructuredData = true;
          for (const ctx of therapeuticData) {
            allContexts.push(ctx.description);
          }
        }
      } else if (med.ai_enriched && med.ai_contexts) {
        for (const ctx of med.ai_contexts) allContexts.push(ctx.description);
      }

      // Fallback 1: products from pathologies already loaded in current prescription scope
      if (recs.length === 0 && med.pathologies?.length > 0) {
        const pathIds = med.pathologies.map((p: any) => p.id);
        const pathProducts = allDbProduits
          .filter((p: any) => pathIds.includes(p.pathologie_id))
          .map((p: any) => ({
            produit: p.produit,
            categorie: p.categorie || "Complément",
            description: p.description || "",
            priorite: p.priorite || 50,
            pathologie: p.pathologies?.nom_pathologie || "",
          }));

        recs.push(...pickDistinctProducts(pathProducts, MAX_RECOMMENDATIONS_PER_MED));
      }

      // Fallback 2: ATC linked products
      if (recs.length === 0 && med.code_atc && atcFallbackMap.has(med.code_atc)) {
        const atcRecs = pickDistinctProducts(atcFallbackMap.get(med.code_atc) || [], MAX_RECOMMENDATIONS_PER_MED);
        recs.push(...atcRecs);
        if (atcRecs.length > 0) {
          hasStructuredData = true;
          for (const rec of atcRecs) {
            if (rec.pathologie) allContexts.push(`Traitement souvent associé à : ${rec.pathologie}`);
          }
        }
      }

      // Fallback 3: class linked products
      if (recs.length === 0 && med.classe_therapeutique && classFallbackMap.has(med.classe_therapeutique)) {
        const classRecs = pickDistinctProducts(classFallbackMap.get(med.classe_therapeutique) || [], MAX_RECOMMENDATIONS_PER_MED);
        recs.push(...classRecs);
        if (classRecs.length > 0) {
          hasStructuredData = true;
          for (const rec of classRecs) {
            if (rec.pathologie) allContexts.push(`Traitement souvent associé à : ${rec.pathologie}`);
          }
        }
      }

      if (!advice) {
        const pathIds = med.pathologies?.map((p: any) => p.id) || [];
        const scopedConseils = allDbConseils
          .filter((c: any) => !pathIds.length || pathIds.includes(c.pathologie_id))
          .sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0));
        advice = pickMainAdviceFromConseils(scopedConseils);
      }

      if (advice) medMainAdvice.set(i, advice);
      medRecommendations.set(i, recs.slice(0, MAX_RECOMMENDATIONS_PER_MED));
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

    // Step 6: Build global conseil (from per-med advice first)
    const uniqueMedAdvice = [...new Set([...medMainAdvice.values()].filter(Boolean))];
    const defaultFollowup = "N'hésitez pas à me poser des questions sur votre traitement, je suis là pour vous accompagner.";

    let conseilText = defaultFollowup;
    if (uniqueMedAdvice.length > 0) {
      const formattedAdvice = uniqueMedAdvice
        .slice(0, 2)
        .map((advice) => normalizeAdviceSentence(advice))
        .filter(Boolean);
      conseilText = `${formattedAdvice.join(". ")}. ${defaultFollowup}`;
    } else if (allDbConseils.length > 0) {
      const topConseils = allDbConseils
        .filter((c: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.conseil === c.conseil) === idx)
        .sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0))
        .slice(0, 2);
      const formattedAdvice = topConseils
        .map((c: any) => normalizeAdviceSentence(c.conseil + (c.description ? ` (${c.description})` : "")))
        .filter(Boolean);
      conseilText = `${formattedAdvice.join(". ")}. ${defaultFollowup}`;
    }

    // Step 7: Build result
    const medicamentsResult = enrichedMeds.map((m: any, i: number) => ({
      nom: m.nom_commercial,
      classe: m.classe_therapeutique || m.therapeutic_classes?.nom || "Non classifié",
      molecule: m.molecule_active || null,
      code_atc: m.code_atc || null,
      conseil_associe: medMainAdvice.get(i) || null,
      recommendations: medRecommendations.get(i) || [],
    }));

    const totalRecs = [...medRecommendations.values()].reduce((sum, r) => sum + r.length, 0);

    // Legacy compatibility for old clients still expecting suggestions/questions keys
    const legacySuggestions = medicamentsResult
      .flatMap((med: any) => med.recommendations || [])
      .slice(0, 8)
      .map((rec: any) => ({
        categorie: rec.categorie || "Complément",
        raison: rec.pathologie ? `Contexte : ${rec.pathologie}` : "Produit complémentaire pertinent",
        icon: "💊",
        priorite: rec.priorite >= 80 ? "haute" : "moyenne",
        produits_lgo: [{ nom: rec.produit, cip: "", prix: 0, stock: 999, categorie: rec.categorie || "Complément" }],
      }));

    const result: any = {
      medicaments: medicamentsResult,
      interactions,
      contextes: [...new Set(allContexts)].slice(0, 5),
      conseil: conseilText,
      structuredData: hasStructuredData,
      sources,
      patient_name: extractedPatientName,
      suggestions: legacySuggestions,
      questions: [],
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
