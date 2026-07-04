// redeploy 2026-06-30: force prod sync — propagate pertinence + phrase_conseil from medicament_curated_pcs
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

const EXTRACTION_PROMPT = `Tu es Asclion, un copilote pour préparateurs en pharmacie.
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
    {
      "nom_commercial": "nom tel qu'écrit ou interprété",
      "molecule_probable": "DCI si connue, sinon null",
      "dosage": "dosage tel qu'écrit (ex: '20 mg', '1%', '5 mg/ml') ou null",
      "forme_galenique": "forme tel qu'écrit (ex: 'comprimé', 'crème', 'pommade', 'sirop', 'collyre', 'gouttes auriculaires', 'spray nasal', 'suppositoire', 'patch') ou null",
      "voie_administration": "orale|cutanée|nasale|ophtalmique|auriculaire|rectale|vaginale|inhalée|injectable|sublinguale|inconnue",
      "confiance": "haute|moyenne|basse"
    }
  ]
}

RÈGLES :
- Extrais le nom du patient s'il est visible sur l'ordonnance
- Extrais TOUS les noms de médicaments (commerciaux ou DCI)
- CRITIQUE : la voie d'administration change radicalement le médicament. Exemple : prednisolone ORALE (anti-inflammatoire systémique) ≠ prednisolone CUTANÉE (dermocorticoïde). Sois TRÈS attentif à la forme galénique écrite (cp, gél, sachet, sirop = orale ; crème, pommade, gel = cutanée ; collyre = ophtalmique ; etc.).
- Si la forme galénique n'est pas explicite, déduis-la du dosage et du contexte (ex: "20 mg cp" → orale ; "1% crème" → cutanée).
- DÉFAUT : si la voie reste ambiguë alors que le médicament existe sous plusieurs voies (ex: prednisolone seule, sans forme indiquée), pars du principe que la voie est ORALE (forme la plus prescrite en officine), mets voie_administration = "orale" et signale-le en mettant confiance = "moyenne". N'utilise "inconnue" qu'en tout dernier recours si même la voie orale n'a aucun sens.
- Si tu reconnais la DCI, indique-la
- Indique le niveau de confiance de lecture (haute si clair, basse si écriture illisible)
- Ne retourne RIEN d'autre que ce JSON`;

const ENRICHMENT_PROMPT = `Tu es Asclion, un copilote pharmacien. On te donne un médicament (parfois un nom commercial précis, parfois un terme générique de classe comme "sirop antitussif", "antalgique", "antibiotique", "pommade cicatrisante"…) et éventuellement des données issues de bases publiques (RxNav ATC, OpenFDA).

## DONNÉES PUBLIQUES FOURNIES (peuvent être vides)
{PUBLIC_DATA}

## OBLIGATION ABSOLUE
Tu DOIS TOUJOURS retourner un JSON valide au format ci-dessous, MÊME si les données publiques sont vides ou si le terme est générique.
- Si données publiques disponibles → les utiliser en priorité.
- Si terme générique (ex: "sirop antitussif", "antitussif", "antalgique", "laxatif") → utilise tes connaissances générales pour décrire la classe pharmacologique correspondante (DCI typique = la plus fréquente de la classe, classe_therapeutique = nom de la classe, indications = motifs d'usage classiques de la classe).
- Si médicament inconnu → retourne le JSON avec des champs vides ou "non spécifié" plutôt que de refuser.
INTERDIT : refuser de répondre, écrire des excuses, demander des précisions. Seul le JSON est autorisé.

## FORMAT JSON STRICT
{
  "nom": "nom commercial ou terme tel que fourni",
  "molecule_active": "DCI ou classe si générique",
  "code_atc": "code ATC ou ''",
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
- Réponds UNIQUEMENT avec le JSON, rien d'autre (pas de texte avant/après, pas de markdown).`;

// ====== CLINICAL KNOWLEDGE BASE LOOKUP ======

// Extract the core drug name for fuzzy matching (strip dosage, form, brand suffixes)
function extractCoreDrugName(name: string): string {
  return (name || "")
    .trim()
    .replace(/\d+\s*(mg|g|ml|ui|µg|mcg|%)/gi, "") // strip dosage
    .replace(/\b(comprimé|comprimés|gélule|gélules|sachet|sachets|sirop|suspension|solution|crème|gel|patch|spray|gouttes|pommade|injectable|lyoc|effervescent|orodispersible|lp|fort|adulte|enfant|nourrisson|buvable)\b/gi, "") // strip forms
    .replace(/\s+/g, " ")
    .trim();
}

// Build multiple search variants for a drug name
function buildSearchVariants(medName: string): string[] {
  const trimmed = medName.trim();
  const core = extractCoreDrugName(trimmed);
  const variants = new Set<string>();
  variants.add(trimmed);
  if (core && core !== trimmed) variants.add(core);
  // Also try first word only (brand name)
  const firstWord = core.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) variants.add(firstWord);
  return [...variants];
}

// Determine if a forme galénique string is cutaneous/topical
function isTopicalForm(forme: string): boolean {
  return /cr[èe]me|pommade|\bgel\b|patch|spray cutan|topique|cutan|dermique/i.test(forme || "");
}
// Determine if a forme galénique string is systemic-oral
function isOralForm(forme: string): boolean {
  return /comprim|g[ée]lule|sachet|sirop|solution buvable|lyoc|orodisp|effervesc|granul[ée]/i.test(forme || "");
}
// Pediatric safety filter — when scanned medication targets infants/children,
// strip any PC that is adult-only (aspirin adult, ibuprofen 400, paracetamol 1000, PPI, etc.)
const PEDS_BLACKLIST = /(aspirine|aspégic ?(?!nourrisson)|kardégic|ibuprof[èe]ne ?400|nurofen ?400|paracétamol ?1000|doliprane ?1000|efferalgan ?1000|mopralpro|inexium|om[ée]prazole|esom[ée]prazole|pantoprazole|baume du tigre|harpagophyt|curcuma|magn[ée]sium ?(200|300|400|450)|spasfon lyoc|imodium adulte|nicopatch|nicorette|champix|cialis|viagra|huile essentielle (?!eucalyptus radiata))/i;
const PEDS_WHITELIST = /(b[ée]b[ée]|nourrisson|enfant|p[ée]diatr|junior|kids|sirop|gouttes|suspension|st[ée]rimar|physiomer|prorhinel|bepanthen|mustela|weleda b[ée]b[ée]|calmosine|biogaia|p[ée]diakid|liniment|s[ée]rum physiologique|mouche-b[ée]b[ée]|zymad|doliprane 2,?4|doliprane sirop|advil enfant|nurofen enfant|efferalgan susp|forlax junior|movicol enfant|microlax b[ée]b[ée]|gaviscon nourrisson)/i;

function filterPediatricSafe(pcs: any[], med: any): any[] {
  const cible = med?.cible_age;
  if (cible !== "nourrisson" && cible !== "enfant") return pcs;
  return pcs.filter((p: any) => {
    const ages: string[] = Array.isArray(p.cible_age) ? p.cible_age : [];
    if (ages.includes("nourrisson") || ages.includes("enfant")) return true;
    const text = `${p.produit || ""} ${p.description || ""}`;
    if (PEDS_BLACKLIST.test(text)) return false;
    if (PEDS_WHITELIST.test(text)) return true;
    // Unknown PC for a pediatric med → drop by default (safety first)
    return false;
  });
}

// Map a voie_administration to a form-test predicate
function buildFormFilter(voie?: string | null, forme?: string | null) {

  const v = (voie || "").toLowerCase();
  const f = (forme || "").toLowerCase();
  if (v === "orale" || isOralForm(f)) return (rowForme: string) => !isTopicalForm(rowForme);
  if (v === "cutanée" || v === "cutanee" || isTopicalForm(f)) return (rowForme: string) => isTopicalForm(rowForme);
  if (v === "ophtalmique") return (rowForme: string) => /collyre|ophta/i.test(rowForme);
  if (v === "auriculaire") return (rowForme: string) => /auricul|otique/i.test(rowForme);
  if (v === "nasale") return (rowForme: string) => /nasal|spray nasal/i.test(rowForme);
  if (v === "rectale") return (rowForme: string) => /suppo|rectal/i.test(rowForme);
  if (v === "vaginale") return (rowForme: string) => /ovule|vaginal/i.test(rowForme);
  if (v === "inhalée" || v === "inhalee") return (rowForme: string) => /inhal|a[ée]rosol|spray\b/i.test(rowForme);
  if (v === "injectable") return (rowForme: string) => /inject|amp|sc\b|im\b|iv\b/i.test(rowForme);
  return null;
}

async function clinicalLookup(
  supabase: any,
  medName: string,
  moleculeName?: string | null,
  hints?: { voie_administration?: string | null; forme_galenique?: string | null; dosage?: string | null },
) {
  let medicament = null;
  let molecule = null;

  const searchVariants = buildSearchVariants(medName);
  const formFilter = buildFormFilter(hints?.voie_administration, hints?.forme_galenique);

  // Helper: pick best row matching the form filter
  // Default (no hint): prefer oral systemic forms over topical (safer + more common in officine)
  const pickByForm = (rows: any[] | null) => {
    if (!rows || rows.length === 0) return null;
    if (formFilter) {
      const match = rows.find((r) => formFilter(r.forme_galenique || ""));
      if (match) return match;
    }
    // Default heuristic: prefer oral, then non-topical, then anything
    const oral = rows.find((r) => isOralForm(r.forme_galenique || ""));
    if (oral) return oral;
    const nonTopical = rows.find((r) => !isTopicalForm(r.forme_galenique || ""));
    if (nonTopical) return nonTopical;
    return rows[0];
  };

  // Try each variant: exact match first, then partial — fetch up to 10 to allow form filtering
  for (const variant of searchVariants) {
    if (medicament) break;
    const { data: exactRows } = await supabase
      .from("medicaments")
      .select("*, molecules(*)")
      .ilike("nom_commercial", variant)
      .limit(10);
    const picked = pickByForm(exactRows);
    if (picked) {
      medicament = picked;
      molecule = picked.molecules;
    }
  }

  if (!medicament) {
    for (const variant of searchVariants) {
      if (medicament) break;
      const { data: partialRows } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .ilike("nom_commercial", `%${variant}%`)
        .limit(10);
      const picked = pickByForm(partialRows);
      if (picked) {
        medicament = picked;
        molecule = picked.molecules;
      }
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

  // ====== PATHOLOGY LOOKUP: molecule_pathologie + medicament_pathologie ======
  let pathologies: any[] = [];
  const pathologieIdSet = new Set<string>();

  // Collect (pathology, score) pairs from BOTH sources, then sort by score
  const pathoScored: { patho: any; score: number }[] = [];

  // 1) Via molecule_pathologie (now WITH score_pertinence)
  const moleculeId = molecule?.id;
  if (moleculeId) {
    const { data } = await supabase
      .from("molecule_pathologie")
      .select("pathologie_id, score_pertinence, pathologies(*)")
      .eq("molecule_id", moleculeId);
    for (const mp of data || []) {
      if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
        pathologieIdSet.add(mp.pathologies.id);
        pathoScored.push({ patho: mp.pathologies, score: mp.score_pertinence ?? 50 });
      }
    }
  }

  // 2) Via medicament_pathologie (critical for meds without molecule like Gaviscon)
  if (medicament?.id) {
    const { data } = await supabase
      .from("medicament_pathologie")
      .select("pathologie_id, score_pertinence, pathologies(*)")
      .eq("medicament_id", medicament.id);
    for (const mp of data || []) {
      if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
        pathologieIdSet.add(mp.pathologies.id);
        pathoScored.push({ patho: mp.pathologies, score: mp.score_pertinence ?? 50 });
      }
    }
  }

  // Filter dermato pathologies for systemic-only forms (oral / injectable)
  // to avoid e.g. Solupred 20mg (oral) → "produit pour la peau"
  // Determine route: prefer the prescription hint (voie_administration), fallback to matched medicament's forme galénique
  const formeGal = (medicament?.forme_galenique || "").toLowerCase();
  const voieHint = (hints?.voie_administration || "").toLowerCase();
  const formeHint = (hints?.forme_galenique || "").toLowerCase();
  const isSystemicOnly =
    voieHint === "orale" || voieHint === "injectable" || voieHint === "rectale" || voieHint === "inhalée" || voieHint === "inhalee"
    || isOralForm(formeHint)
    || (!voieHint && !formeHint && /comprim|g[ée]lule|sachet|sirop|solution buvable|injectable|lyoc|orodisp|effervesc/.test(formeGal)
        && !/cr[èe]me|pommade|gel\b|patch|spray|collyre|gouttes|topique|cutan/.test(formeGal));
  const isTopicalRoute = voieHint === "cutanée" || voieHint === "cutanee" || isTopicalForm(formeHint) || isTopicalForm(formeGal);
  const dermatoCategoriesToSkip = new Set(["dermatologie"]);

  let filteredScored = pathoScored;
  if (isSystemicOnly) {
    filteredScored = pathoScored.filter(({ patho }) => {
      const cat = (patho.categorie || "").toLowerCase();
      return !dermatoCategoriesToSkip.has(cat);
    });
    if (filteredScored.length === 0) filteredScored = pathoScored;
  } else if (isTopicalRoute) {
    // For topical/cutaneous route, prioritize dermato pathologies and exclude clearly systemic categories
    const dermatoOnly = pathoScored.filter(({ patho }) => {
      const cat = (patho.categorie || "").toLowerCase();
      return dermatoCategoriesToSkip.has(cat) || /dermat|peau|cutan/i.test(cat) || /dermat|peau|cutan|eczema|psoriasis|acn[ée]/i.test(patho.nom_pathologie || "");
    });
    if (dermatoOnly.length > 0) filteredScored = dermatoOnly;
  }

  // Sort by score desc, then keep only top 4 to focus recommendations
  filteredScored.sort((a, b) => b.score - a.score);
  pathologies = filteredScored.slice(0, 4).map((x) => x.patho);

  const pathologieIds = pathologies.map((p) => p.id);
  let conseils: any[] = [];
  let produits: any[] = [];
  let protocoles: any[] = [];

  // Direct medication-bound PCs (curated, highest priority):
  //   a) produits_complementaires.medicament_id (legacy 1-to-1, e.g. gpt55_orphan_fill)
  //   b) medicament_pc_valide (many-to-many curation — domain-correct: ear, eye, nose…)
  const directMedPcsPromise = medicament?.id
    ? supabase
        .from("produits_complementaires")
        .select("*, pathologies(nom_pathologie)")
        .eq("medicament_id", medicament.id)
        .order("priorite", { ascending: false })
    : Promise.resolve({ data: [] });

  const curatedMpvPromise = medicament?.id
    ? supabase
        .from("medicament_pc_valide")
        .select("score, finalite, pc:produits_complementaires(*, pathologies(nom_pathologie))")
        .eq("medicament_id", medicament.id)
        .order("score", { ascending: false })
        .limit(20)
    : Promise.resolve({ data: [] });

  // Highest-priority curated source — medicament_curated_pcs (pc_1/pc_2 per med)
  // Imported from the corrected CSV "asclion-medicaments-avec-pcs-corrige" (2026-06).
  // These OVERRIDE everything else when present.
  const curatedTopPromise = medicament?.id
    ? supabase
        .from("medicament_curated_pcs")
        .select("pc_1, pc_2, pertinence_pc1, pertinence_pc2, phrase_conseil_pc1, phrase_conseil_pc2")
        .eq("medicament_id", medicament.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const mapCuratedMpv = (rows: any[]) =>
    rows
      .map((r: any) => (r?.pc ? { ...r.pc, priorite: Math.max(r.score || 0, 90) } : null))
      .filter(Boolean);

  // Build top-curated PC objects from pc_1/pc_2 names, enriched from produits_complementaires when matchable.
  const buildCuratedTop = async (row: { pc_1?: string | null; pc_2?: string | null; pertinence_pc1?: string | null; pertinence_pc2?: string | null; phrase_conseil_pc1?: string | null; phrase_conseil_pc2?: string | null } | null) => {
    if (!row) return [];
    const pairs = [
      { name: row.pc_1, pertinence: row.pertinence_pc1, phrase: row.phrase_conseil_pc1 },
      { name: row.pc_2, pertinence: row.pertinence_pc2, phrase: row.phrase_conseil_pc2 },
    ].filter((p): p is { name: string; pertinence: string | null; phrase: string | null } => !!p.name && p.name.trim().length > 0).slice(0, 2);
    if (pairs.length === 0) return [];
    const names = pairs.map((p) => p.name.trim());

    // Normalize: lowercase, strip parentheticals "(...)", collapse spaces
    const norm = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

    // 1) Exact (case-insensitive) match
    const { data: matched } = await supabase
      .from("produits_complementaires")
      .select("produit, categorie, description, phrase_conseil, type_produit, pathologies(nom_pathologie)")
      .in("produit", names);
    const byKey = new Map<string, any>();
    for (const m of matched || []) byKey.set(norm(m.produit || ""), m);

    // 2) Fuzzy fallback (ILIKE) for any unmatched names — picks the row whose
    //    normalized name contains, or is contained in, the requested name.
    const unmatched = names.filter((n) => !byKey.get(norm(n)));
    for (const name of unmatched) {
      const key = norm(name);
      if (!key) continue;
      const tokens = key.split(" ").filter(Boolean);
      const head = tokens.slice(0, 2).join(" ");
      const { data: rows } = await supabase
        .from("produits_complementaires")
        .select("produit, categorie, description, phrase_conseil, type_produit, pathologies(nom_pathologie)")
        .or(`produit.ilike.%${key}%,produit.ilike.${head}%`)
        .limit(5);
      const best = (rows || []).find((r) => {
        const k = norm(r.produit || "");
        return k === key || k.startsWith(key) || key.startsWith(k) || (head && k.includes(head));
      });
      if (best) byKey.set(key, best);
    }

    return pairs.map(({ name, pertinence, phrase }, idx) => {
      const enrich = byKey.get(norm(name));
      // Priorité phrase CSV > phrase DB produits_complementaires
      const csvPhrase = (phrase || "").trim();
      return {
        produit: name,
        categorie: enrich?.categorie || "Conseil associé",
        description: enrich?.description || "",
        priorite: 100 - idx, // 100, 99 → always above mpv (≤95) and pathology PCs
        phrase_conseil: csvPhrase || enrich?.phrase_conseil || undefined,
        pertinence: (pertinence || "").trim() || undefined,
        type_produit: enrich?.type_produit || undefined,
        pathologies: enrich?.pathologies || null,
        source_curated: "asclion_csv_corrige",
      };
    });
  };

  // STRICT CURATED-ONLY MODE — only `medicament_curated_pcs` (pc_1/pc_2 from
  // the "Asclion medicaments finals" CSV) feeds the recommendations. No
  // pathology, ATC, class, mpv or directMedPcs PC fallback.
  let curatedPcsOut: any[] = [];
  const [conseilsRes, protocolesRes, curatedTopRes] = await Promise.all([
    pathologieIds.length > 0
      ? supabase
          .from("conseils_associes")
          .select("*, pathologies(nom_pathologie)")
          .in("pathologie_id", pathologieIds)
          .order("priorite", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    pathologieIds.length > 0
      ? supabase
          .from("protocole_pathologie")
          .select(`
            *, pathologies(nom_pathologie),
            conseil_1:conseils_associes!protocole_pathologie_conseil_1_id_fkey(conseil, description),
            conseil_2:conseils_associes!protocole_pathologie_conseil_2_id_fkey(conseil, description),
            produit_1:produits_complementaires!protocole_pathologie_produit_complementaire_1_id_fkey(produit, categorie, description, priorite, phrase_conseil),
            produit_2:produits_complementaires!protocole_pathologie_produit_complementaire_2_id_fkey(produit, categorie, description, priorite, phrase_conseil),
            produit_3:produits_complementaires!protocole_pathologie_produit_complementaire_3_id_fkey(produit, categorie, description, priorite, phrase_conseil)
          `)
          .in("pathologie_id", pathologieIds)
          .eq("actif", true)
      : Promise.resolve({ data: [] as any[] }),
    curatedTopPromise,
  ]);
  conseils = conseilsRes.data || [];
  const curatedTop = await buildCuratedTop((curatedTopRes as any).data || null);
  curatedPcsOut = curatedTop;
  produits = filterPediatricSafe(curatedTop, medicament);
  protocoles = protocolesRes.data || [];



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
    protocoles,
    curated_pcs: curatedPcsOut,
  };
}


// ====== LATENT NEED ENGINE ======

interface LatentNeed {
  id: string;
  medicament_source: string;
  besoin_infere: string;
  categorie: string;
  score: number;
  description: string | null;
  phrase_patient: string | null;
  benefice: string | null;
}

async function detectLatentNeeds(
  supabase: any,
  medNames: string[],
): Promise<LatentNeed[]> {
  const normalized = medNames.map((n) => normalizeText(extractCoreDrugName(n)));
  
  // 1) Individual medication needs
  const { data: allNeeds } = await supabase
    .from("latent_needs")
    .select("*")
    .order("score", { ascending: false });

  if (!allNeeds || allNeeds.length === 0) return [];

  const matched: LatentNeed[] = [];
  const seenBesoins = new Set<string>();

  // Check combination keys first (higher priority)
  const comboKey = normalized.sort().join("+");
  for (const need of allNeeds) {
    const needKey = normalizeText(need.medicament_source);
    if (needKey.includes("+") && comboKey.includes(needKey.replace("+", "")) && !seenBesoins.has(need.besoin_infere)) {
      matched.push(need);
      seenBesoins.add(need.besoin_infere);
    }
  }

  // Then individual medications
  for (const medNorm of normalized) {
    for (const need of allNeeds) {
      if (seenBesoins.has(need.besoin_infere)) continue;
      const needKey = normalizeText(need.medicament_source);
      if (needKey.includes("+")) continue; // skip combos already checked
      if (medNorm.includes(needKey) || needKey.includes(medNorm)) {
        matched.push(need);
        seenBesoins.add(need.besoin_infere);
      }
    }
  }

  return matched;
}

// Apply latent need boost to PC score: max 1 opportunity per basket
function applyLatentNeedBoost(
  recs: any[],
  latentNeeds: LatentNeed[],
  alreadyUsedLatentNeed: boolean,
): { boostedRecs: any[]; usedNeed: LatentNeed | null } {
  if (alreadyUsedLatentNeed || latentNeeds.length === 0) {
    return { boostedRecs: recs, usedNeed: null };
  }

  // Find the best matching latent need for any rec's category
  let bestNeed: LatentNeed | null = null;
  let bestRecIdx = -1;

  for (const need of latentNeeds) {
    const needCat = normalizeText(need.categorie);
    for (let i = 0; i < recs.length; i++) {
      const recCat = normalizeText(recs[i].categorie || "");
      if (recCat.includes(needCat) || needCat.includes(recCat)) {
        if (!bestNeed || need.score > bestNeed.score) {
          bestNeed = need;
          bestRecIdx = i;
        }
      }
    }
  }

  if (!bestNeed || bestRecIdx < 0) {
    return { boostedRecs: recs, usedNeed: null };
  }

  // Boost the matched PC's priority with latent need score (weighted 0.2)
  const boosted = recs.map((r, i) => {
    if (i === bestRecIdx) {
      const currentPrio = r.priorite || 50;
      const boost = bestNeed!.score * 20; // 0-20 points boost
      return {
        ...r,
        priorite: Math.min(100, currentPrio + boost),
        latent_need: bestNeed!.besoin_infere,
        latent_need_score: bestNeed!.score,
      };
    }
    return r;
  });

  // Re-sort by priority
  boosted.sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0));

  return { boostedRecs: boosted, usedNeed: bestNeed };
}

// ====== CLINICAL FALLBACK HELPERS ======

// Degressive rule: fewer PCs per med as total meds increase
function getMaxPCsPerMed(totalMeds: number): number {
  if (totalMeds <= 1) return 3;
  if (totalMeds === 2) return 2;
  return 1; // 3+ meds → 1 PC each
}

const MAX_RECOMMENDATIONS_PER_MED = 3; // absolute max, overridden by degressive rule
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

// Adds correct French determinant before a product name
function withDeterminant(produit: string): string {
  const p = produit.trim();
  const lower = p.toLowerCase();
  // Already has a determinant
  if (/^(le |la |les |l'|un |une |des |du |ce |cette |ces )/.test(lower)) return p;
  // Starts with vowel or silent h
  if (/^[aeéèêiîoôuûyhœæ]/i.test(lower)) return `l'${p}`;
  // Plurals
  if (lower.endsWith("s") && !lower.endsWith("ss") && !lower.endsWith("us") && !lower.endsWith("is")) return `les ${p}`;
  // Common feminine patterns
  if (/(crème|solution|vitamine|huile|pommade|lotion|gélule|capsule|compresse|bande|poudre|mousse|gelée)/i.test(lower)) return `la ${p}`;
  return `le ${p}`;
}

// Returns true when phrase_conseil names a specific drug that is NOT the current med.
// Prevents "Le tramadol constipe..." from appearing for Doliprane, etc.
function phraseIsForWrongMed(phrase: string, med: any): boolean {
  if (!phrase) return false;
  const lp = phrase.toLowerCase();

  // All identifiers for the current medication (name, molecule, class, aliases)
  const medIds = [
    med.nom_commercial, med.nom, med.molecule, med.dci,
    med.classe, med.classe_therapeutique,
    ...(med.aliases || []),
  ]
    .filter(Boolean)
    .map((s: string) => s.toLowerCase());

  // Pharmaceutical proper nouns that may appear in DB phrases.
  // Add any new molecule names here when seeding drug-specific phrases.
  const DRUG_NAMES_RE = /\b(tramadol|morphine|codéine|codeine|méthotrexate|methotrexate|tamoxifène|tamoxifene|furosémide|furosemide|spironolactone|lithium|valproate|doxycycline|roaccutane|isotrétinoïne|isotretinoine|duloxétine|duloxetine|mirtazapine|venlafaxine|sertraline|escitalopram|prednisone|cortisone|rivaroxaban|sitagliptine|empagliflozine|périndopril|perindopril|losartan|propranolol|clonazépam|clonazepam|liraglutide|lercanidipine|amoxicilline|ibuprofène|ibuprofen|diclofénac|diclofenac|kétoprofène|ketoprofen|atorvastatine|rosuvastatine|simvastatine|amlodipine|oméprazole|pantoprazole)\b/gi;

  const mentions = (lp.match(DRUG_NAMES_RE) || []).map((d: string) => d.toLowerCase());
  if (mentions.length === 0) return false; // phrase doesn't name any specific drug → keep it

  // Phrase is valid if at least one mentioned drug matches the current med
  for (const drug of mentions) {
    if (medIds.some((id: string) => id.includes(drug) || drug.includes(id.split(" ")[0]))) {
      return false;
    }
  }
  return true; // named drug(s) don't match current med → regenerate
}

const MEDICAMENT_AS_PC_RE = /\b(doliprane|dafalgan|efferalgan|parac[eé]tamol|ibuprof[eè]ne|nurofen|advil|spedifen|aspirine|kardegic|amoxicilline|augmentin|clamoxyl|cod[eé]ine|tramadol|morphine|spasfon|smecta|gaviscon|om[eé]prazole|esomeprazole|pantoprazole|aerius|cetirizine|levocetirizine)\b/i;

function looksLikeMedicationRecommendation(produit: string | undefined | null): boolean {
  return MEDICAMENT_AS_PC_RE.test(produit || "");
}

// Medical phrase generator: [pathologie/conséquence] + [mécanisme produit] + [bénéfice précis]
// Rules: 15-25 words, no "confort"/"bien-être"/"au quotidien", must contain medical mechanism
function generatePhraseConseil(rec: any, med: any): string {
  const produit = rec.produit || "ce produit";
  const pathologie = (rec.pathologie || "").toLowerCase();
  const categorie = (rec.categorie || "").toLowerCase();
  const description = (rec.description || "").toLowerCase();
  const medName = med.nom_commercial || med.nom || "";
  const classe = (med.classe || med.classe_therapeutique || "").toLowerCase();
  const latentNeed = (rec.latent_need || "").toLowerCase();

  // If rec already has a validated phrase_patient from latent_needs, use it
  if (rec.phrase_patient && !containsForbiddenWords(rec.phrase_patient)) return rec.phrase_patient;

  // Try specific medical mechanism matching
  const phrase = buildMedicalPhrase(produit, pathologie, categorie, description, medName, classe, latentNeed);

  // Validate: reject generic phrases
  if (containsForbiddenWords(phrase)) {
    return buildFallbackMedical(produit, medName, classe, description);
  }
  return phrase;
}

function containsForbiddenWords(phrase: string): boolean {
  const forbidden = ["confort", "bien-être", "au quotidien", "bien être"];
  const lower = phrase.toLowerCase();
  return forbidden.some(w => lower.includes(w));
}

function buildMedicalPhrase(produit: string, pathologie: string, categorie: string, description: string, medName: string, classe: string, latentNeed: string): string {
  const p  = withDeterminant(produit);
  const cat = categorie;
  const mn  = medName ? medName.split(" ")[0] : "";
  const cl  = classe || "";

  // Article + élision française : "Le Doliprane" / "L'Amoxicilline" / "L'Augmentin"
  // Pas de "Le Amoxicilline" qui blesse les yeux du patient.
  function articulate(name: string): string {
    if (!name) return "Ce médicament";
    const first = name[0].toLowerCase();
    // Voyelles + H muet → élision
    if (/[aeiouhâàéèêëîïôöùûü]/.test(first)) return `L'${name}`;
    return `Le ${name}`;
  }

  // Contexte naturel selon la classe — langage pharmacien parlant à un patient.
  function medCtx(): string {
    if (cl.includes("opioïde") || cl.includes("opiacé"))                        return mn ? articulate(mn) : "Ce médicament contre la douleur";
    if (cl.includes("corticoïde"))                                               return mn ? articulate(mn) : "La cortisone";
    if (cl.includes("antibiotique") || cl.includes("anti-infect"))               return mn ? articulate(mn) : "Cet antibiotique";
    if (cl.includes("ains") || cl.includes("anti-inflamm"))                      return mn ? articulate(mn) : "Cet anti-inflammatoire";
    if (cl.includes("antidépresseur") || cl.includes("isrs") || cl.includes("irsn")) return mn ? articulate(mn) : "Cet antidépresseur";
    if (cl.includes("diurétique"))                                               return mn ? articulate(mn) : "Ce diurétique";
    if (cl.includes("statine"))                                                  return mn ? articulate(mn) : "Cette statine";
    if (cl.includes("antiépileptique") || cl.includes("anticonvulsivant"))       return mn ? articulate(mn) : "Ce traitement antiépileptique";
    if (cl.includes("bêta-bloquant"))                                            return mn ? articulate(mn) : "Ce bêta-bloquant";
    if (cl.includes("ipp") || cl.includes("inhibiteur de la pompe"))             return mn ? articulate(mn) : "Ce médicament pour l'estomac";
    if (cl.includes("chimiothérapie") || cl.includes("anticancéreux"))           return mn ? articulate(mn) : "Ce traitement contre le cancer";
    if (cl.includes("antihypertenseur") || cl.includes("cardiovasculaire"))      return mn ? articulate(mn) : "Ce traitement pour le cœur";
    if (mn) return articulate(mn);
    return "Votre médicament";
  }

  // === PROBIOTIQUES / FLORE ===
  if (cat.includes("probiotique") || cat.includes("flore") || produit.toLowerCase().includes("probiotique") || produit.toLowerCase().includes("ultra levure") || produit.toLowerCase().includes("saccharomyces")) {
    if (cl.includes("antibiotique") || cl.includes("anti-infect") || medName.toLowerCase().includes("amoxicilline") || medName.toLowerCase().includes("augmentin") || medName.toLowerCase().includes("clamoxyl")) {
      return `${medCtx()} détruit aussi les bonnes bactéries de l'intestin. ${p} aide à protéger votre ventre et éviter la diarrhée.`;
    }
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La gastro perturbe votre flore intestinale. ${p} aide à la remettre d'aplomb et à accélérer la guérison.`;
    }
    if (cl.includes("ipp") || medName.toLowerCase().includes("oméprazole") || medName.toLowerCase().includes("pantoprazole")) {
      return `${medCtx()} modifie l'acidité de l'estomac et fragilise votre flore intestinale. ${p} aide à maintenir l'équilibre.`;
    }
    if (cl.includes("chimiothérapie") || cl.includes("anticancéreux") || cl.includes("immunosuppresseur")) {
      return `${medCtx()} fragilise les défenses naturelles de l'intestin. ${p} aide à soutenir votre flore et limiter les troubles digestifs.`;
    }
    return `${medCtx()} peut fragiliser votre flore intestinale. ${p} aide à maintenir l'équilibre de votre ventre.`;
  }

  // === RÉHYDRATATION ===
  if (cat.includes("réhydratation") || cat.includes("hydratation") || produit.toLowerCase().includes("réhydratation") || produit.toLowerCase().includes("sro")) {
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La diarrhée fait perdre beaucoup d'eau et de minéraux. ${p} aide à vous réhydrater rapidement et efficacement.`;
    }
    if (cl.includes("antibiotique")) {
      return `${medCtx()} peut provoquer des diarrhées qui déshydratent. ${p} aide à compenser cette perte en eau.`;
    }
    if (cl.includes("diurétique")) {
      return `${medCtx()} vous fait uriner davantage. ${p} aide à compenser la perte en eau et en sels minéraux.`;
    }
    return `${medCtx()} peut entraîner une perte en eau. ${p} aide à rester bien hydraté pendant le traitement.`;
  }

  // === PANSEMENT GASTRIQUE / PROTECTEUR ===
  if (cat.includes("pansement") || produit.toLowerCase().includes("pansement") || produit.toLowerCase().includes("gaviscon") || produit.toLowerCase().includes("smecta")) {
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `Après une gastro, le ventre reste souvent irrité. ${p} apaise et protège la paroi de l'intestin.`;
    }
    if (cl.includes("ains") || cl.includes("anti-inflamm") || medName.toLowerCase().includes("ibuprofène") || medName.toLowerCase().includes("nurofen") || medName.toLowerCase().includes("advil") || medName.toLowerCase().includes("diclofénac")) {
      return `${medCtx()} peut irriter l'estomac et provoquer des brûlures. ${p} protège la paroi de l'estomac.`;
    }
    if (pathologie.includes("reflux")) {
      return `Le reflux fait remonter l'acide dans la gorge. ${p} forme un bouclier qui empêche ces remontées.`;
    }
    if (cl.includes("corticoïde")) {
      return `${medCtx()} peut irriter l'estomac avec le temps. ${p} le protège pendant toute la durée du traitement.`;
    }
    return `${medCtx()} peut irriter l'estomac. ${p} le protège et soulage les brûlures.`;
  }

  // === IPP / PROTECTEUR GASTRIQUE ===
  if (cat.includes("ipp") || cat.includes("protecteur gastrique") || produit.toLowerCase().includes("oméprazole") || produit.toLowerCase().includes("pantoprazole") || produit.toLowerCase().includes("esoméprazole")) {
    if (cl.includes("ains") || cl.includes("anti-inflamm") || medName.toLowerCase().includes("ibuprofène") || medName.toLowerCase().includes("diclofénac")) {
      return `${medCtx()} pris régulièrement peut abîmer l'estomac. ${p} réduit l'acidité et protège contre les ulcères.`;
    }
    if (cl.includes("corticoïde")) {
      return `${medCtx()} peut provoquer des ulcères à l'estomac. ${p} protège la paroi en réduisant l'acidité.`;
    }
    if (cl.includes("anticoagulant") || cl.includes("antiagrégant")) {
      return `${medCtx()} augmente le risque de saignement dans l'estomac. ${p} réduit ce risque en protégeant la paroi.`;
    }
    return `${medCtx()} peut augmenter l'acidité de l'estomac. ${p} le protège et évite les brûlures.`;
  }

  // === CHARBON ACTIF ===
  if (produit.toLowerCase().includes("charbon")) {
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La diarrhée s'accompagne souvent de gaz et de ballonnements. ${p} absorbe les toxines dans l'intestin et soulage rapidement.`;
    }
    return `${medCtx()} peut provoquer des ballonnements ou des gaz. ${p} absorbe les substances irritantes dans l'intestin.`;
  }

  // === SPRAY NASAL / LAVAGE NASAL ===
  if (cat.includes("nasal") || produit.toLowerCase().includes("spray nasal") || produit.toLowerCase().includes("physiomer") || produit.toLowerCase().includes("sterimar") || produit.toLowerCase().includes("décongestionnant")) {
    if (pathologie.includes("allergie") || cl.includes("antihistaminique")) {
      return `L'allergie bouche le nez et irrite les muqueuses. ${p} nettoie les voies nasales et soulage la congestion.`;
    }
    if (pathologie.includes("rhume") || pathologie.includes("rhinite") || pathologie.includes("sinusite")) {
      return `Le nez bouché peut vite mener à une sinusite. ${p} dégage les voies nasales et évite la surinfection.`;
    }
    return `${medCtx()} peut assécher ou irriter les voies nasales. ${p} aide à garder les muqueuses bien hydratées.`;
  }

  // === COLLYRE / LARMES ARTIFICIELLES ===
  if (cat.includes("collyre") || cat.includes("ophtalmique") || produit.toLowerCase().includes("collyre") || produit.toLowerCase().includes("larmes") || produit.toLowerCase().includes("hyabak") || produit.toLowerCase().includes("théalose")) {
    if (pathologie.includes("allergie") || cl.includes("antihistaminique")) {
      return `L'allergie irrite les yeux et provoque des démangeaisons. ${p} calme les yeux et soulage les picotements.`;
    }
    if (cl.includes("antidépresseur") || cl.includes("anticholinergique") || cl.includes("bêta-bloquant")) {
      return `${medCtx()} peut provoquer des yeux secs. ${p} lubrifie et hydrate les yeux pour éviter l'inconfort.`;
    }
    return `${medCtx()} peut assécher les yeux. ${p} hydrate la surface de l'œil et soulage les picotements.`;
  }

  // === LAXATIF ===
  if (cat.includes("laxatif") || produit.toLowerCase().includes("laxatif") || produit.toLowerCase().includes("macrogol") || produit.toLowerCase().includes("movicol") || produit.toLowerCase().includes("forlax")) {
    if (cl.includes("opioïde") || cl.includes("opiacé") || medName.toLowerCase().includes("codéine") || medName.toLowerCase().includes("tramadol") || medName.toLowerCase().includes("morphine") || medName.toLowerCase().includes("oxycodone")) {
      return `${medCtx()} bloque presque toujours le transit. ${p} est indispensable dès le premier jour pour éviter la constipation.`;
    }
    if (cl.includes("antidépresseur") || cl.includes("antipsychotique")) {
      return `${medCtx()} ralentit souvent le transit intestinal. ${p} aide à garder un ventre qui fonctionne normalement.`;
    }
    if (cl.includes("fer")) {
      return `Le fer constipe très souvent. ${p} aide à réguler le transit et rend la cure beaucoup plus supportable.`;
    }
    return `${medCtx()} peut ralentir le transit. ${p} aide à rester régulier pendant le traitement.`;
  }

  // === FIBRES / PSYLLIUM ===
  if (produit.toLowerCase().includes("fibre") || produit.toLowerCase().includes("psyllium")) {
    if (cl.includes("opioïde") || cl.includes("opiacé")) {
      return `${medCtx()} bloque le transit. ${p} ramollit les selles et facilite leur passage naturellement.`;
    }
    return `${medCtx()} peut rendre le transit paresseux. ${p} régule naturellement le transit intestinal.`;
  }

  // === MAGNÉSIUM ===
  if (produit.toLowerCase().includes("magnésium") || cat.includes("magnésium")) {
    if (cl.includes("diurétique")) {
      return `${medCtx()} fait éliminer le magnésium dans les urines. ${p} compense cette perte et évite les crampes.`;
    }
    if (cl.includes("ipp") || medName.toLowerCase().includes("oméprazole") || medName.toLowerCase().includes("pantoprazole")) {
      return `${medCtx()} pris longtemps peut faire baisser le magnésium dans le sang. ${p} prévient les crampes et la fatigue.`;
    }
    if (cl.includes("corticoïde")) {
      return `${medCtx()} diminue les réserves en magnésium de l'organisme. ${p} compense ce manque et réduit la fatigue musculaire.`;
    }
    if (pathologie.includes("douleur") || pathologie.includes("migraine")) {
      return `La douleur et le stress épuisent les réserves en magnésium. ${p} aide à détendre les muscles et réduire les tensions.`;
    }
    if (cl.includes("antidépresseur") || cl.includes("anxiolytique")) {
      return `${medCtx()} peut augmenter la consommation de magnésium. ${p} aide à soutenir le système nerveux et réduire la fatigue.`;
    }
    return `${medCtx()} augmente les besoins en magnésium. ${p} aide à éviter les crampes, la fatigue et l'irritabilité.`;
  }

  // === COENZYME Q10 ===
  if (produit.toLowerCase().includes("coenzyme") || produit.toLowerCase().includes("q10")) {
    if (cl.includes("statine") || medName.toLowerCase().includes("atorvastatine") || medName.toLowerCase().includes("rosuvastatine") || medName.toLowerCase().includes("simvastatine") || medName.toLowerCase().includes("pravastatine")) {
      return `${medCtx()} peut provoquer des douleurs ou une faiblesse musculaire. ${p} aide à réduire ces effets et redonner de l'énergie.`;
    }
    if (cl.includes("bêta-bloquant") || cl.includes("antihypertenseur")) {
      return `${medCtx()} peut provoquer de la fatigue. ${p} aide à maintenir l'énergie et soutient le cœur.`;
    }
    return `${medCtx()} peut épuiser les réserves d'énergie de l'organisme. ${p} aide à réduire la fatigue musculaire.`;
  }

  // === BAIN DE BOUCHE / SOIN BUCCAL ===
  if (produit.toLowerCase().includes("bain de bouche") || produit.toLowerCase().includes("antiseptique buccal") || cat.includes("buccal")) {
    if (cl.includes("corticoïde") || medName.toLowerCase().includes("budésonide") || medName.toLowerCase().includes("béclométasone") || medName.toLowerCase().includes("fluticasone")) {
      return `${medCtx()} inhalé peut laisser des dépôts dans la bouche et provoquer des infections. ${p} prévient ce risque.`;
    }
    if (cl.includes("chimiothérapie") || cl.includes("anticancéreux") || cl.includes("immunosuppresseur")) {
      return `${medCtx()} peut provoquer des plaies dans la bouche. ${p} soulage et aide la guérison.`;
    }
    if (cl.includes("antibiotique")) {
      return `${medCtx()} peut provoquer des infections à champignons dans la bouche. ${p} aide à les prévenir.`;
    }
    return `${medCtx()} peut fragiliser la bouche. ${p} protège les gencives et la muqueuse buccale.`;
  }

  // === VITAMINE D / CALCIUM ===
  if (produit.toLowerCase().includes("vitamine d") || produit.toLowerCase().includes("calcium") || cat.includes("vitamine d") || cat.includes("calcium")) {
    if (cl.includes("corticoïde")) {
      return `${medCtx()} fragilise les os avec le temps. ${p} aide à les protéger et évite l'ostéoporose.`;
    }
    if (cl.includes("ipp") || medName.toLowerCase().includes("oméprazole") || medName.toLowerCase().includes("pantoprazole")) {
      return `${medCtx()} pris longtemps peut diminuer l'absorption du calcium. ${p} protège vos os pendant le traitement.`;
    }
    if (cl.includes("antiépileptique") || cl.includes("anticonvulsivant")) {
      return `${medCtx()} peut fragiliser les os sur la durée. ${p} aide à garder des os solides.`;
    }
    return `${medCtx()} peut affecter les os sur le long terme. ${p} aide à maintenir un bon capital osseux.`;
  }

  // === FER ===
  if (produit.toLowerCase().includes("fer") || cat.includes("fer") || cat.includes("anémie")) {
    if (cl.includes("ipp") || medName.toLowerCase().includes("oméprazole") || medName.toLowerCase().includes("pantoprazole")) {
      return `${medCtx()} réduit l'acidité de l'estomac et peut gêner l'absorption du fer. ${p} aide à prévenir la fatigue et l'anémie.`;
    }
    if (cl.includes("antibiotique")) {
      return `${medCtx()} peut réduire l'absorption du fer. ${p} aide à prévenir l'anémie pendant le traitement.`;
    }
    return `${medCtx()} peut réduire l'absorption du fer dans l'organisme. ${p} aide à prévenir la fatigue et l'anémie.`;
  }

  // === VITAMINE B / ACIDE FOLIQUE ===
  if (produit.toLowerCase().includes("vitamine b") || produit.toLowerCase().includes("b12") || produit.toLowerCase().includes("acide folique") || produit.toLowerCase().includes("folique")) {
    if (cl.includes("metformine") || medName.toLowerCase().includes("metformine") || medName.toLowerCase().includes("glucophage")) {
      return `${medCtx()} peut faire baisser la vitamine B12 avec le temps. ${p} prévient la fatigue et les fourmillements dans les jambes.`;
    }
    if (cl.includes("méthotrexate") || medName.toLowerCase().includes("méthotrexate")) {
      return `${medCtx()} consomme les réserves en acide folique. ${p} doit être pris le lendemain de la prise pour réduire les effets secondaires.`;
    }
    if (cl.includes("antiépileptique") || cl.includes("anticonvulsivant")) {
      return `${medCtx()} peut diminuer les vitamines B dans le sang. ${p} aide à prévenir la fatigue et les fourmillements.`;
    }
    return `${medCtx()} peut réduire les vitamines B dans l'organisme. ${p} aide à prévenir la fatigue et les carences.`;
  }

  // === ANTISEPTIQUE / CICATRISANT ===
  if (cat.includes("antiseptique") || cat.includes("cicatrisant") || produit.toLowerCase().includes("antiseptique") || produit.toLowerCase().includes("cicatrisant")) {
    if (cl.includes("anticoagulant") || cl.includes("antiagrégant")) {
      return `${medCtx()} ralentit la coagulation et les petites plaies cicatrisent moins vite. ${p} aide à prévenir l'infection et à guérir.`;
    }
    if (cl.includes("corticoïde") || cl.includes("immunosuppresseur")) {
      return `${medCtx()} ralentit la cicatrisation. ${p} protège la plaie contre les infections et aide à guérir.`;
    }
    return `Les plaies cutanées doivent être bien protégées. ${p} désinfecte et favorise la cicatrisation.`;
  }

  // === CRÈME / ÉMOLLIENT / HYDRATANT ===
  if (cat.includes("émollient") || cat.includes("crème") || cat.includes("dermocosmétique") || produit.toLowerCase().includes("émollient") || produit.toLowerCase().includes("dexeryl") || produit.toLowerCase().includes("cicaplast")) {
    if (cl.includes("rétinoïde") || medName.toLowerCase().includes("isotrétinoïne") || medName.toLowerCase().includes("roaccutane") || medName.toLowerCase().includes("trétinoïne")) {
      return `${medCtx()} assèche beaucoup la peau. ${p} est indispensable pour éviter les crevasses et l'inconfort.`;
    }
    if (cl.includes("corticoïde") || pathologie.includes("eczéma") || pathologie.includes("dermatite") || pathologie.includes("psoriasis")) {
      return `L'eczéma fragilise la peau et casse sa protection naturelle. ${p} restaure cette barrière et réduit les poussées.`;
    }
    if (cl.includes("chimiothérapie") || cl.includes("anticancéreux")) {
      return `${medCtx()} assèche et abîme souvent la peau. ${p} la protège et limite l'inconfort.`;
    }
    return `${medCtx()} peut assécher la peau. ${p} l'hydrate en profondeur et restaure sa protection.`;
  }

  // === PROTECTION SOLAIRE ===
  if (cat.includes("solaire") || produit.toLowerCase().includes("spf") || produit.toLowerCase().includes("solaire")) {
    if (cl.includes("antibiotique") || medName.toLowerCase().includes("doxycycline") || medName.toLowerCase().includes("cycline")) {
      return `${medCtx()} rend la peau très sensible au soleil. ${p} est indispensable pour éviter les brûlures, même par temps nuageux.`;
    }
    if (cl.includes("rétinoïde") || medName.toLowerCase().includes("isotrétinoïne") || medName.toLowerCase().includes("roaccutane")) {
      return `${medCtx()} rend la peau extrêmement fragile face au soleil. Une protection SPF50+ est indispensable tous les jours.`;
    }
    return `${medCtx()} rend la peau plus sensible au soleil. ${p} protège et évite les brûlures ou taches.`;
  }

  // === ZINC ===
  if (produit.toLowerCase().includes("zinc") || cat.includes("zinc")) {
    if (pathologie.includes("acné") || cl.includes("rétinoïde")) {
      return `L'acné est liée à un excès de sébum et une inflammation. ${p} aide à réduire les boutons et calmer la peau.`;
    }
    return `${medCtx()} peut fragiliser les défenses de la peau. ${p} aide la cicatrisation et renforce l'immunité cutanée.`;
  }

  // === SOINS INTIMES / FLORE VAGINALE ===
  if (cat.includes("intime") || cat.includes("vaginal") || produit.toLowerCase().includes("intime") || produit.toLowerCase().includes("vaginal")) {
    if (cl.includes("antibiotique") || cl.includes("anti-infect")) {
      return `${medCtx()} peut provoquer des mycoses vaginales en éliminant les bonnes bactéries. ${p} rééquilibre la flore intime.`;
    }
    return `${medCtx()} peut fragiliser la flore intime. ${p} aide à la protéger et éviter les irritations.`;
  }

  // === FALLBACK avec description ===
  if (description && description.length > 10) {
    const descClean = description.replace(/\.$/g, "").trim().replace(/^[a-z]/, c => c.toUpperCase());
    if (pathologie) {
      return `${descClean}. ${p} complète votre traitement contre ${pathologie}.`;
    }
    return `${descClean}. ${p} accompagne votre traitement.`;
  }

  // === FALLBACK pathologie ===
  if (pathologie) {
    return `${medCtx()} peut avoir des effets secondaires liés à ${pathologie}. ${p} aide à les soulager.`;
  }

  // === FALLBACK classe ===
  if (cl) {
    return `${medCtx()} peut provoquer certains effets secondaires. ${p} aide à les limiter pendant le traitement.`;
  }

  // === FALLBACK ultime ===
  if (mn) {
    return `${articulate(mn)} peut provoquer des inconforts. ${p} aide à les soulager pendant le traitement.`;
  }
  return `${p} accompagne votre traitement pour en limiter les effets indésirables.`;
}

function buildFallbackMedical(produit: string, medName: string, classe: string, description: string): string {
  const p  = withDeterminant(produit);
  const mn = medName ? medName.split(" ")[0] : "";
  const cl = classe || "";
  // Élision : "L'Amoxicilline" plutôt que "Le Amoxicilline"
  const article = mn && /[aeiouhâàéèêëîïôöùûü]/i.test(mn[0]) ? `L'${mn}` : `Le ${mn}`;
  if (cl) return `Les ${cl} peuvent provoquer des effets secondaires. ${p} aide à les limiter.`;
  if (mn) return `${article} peut provoquer des inconforts. ${p} aide à les soulager pendant le traitement.`;
  return `${p} accompagne votre traitement pour en limiter les effets indésirables.`;
}

// Stopwords used to strip form/packaging/grammatical words when building a
// canonical signature of a product name. Two products whose remaining "core
// tokens" are equal or overlap heavily (Jaccard ≥ 0.6) are considered the same PC.
const PRODUCT_STOPWORDS = new Set<string>([
  "de", "du", "des", "la", "le", "les", "l", "en", "et", "a", "au", "aux", "pour", "avec", "sans",
  "solution", "sachet", "sachets", "comprime", "comprimes", "gelule", "gelules", "capsule", "capsules",
  "gouttes", "goutte", "sirop", "spray", "creme", "gel", "poudre", "ampoule", "ampoules", "stick", "sticks",
  "oral", "orale", "orales", "oraux", "buvable", "buvables", "nasal", "nasale", "nasales",
  "boite", "flacon", "tube", "format", "pack",
]);

function productSignature(produit: string): Set<string> {
  return new Set(
    normalizeText(produit || "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !PRODUCT_STOPWORDS.has(t)),
  );
}

function signaturesEquivalent(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  if (union === 0) return false;
  // Same core OR one is subset of the other OR strong overlap
  if (inter === a.size || inter === b.size) return true;
  return inter / union >= 0.6;
}

function pickDistinctProducts(products: any[], max = MAX_RECOMMENDATIONS_PER_MED) {
  const selected: any[] = [];
  const seenKeys = new Set<string>();
  const seenSigs: Set<string>[] = [];

  for (const product of products || []) {
    const name = product?.produit || "";
    const key = normalizeText(name);
    if (!key || seenKeys.has(key) || !isLowFrictionProduct(name)) continue;
    const sig = productSignature(name);
    if (seenSigs.some((existing) => signaturesEquivalent(existing, sig))) continue;
    seenKeys.add(key);
    seenSigs.push(sig);
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

const OCR_MODEL = "google/gemini-2.5-flash";
const TEXT_MODEL = "google/gemini-2.5-flash";

async function callAI(apiKey: string, messages: any[], temperature = 0.1, model = TEXT_MODEL) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 4096,
    }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    const errText = await response.text();
    console.error("AI response error:", response.status, errText);
    throw new Error(`AI error: ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  
  // Extract JSON from response (handle markdown fences, mixed text, etc.)
  let jsonStr = content.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // Try to find JSON object in the text
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      jsonStr = jsonObjMatch[0];
    }
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error("Failed to parse AI response as JSON:", content.substring(0, 200));
    throw new Error("AI returned non-JSON response");
  }
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
    // ====== AUTH CHECK ======
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const token = authHeader.replace("Bearer ", "");
    // Allow service-role calls (used by internal functions like scanner-webhook).
    // For all other callers, require a valid user session validated server-side via getUser().
    let userIdFromAuth: string | null = null;
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIdFromAuth = userData.user.id;
    }
    const claimsData = userIdFromAuth ? { claims: { sub: userIdFromAuth } } : null;

    const body = await req.json();
    const { prescriptionText, imageBase64, basketSessionId, blockedProducts } = body;

    // Payload size limits to prevent resource exhaustion / quota abuse
    const MAX_TEXT_CHARS = 10_000;
    const MAX_IMAGE_B64_CHARS = 6_700_000; // ~5 MB binary
    if (typeof prescriptionText === "string" && prescriptionText.length > MAX_TEXT_CHARS) {
      return new Response(
        JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: `prescriptionText dépasse ${MAX_TEXT_CHARS} caractères` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof imageBase64 === "string" && imageBase64.length > MAX_IMAGE_B64_CHARS) {
      return new Response(
        JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "Image trop volumineuse (max ~5 MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ====== PHARMACY STATUS + QUOTA CHECK (server-side, atomic, multi-PC safe) ======
    try {
      const userId = claimsData?.claims?.sub;
      if (!userId) throw new Error("__skip_quota__");
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", userId)
        .maybeSingle();
      const pharmacyIdForQuota = (profile as any)?.pharmacy_id;
      if (pharmacyIdForQuota) {
        // Block suspended/disabled pharmacies at the API layer
        const { data: pharm } = await supabase
          .from("pharmacies")
          .select("status")
          .eq("id", pharmacyIdForQuota)
          .maybeSingle();
        const pharmStatus = (pharm as any)?.status;
        if (pharmStatus === "paused" || pharmStatus === "disabled") {
          return new Response(
            JSON.stringify({
              error: "PHARMACY_SUSPENDED",
              message: pharmStatus === "paused"
                ? "L'accès de cette pharmacie a été mis en pause. Contactez Asclion."
                : "L'accès de cette pharmacie a été désactivé. Contactez Asclion.",
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data: quotaRes, error: quotaErr } = await supabase.rpc("check_and_increment_quota", {
          _pharmacy_id: pharmacyIdForQuota,
          _quota_type: "analysis",
        });
        if (quotaErr) {
          console.error("Quota RPC error:", quotaErr);
        } else if (quotaRes && (quotaRes as any).allowed === false) {
          return new Response(
            JSON.stringify({
              error: "QUOTA_EXCEEDED",
              message: "Quota journalier d'analyses atteint.",
              quota: quotaRes,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Also increment monthly AI call counter (non-blocking on failure)
        supabase.rpc("check_and_increment_quota", {
          _pharmacy_id: pharmacyIdForQuota,
          _quota_type: "ai_call",
        }).then(() => {}, (e: any) => console.error("ai_call quota error:", e));
      }
    } catch (qErr) {
      console.error("Quota / status check failed (non-blocking):", qErr);
    }

    // Parse blocked products from basket context (anti-loop)
    const blockedPCSet = new Set<string>(
      (blockedProducts || []).map((p: string) => normalizeText(p))
    );

    // ====== STEP 1 + PRELOADS IN PARALLEL ======
    // Launch AI extraction AND global data preloads simultaneously
    let medEntries: { nom_commercial: string; molecule_probable?: string; confiance?: string }[] = [];
    let extractedPatientName: string | null = null;

    // Build AI extraction promise
    let aiExtractionPromise: Promise<any>;
    if (imageBase64) {
      console.log("Using OCR model (gemini-2.5-flash) for handwritten prescription analysis");
      aiExtractionPromise = callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extrais les noms de médicaments et le nom du patient de cette ordonnance. L'écriture peut être manuscrite et difficile à lire — utilise le contexte médical pour interpréter." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ]},
      ], 0.1, OCR_MODEL);
    } else if (prescriptionText) {
      aiExtractionPromise = callAI(LOVABLE_API_KEY, [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extrais les médicaments et le nom du patient :\n\n${prescriptionText}` },
      ], 0.1, TEXT_MODEL);
    } else {
      return new Response(JSON.stringify({ error: "Aucune donnée d'ordonnance fournie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preload global data in parallel with AI call
    const [aiResult, protocolesRes, legacyProtocolsRes, latentNeedsPreload, pharmacyIdForMapping] = await Promise.all([
      aiExtractionPromise,
      supabase
        .from("protocole_pathologie")
        .select(`
          id, pathologie_id, actif,
          conseil_1:conseils_associes!protocole_pathologie_conseil_1_id_fkey(conseil, description),
          conseil_2:conseils_associes!protocole_pathologie_conseil_2_id_fkey(conseil, description),
          produit_1:produits_complementaires!protocole_pathologie_produit_complementaire_1_id_fkey(produit, categorie, description, priorite, phrase_conseil),
          produit_2:produits_complementaires!protocole_pathologie_produit_complementaire_2_id_fkey(produit, categorie, description, priorite, phrase_conseil),
          produit_3:produits_complementaires!protocole_pathologie_produit_complementaire_3_id_fkey(produit, categorie, description, priorite, phrase_conseil),
          justification_1, justification_2, justification_3,
          priorite_produit_1, priorite_produit_2, priorite_produit_3,
          pathologies(nom_pathologie)
        `)
        .eq("actif", true),
      supabase
        .from("pathology_protocol")
        .select("pathologie, conseil, produit_1, produit_2, priority")
        .order("priority", { ascending: false }),
      supabase.from("latent_needs").select("*").order("score", { ascending: false }),
      getPharmacyIdFromAuth(supabase, authHeader),
    ]);

    medEntries = aiResult.medicaments_detectes || [];
    extractedPatientName = aiResult.patient_nom || null;

    if (medEntries.length === 0) {
      return new Response(JSON.stringify({
        medicaments: [], interactions: [], contextes: [], conseil: "", sources: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const medNames = medEntries.map((m: any) => typeof m === "string" ? m : m.nom_commercial);
    const medMolecules = medEntries.map((m: any) => typeof m === "string" ? null : m.molecule_probable);
    const medHints = medEntries.map((m: any) => typeof m === "string" ? {} : {
      voie_administration: m.voie_administration || null,
      forme_galenique: m.forme_galenique || null,
      dosage: m.dosage || null,
    });

    const protocoles = protocolesRes.data;
    const legacyProtocols = legacyProtocolsRes.data;
    const allLatentNeedsData = latentNeedsPreload.data || [];

    // ====== STEP 2: Clinical + Legacy lookups in PARALLEL per med ======
    const sources: string[] = [];
    const allDbConseils: any[] = [];
    const allDbProduits: any[] = [];

    // Launch ALL clinical lookups + legacy lookups simultaneously
    const [clinicalLookupResults, dbMeds] = await Promise.all([
      Promise.all(medNames.map((name, i) => clinicalLookup(supabase, name, medMolecules[i], medHints[i]))),
      Promise.all(medNames.map((name) => {
        const n = name.trim().toLowerCase();
        return (async () => {
          let { data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("nom_commercial", n).limit(1);
          if (data?.length > 0) return { ...data[0], matched: true };
          ({ data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("molecule_active", `%${n}%`).limit(1));
          if (data?.length > 0) return { ...data[0], matched: true };
          ({ data } = await supabase.from("medications").select("*, therapeutic_classes(*)").ilike("nom_commercial", `%${n}%`).limit(1));
          if (data?.length > 0) return { ...data[0], matched: true };
          return { nom_commercial: name, matched: false };
        })();
      })),
    ]);

    // Process clinical results
    const clinicalResults: any[] = [];
    for (let i = 0; i < clinicalLookupResults.length; i++) {
      const clinical = clinicalLookupResults[i];
      if (clinical) {
        clinicalResults.push({ index: i, ...clinical });
        if (clinical.conseils) allDbConseils.push(...clinical.conseils);
        if (clinical.produits) allDbProduits.push(...clinical.produits);
        if (!sources.includes("Base clinique Asclion")) sources.push("Base clinique Asclion");
      }
    }

    // ====== STEP 3: Enrich unmatched meds with external APIs IN PARALLEL ======
    const enrichedMeds: any[] = new Array(medNames.length);

    // Separate meds into clinical-matched, db-matched, and need-enrichment
    const needsEnrichment: number[] = [];
    for (let i = 0; i < medNames.length; i++) {
      const clinical = clinicalResults.find((c) => c.index === i);
      const dbMed = dbMeds[i];

      if (clinical?.found) {
        enrichedMeds[i] = {
          nom_commercial: clinical.medicament?.nom_commercial || medNames[i],
          molecule_active: clinical.molecule?.nom || null,
          code_atc: clinical.molecule?.atc_code || clinical.classe_atc?.code || null,
          classe_therapeutique: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || null,
          therapeutic_classes: { nom: clinical.molecule?.classe_therapeutique || clinical.classe_atc?.nom || "" },
          matched: true,
          clinical_kb: true,
          pathologies: clinical.pathologies || [],
          curated_pcs: clinical.curated_pcs || [],
        };

      } else if (dbMed?.matched) {
        enrichedMeds[i] = { ...dbMed, clinical_kb: false };
        if (!sources.includes("Base Asclion (données structurées)")) sources.push("Base Asclion (données structurées)");
      } else {
        needsEnrichment.push(i);
      }
    }

    // Enrich all unmatched meds in parallel
    await Promise.all(needsEnrichment.map(async (i) => {
      const dbMed = dbMeds[i];
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
          { role: "user", content: `Médicament : ${medNames[i]}${medMolecules[i] ? ` (DCI probable: ${medMolecules[i]})` : ""}${medHints[i]?.dosage ? ` — dosage: ${medHints[i].dosage}` : ""}${medHints[i]?.forme_galenique ? ` — forme: ${medHints[i].forme_galenique}` : ""}${medHints[i]?.voie_administration ? ` — voie: ${medHints[i].voie_administration} (IMPORTANT: respecte strictement cette voie d'administration, ne propose pas d'indications d'autres voies)` : ""}` },
        ]);
        enrichedMeds[i] = {
          ...dbMed,
          molecule_active: aiData.molecule_active,
          code_atc: aiData.code_atc,
          classe_therapeutique: aiData.classe_therapeutique,
          therapeutic_classes: { nom: aiData.classe_therapeutique },
          matched: true,
          ai_enriched: true,
          ai_contexts: aiData.contextes_therapeutiques,
          public_data: publicData,
        };
      } catch (e) {
        console.error("AI enrichment failed:", e);
        enrichedMeds[i] = dbMed;
      }
    }));

    // ====== STEP 3.5: Detect latent needs (already preloaded) ======
    const normalized = medNames.map((n) => normalizeText(extractCoreDrugName(n)));
    const latentNeeds: LatentNeed[] = [];
    const seenBesoins = new Set<string>();
    const comboKey = [...normalized].sort().join("+");
    for (const need of allLatentNeedsData) {
      const needKey = normalizeText(need.medicament_source);
      if (needKey.includes("+") && comboKey.includes(needKey.replace("+", "")) && !seenBesoins.has(need.besoin_infere)) {
        latentNeeds.push(need);
        seenBesoins.add(need.besoin_infere);
      }
    }
    for (const medNorm of normalized) {
      for (const need of allLatentNeedsData) {
        if (seenBesoins.has(need.besoin_infere)) continue;
        const needKey = normalizeText(need.medicament_source);
        if (needKey.includes("+")) continue;
        if (medNorm.includes(needKey) || needKey.includes(medNorm)) {
          latentNeeds.push(need);
          seenBesoins.add(need.besoin_infere);
        }
      }
    }
    let latentNeedUsed = false;
    let usedLatentNeed: LatentNeed | null = null;

    // Load pharmacy product mappings + groupement mappings + medication-forced mappings
    let productMappings: any[] = [];
    let groupMappings: any[] = [];
    let medForcedMappings: any[] = [];
    if (pharmacyIdForMapping) {
      const { data: mappings } = await supabase
        .from("product_mapping")
        .select("categorie, produit_selectionne, cip_code")
        .eq("pharmacy_id", pharmacyIdForMapping)
        .eq("active", true);
      productMappings = mappings || [];

      const { data: medMaps } = await supabase
        .from("medicament_pc_mapping")
        .select("medicament_nom, pc_nom, pc_categorie")
        .eq("pharmacy_id", pharmacyIdForMapping)
        .eq("active", true);
      medForcedMappings = medMaps || [];

      // Load groupement mapping if pharmacy belongs to one
      const { data: pharma } = await supabase
        .from("pharmacies")
        .select("groupement_id")
        .eq("id", pharmacyIdForMapping)
        .maybeSingle();
      if (pharma?.groupement_id) {
        const { data: gm } = await supabase
          .from("group_product_mapping")
          .select("categorie, produit_prioritaire, cip_code, laboratoire_partenaire, niveau_priorite")
          .eq("groupement_id", pharma.groupement_id)
          .eq("active", true);
        groupMappings = gm || [];
      }
    }


    // Protocols already preloaded

    const allProtocols = [
      ...(protocoles || []).map((p: any) => ({
        ...p,
        pathologie_nom: p.pathologies?.nom_pathologie,
      })),
      ...(legacyProtocols || []).map((p: any) => ({
        ...p,
        pathologie_nom: p.pathologie,
      })),
    ];

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
          if (!sources.includes("Base clinique Asclion")) sources.push("Base clinique Asclion");
        }
      }),
      ...therapeuticClasses.map(async (therapeuticClass) => {
        const recs = await getClassFallbackRecommendations(supabase, therapeuticClass);
        if (recs.length > 0) {
          classFallbackMap.set(therapeuticClass, recs);
          if (!sources.includes("Base clinique Asclion")) sources.push("Base clinique Asclion");
        }
      }),
    ]);

    // Step 4: Build direct recommendations per medication
    const maxPCPerMed = getMaxPCsPerMed(enrichedMeds.length);
    const allContexts: string[] = [];
    let hasStructuredData = clinicalResults.length > 0;
    const medRecommendations: Map<number, any[]> = new Map();
    const medMainAdvice: Map<number, string> = new Map();
    const allProposedPCs: string[] = [];

    // Generic-pathology regex (shared across meds)
    const GENERIC_PATHO_RE = /infection|douleur|fi[èe]vre|inflammation|allergie\b|anti[-\s]?infect|rhume|toux|constipation|diarrh|nause|reflux|spasme|anxi|stress|insomnie|fatigue|carence/i;
    const isGenericPatho = (name: string | undefined | null) =>
      !name || GENERIC_PATHO_RE.test(name);

    // Pre-compute per-med ambiguity:
    // A med is "ambiguous" when it covers ≥2 plausible pathologies AND no OTHER med
    // in the basket converges on a specific (non-generic) pathology with it.
    // Applies to ALL meds — even within a multi-med prescription — so that we never
    // pretend to know a diagnosis when the prescription doesn't make it obvious.
    const ambiguousFlags: boolean[] = enrichedMeds.map((m: any, idx: number) => {
      const ps = (m.pathologies || []) as any[];
      if (ps.length < 2) return false;
      const specificNames = ps
        .map((p) => (p?.nom_pathologie || "").toLowerCase())
        .filter((n) => n && !GENERIC_PATHO_RE.test(n));
      if (specificNames.length === 0) return false;
      // Check convergence with other meds
      for (let j = 0; j < enrichedMeds.length; j++) {
        if (j === idx) continue;
        const otherSpecific = ((enrichedMeds[j].pathologies || []) as any[])
          .map((p: any) => (p?.nom_pathologie || "").toLowerCase())
          .filter((n: string) => n && !GENERIC_PATHO_RE.test(n));
        if (specificNames.some((s) => otherSpecific.includes(s))) {
          return false; // convergence found → not ambiguous
        }
      }
      return true;
    });

    for (let i = 0; i < enrichedMeds.length; i++) {
      const med = enrichedMeds[i];
      const recs: any[] = [];

      // ====== AMBIGUITY GUARD ======
      // See ambiguousFlags computation above.
      const singleMedAmbiguous = ambiguousFlags[i];

      // ====== STRICT CURATED-ONLY MODE (Asclion medicaments finals — 2026-06) ======
      // Decision produit : on NE déduit JAMAIS un PC depuis la pathologie, l'ATC,
      // la classe thérapeutique, un protocole ou la KB clinique. La SEULE source
      // autorisée est `medicament_curated_pcs` (pc_1 + pc_2 du CSV "asclion
      // medicaments finals"). Si un médicament n'a pas d'entrée → 0 reco.
      const curatedForMed = (med.curated_pcs || []) as any[];
      if (curatedForMed.length > 0) {
        const mappedCurated = curatedForMed
          .filter((p: any) => p && p.produit)
          .map((p: any) => ({
            produit: p.produit,
            categorie: p.categorie || "Conseil associé",
            description: p.description || "",
            priorite: Math.max(p.priorite || 0, 95),
            pathologie: "",
            phrase_conseil: p.phrase_conseil || undefined,
            pertinence: p.pertinence || undefined,
          }));
        recs.push(...pickDistinctProducts(mappedCurated, MAX_RECOMMENDATIONS_PER_MED));
        hasStructuredData = true;
      }

      // Apply latent need boost (max 1 per basket, invisible in UX)
      if (!latentNeedUsed && latentNeeds.length > 0) {
        const { boostedRecs, usedNeed } = applyLatentNeedBoost(recs, latentNeeds, latentNeedUsed);
        if (usedNeed) {
          recs.length = 0;
          recs.push(...boostedRecs);
          latentNeedUsed = true;
          usedLatentNeed = usedNeed;
        }
      }

      // Build set of all meds already on the prescription (names + molecules)
      // to avoid recommending a product that the patient is already getting.
      const prescribedSet = new Set<string>();
      for (let k = 0; k < medNames.length; k++) {
        const nm = normalizeText(extractCoreDrugName(medNames[k]));
        if (nm) prescribedSet.add(nm);
        const mol = enrichedMeds[k]?.molecule_active || enrichedMeds[k]?.molecules?.nom_molecule;
        if (mol) prescribedSet.add(normalizeText(mol));
      }

      const isAlreadyPrescribed = (productName: string): boolean => {
        const norm = normalizeText(productName);
        if (!norm) return false;
        for (const p of prescribedSet) {
          if (!p) continue;
          if (norm === p || norm.includes(p) || p.includes(norm)) return true;
        }
        return false;
      };

      // Apply filters: blocked products (anti-loop), cross-med dedup, anti-redundancy with prescription, degressive cap
      let filteredRecs = recs
        .filter((r: any) => !blockedPCSet.has(normalizeText(r.produit)))
        .filter((r: any) => !allProposedPCs.includes(normalizeText(r.produit)))
        .filter((r: any) => !isAlreadyPrescribed(r.produit))
        .filter((r: any) => !looksLikeMedicationRecommendation(r.produit));

      // Apply mappings: groupement first (priority override), then pharmacy
      filteredRecs = filteredRecs.map((r: any) => {
        const catNorm = normalizeText(r.categorie);
        // 1. Groupement mapping (highest priority)
        const gMap = groupMappings.find((m: any) => normalizeText(m.categorie) === catNorm);
        if (gMap) {
          return { ...r, produit: gMap.produit_prioritaire, mapped: true, mapped_source: "groupement", laboratoire: gMap.laboratoire_partenaire || null };
        }
        // 2. Pharmacy mapping
        const pMap = productMappings.find((m: any) => normalizeText(m.categorie) === catNorm);
        if (pMap) {
          return { ...r, produit: pMap.produit_selectionne, mapped: true, mapped_source: "pharmacy" };
        }
        return r;
      });

      // Inject pharmacy-forced med→PC mappings: always proposed first when the medication is detected
      if (medForcedMappings.length > 0) {
        const medNameNorm = normalizeText(med.nom_commercial || med.nom || "");
        const forced = medForcedMappings.filter((fm: any) => {
          const fmNorm = normalizeText(fm.medicament_nom || "");
          return fmNorm && (medNameNorm.includes(fmNorm) || fmNorm.includes(medNameNorm));
        });
        for (const fm of forced) {
          const pcNameNorm = normalizeText(fm.pc_nom);
          // Drop any existing rec of the same PC to avoid duplicates, then prepend
          filteredRecs = filteredRecs.filter((r: any) => normalizeText(r.produit) !== pcNameNorm);
          filteredRecs.unshift({
            produit: fm.pc_nom,
            categorie: fm.pc_categorie || "Recommandation officine",
            description: "Produit favori de votre officine pour ce médicament",
            priorite: 100,
            pathologie: "",
            forced: true,
            mapped: true,
            mapped_source: "pharmacy_med_forced",
          });
        }
      }

      // Final semantic dedupe (same PC must not appear twice for the same med, even
      // when names differ slightly: "Solution de réhydratation orale" / "Sachets de
      // réhydratation orale" / "Solution réhydratation"), then cap to degressive limit.
      const finalRecs = pickDistinctProducts(filteredRecs, maxPCPerMed);


      // Use only curated short DB phrase_conseil (3-7 words). If missing, try a fuzzy DB lookup
      // so every displayed PC has a short phrase. Long auto-generated phrases stay disabled.
      const MAX_WORDS_HINT = 9;
      const normPc = (s: string) => (s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      for (const r of finalRecs) {
        let p = (r.phrase_conseil || "").trim();
        let wc = p ? p.split(/\s+/).length : 0;
        if (!p || wc > MAX_WORDS_HINT || phraseIsForWrongMed(p, med)) {
          // Fuzzy DB fallback: find a row whose normalized produit matches the rec's name
          const key = normPc(r.produit);
          if (key) {
            const head = key.split(" ").slice(0, 2).join(" ");
            const { data: rows } = await supabase
              .from("produits_complementaires")
              .select("produit, phrase_conseil")
              .or(`produit.ilike.%${key}%,produit.ilike.${head}%`)
              .not("phrase_conseil", "is", null)
              .limit(5);
            const hit = (rows || []).find((row: any) => {
              const k = normPc(row.produit);
              const ph = (row.phrase_conseil || "").trim();
              if (!ph) return false;
              const w = ph.split(/\s+/).length;
              if (w > MAX_WORDS_HINT) return false;
              if (phraseIsForWrongMed(ph, med)) return false;
              return k === key || k.startsWith(key) || key.startsWith(k) || (head && k.includes(head));
            });
            if (hit) {
              r.phrase_conseil = hit.phrase_conseil;
              p = hit.phrase_conseil;
              wc = p.split(/\s+/).length;
            } else {
              r.phrase_conseil = null;
            }
          } else {
            r.phrase_conseil = null;
          }
        }
        allProposedPCs.push(normalizeText(r.produit));
      }

      medRecommendations.set(i, finalRecs);
    }

    // Step 5: Check interactions
    const matchedMeds = enrichedMeds.filter((m: any) => m.matched || m.ai_enriched);
    const interactions = checkLocalInteractions(matchedMeds);

    if (matchedMeds.length >= 2) {
      const interactionChecks: Promise<void>[] = [];
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
              const med_i = matchedMeds[i];
              const med_j = matchedMeds[j];
              interactionChecks.push((async () => {
                const fdaInteraction = await openFDAGetInteractions(mol1, mol2);
                if (fdaInteraction) {
                  interactions.push({
                    medicaments: [med_i.nom_commercial, med_j.nom_commercial],
                    niveau: "modérée",
                    description: `${fdaInteraction} (source: OpenFDA)`,
                  });
                  if (!sources.includes("OpenFDA (effets indésirables)")) sources.push("OpenFDA (effets indésirables)");
                }
              })());
            }
          }
        }
      }
      await Promise.all(interactionChecks);
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
      conseil_associe: null,
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

    // Step 8: Save history (fast reads for duplicate/patient info) then send response
    // Background writes happen after response is sent
    let backgroundWritesFn: (() => Promise<void>) | null = null;

    try {
      const pharmacyId = pharmacyIdForMapping;
      
      if (pharmacyId && authHeader && claimsData?.claims?.sub) {
        const userId = claimsData.claims.sub;

        const inputText = prescriptionText || medNames.join(",");
        const encoder = new TextEncoder();
        const prescriptionHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(inputText));
        const prescriptionHash = Array.from(new Uint8Array(prescriptionHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        
        const patientName = extractedPatientName || null;
        const patientSig = patientName ? patientName.trim().toLowerCase().replace(/\s+/g, " ") : medNames.sort().join("|").toLowerCase();
        const patientHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(patientSig));
        const patientHash = Array.from(new Uint8Array(patientHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const hasMajor = interactions.some((inter: any) => inter.niveau === "majeure");

        // Quick parallel reads for duplicate warning + patient history
        const [dupRes, histRes] = await Promise.all([
          supabase.from("analysis_history").select("id, created_at")
            .eq("pharmacy_id", pharmacyId).eq("prescription_hash", prescriptionHash)
            .order("created_at", { ascending: false }).limit(5),
          supabase.from("analysis_history").select("id, created_at")
            .eq("pharmacy_id", pharmacyId).eq("patient_hash", patientHash)
            .order("created_at", { ascending: false }).limit(10),
        ]);

        if (dupRes.data && dupRes.data.length > 0) {
          result.duplicate_warning = { count: dupRes.data.length + 1, last_seen: dupRes.data[0]?.created_at };
        }
        if (histRes.data && histRes.data.length > 0) {
          result.patient_history = {
            previous_analyses: histRes.data.length,
            first_seen: histRes.data[histRes.data.length - 1]?.created_at,
          };
        }

        // Prepare background writes (fire-and-forget after response)
        backgroundWritesFn = async () => {
          try {
            // Log unmatched medications for manual integration
            if (needsEnrichment.length > 0) {
              for (const idx of needsEnrichment) {
                const rawName = medNames[idx];
                const normName = normalizeText(extractCoreDrugName(rawName));
                if (!normName || normName.length < 2) continue;
                try {
                  const { data: existing } = await supabase
                    .from("unmatched_medicaments")
                    .select("id, occurrence_count")
                    .eq("nom_normalise", normName)
                    .maybeSingle();
                  if (existing) {
                    await supabase.from("unmatched_medicaments")
                      .update({ occurrence_count: existing.occurrence_count + 1, last_seen_at: new Date().toISOString() })
                      .eq("id", existing.id);
                  } else {
                    await supabase.from("unmatched_medicaments").insert({
                      nom_saisi: rawName,
                      nom_normalise: normName,
                      occurrence_count: 1,
                      pharmacy_id: pharmacyId,
                      status: "pending",
                    });
                  }
                } catch (unmatchedErr) {
                  console.error("Failed to log unmatched med:", unmatchedErr);
                }
              }
            }

            // Insert analysis history
            await supabase.from("analysis_history").insert({
              pharmacy_id: pharmacyId,
              user_id: userId,
              patient_hash: patientHash,
              prescription_hash: prescriptionHash,
              medicaments: result.medicaments,
              interactions_count: interactions.length,
              suggestions_count: totalRecs,
              has_major_interaction: hasMajor,
              metadata: { sources, contextes_count: allContexts.length, clinical_kb_matches: clinicalResults.length },
            });

            // Track recommendation metrics in parallel
            const metricOps = medicamentsResult.flatMap((med: any) =>
              (med.recommendations || []).map(async (rec: any) => {
                const { data: existing } = await supabase
                  .from("recommendation_metrics")
                  .select("id, times_proposed")
                  .eq("pharmacy_id", pharmacyId)
                  .eq("medicament_source", med.nom)
                  .eq("pc_proposed", rec.produit)
                  .maybeSingle();

                if (existing) {
                  await supabase.from("recommendation_metrics")
                    .update({ times_proposed: existing.times_proposed + 1, times_displayed: existing.times_proposed + 1, updated_at: new Date().toISOString() })
                    .eq("id", existing.id);
                } else {
                  await supabase.from("recommendation_metrics").insert({
                    pharmacy_id: pharmacyId,
                    medicament_source: med.nom,
                    pc_proposed: rec.produit,
                    pc_categorie: rec.categorie || null,
                    times_proposed: 1,
                    times_displayed: 1,
                  });
                }
              })
            );

            // Track latent need metrics
            if (usedLatentNeed) {
              const boostedRec = medicamentsResult
                .flatMap((m: any) => (m.recommendations || []))
                .find((r: any) => r.latent_need);
              
              if (boostedRec) {
                metricOps.push((async () => {
                  const { data: existingLN } = await supabase
                    .from("latent_need_metrics")
                    .select("id, times_proposed")
                    .eq("pharmacy_id", pharmacyId)
                    .eq("besoin", usedLatentNeed!.besoin_infere)
                    .eq("pc_proposed", boostedRec.produit)
                    .maybeSingle();

                  if (existingLN) {
                    await supabase.from("latent_need_metrics")
                      .update({ times_proposed: existingLN.times_proposed + 1, updated_at: new Date().toISOString() })
                      .eq("id", existingLN.id);
                  } else {
                    await supabase.from("latent_need_metrics").insert({
                      pharmacy_id: pharmacyId,
                      besoin: usedLatentNeed!.besoin_infere,
                      medicament_source: usedLatentNeed!.medicament_source,
                      pc_proposed: boostedRec.produit,
                      times_proposed: 1,
                    });
                  }
                })());
              }
            }

            // Basket context
            if (basketSessionId) {
              const proposedList = medicamentsResult.flatMap((m: any) => (m.recommendations || []).map((r: any) => r.produit));
              metricOps.push(
                supabase.from("basket_context").upsert({
                  pharmacy_id: pharmacyId,
                  session_id: basketSessionId,
                  scanned_medicaments: medNames,
                  proposed_pcs: proposedList,
                  active: true,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "pharmacy_id,session_id" }).then(() => {}).catch(() => {
                  return supabase.from("basket_context").insert({
                    pharmacy_id: pharmacyId,
                    session_id: basketSessionId,
                    scanned_medicaments: medNames,
                    proposed_pcs: proposedList,
                    active: true,
                  }).then(() => {});
                })
              );
            }

            await Promise.all(metricOps);
          } catch (bgErr) {
            console.error("Background writes failed:", bgErr);
          }
        };
      }
    } catch (historyErr) {
      console.error("Failed to check analysis history:", historyErr);
    }

    // Send response IMMEDIATELY — don't wait for background writes
    const response = new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Fire-and-forget background writes (Deno edge functions keep running after response)
    if (backgroundWritesFn) {
      backgroundWritesFn().catch((e) => console.error("Background writes error:", e));
    }

    return response;
  } catch (e) {
    console.error("analyze-prescription error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    if (msg === "RATE_LIMIT") return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (msg === "CREDITS_EXHAUSTED") return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
