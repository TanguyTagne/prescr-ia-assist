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

async function clinicalLookup(supabase: any, medName: string, moleculeName?: string | null) {
  let medicament = null;
  let molecule = null;

  const searchVariants = buildSearchVariants(medName);

  // Try each variant: exact match first, then partial
  for (const variant of searchVariants) {
    if (medicament) break;
    const { data: exactMatch } = await supabase
      .from("medicaments")
      .select("*, molecules(*)")
      .ilike("nom_commercial", variant)
      .limit(1)
      .maybeSingle();
    if (exactMatch) {
      medicament = exactMatch;
      molecule = exactMatch.molecules;
    }
  }

  if (!medicament) {
    for (const variant of searchVariants) {
      if (medicament) break;
      const { data: partialMatch } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .ilike("nom_commercial", `%${variant}%`)
        .limit(1)
        .maybeSingle();
      if (partialMatch) {
        medicament = partialMatch;
        molecule = partialMatch.molecules;
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

  // 1) Via molecule_pathologie
  const moleculeId = molecule?.id;
  if (moleculeId) {
    const { data } = await supabase
      .from("molecule_pathologie")
      .select("pathologie_id, pathologies(*)")
      .eq("molecule_id", moleculeId);
    for (const mp of data || []) {
      if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
        pathologieIdSet.add(mp.pathologies.id);
        pathologies.push(mp.pathologies);
      }
    }
  }

  // 2) Via medicament_pathologie (critical for meds without molecule like Gaviscon)
  if (medicament?.id) {
    const { data } = await supabase
      .from("medicament_pathologie")
      .select("pathologie_id, score_pertinence, pathologies(*)")
      .eq("medicament_id", medicament.id)
      .order("score_pertinence", { ascending: false });
    for (const mp of data || []) {
      if (mp.pathologies && !pathologieIdSet.has(mp.pathologies.id)) {
        pathologieIdSet.add(mp.pathologies.id);
        pathologies.push(mp.pathologies);
      }
    }
  }

  const pathologieIds = [...pathologieIdSet];
  let conseils: any[] = [];
  let produits: any[] = [];
  let protocoles: any[] = [];

  if (pathologieIds.length > 0) {
    const [conseilsRes, produitsRes, protocolesRes] = await Promise.all([
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
      supabase
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
        .eq("actif", true),
    ]);
    conseils = conseilsRes.data || [];
    produits = produitsRes.data || [];
    protocoles = protocolesRes.data || [];
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
    protocoles,
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
  const p = withDeterminant(produit);
  const cat = categorie;
  const desc = description;

  // === PROBIOTIQUES / FLORE ===
  if (cat.includes("probiotique") || cat.includes("flore") || produit.toLowerCase().includes("probiotique") || produit.toLowerCase().includes("ultra levure") || produit.toLowerCase().includes("saccharomyces")) {
    if (classe.includes("antibiotique") || classe.includes("anti-infect") || medName.toLowerCase().includes("amoxicilline") || medName.toLowerCase().includes("augmentin")) {
      return `Les antibiotiques perturbent la flore intestinale, ${p} aide à prévenir les troubles digestifs.`;
    }
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La diarrhée déséquilibre la flore intestinale, ${p} aide à restaurer le microbiote.`;
    }
    if (pathologie.includes("reflux") || classe.includes("ipp") || classe.includes("inhibiteur") || medName.toLowerCase().includes("oméprazole") || medName.toLowerCase().includes("pantoprazole")) {
      return `Les troubles digestifs peuvent perturber l'équilibre intestinal, ${p} aide à stabiliser le microbiote.`;
    }
    return `Ce traitement peut altérer l'équilibre de la flore intestinale, ${p} aide à restaurer le microbiote.`;
  }

  // === RÉHYDRATATION ===
  if (cat.includes("réhydratation") || cat.includes("hydratation") || produit.toLowerCase().includes("réhydratation") || produit.toLowerCase().includes("sro")) {
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La diarrhée entraîne une perte importante d'eau et de sels minéraux, ${p} aide à prévenir la déshydratation.`;
    }
    if (classe.includes("antibiotique") || pathologie.includes("infection")) {
      return `Les infections digestives peuvent entraîner une déshydratation, ${p} aide à compenser les pertes hydriques.`;
    }
    if (classe.includes("opioïde") || classe.includes("opiacé") || medName.toLowerCase().includes("codéine")) {
      return `Les traitements opioïdes peuvent favoriser la constipation, une bonne hydratation aide à maintenir un transit normal.`;
    }
    return `Ce traitement peut entraîner des pertes hydriques, ${p} aide à maintenir une hydratation correcte.`;
  }

  // === PANSEMENT GASTRIQUE / PROTECTEUR ===
  if (cat.includes("pansement") || produit.toLowerCase().includes("pansement") || produit.toLowerCase().includes("gaviscon") || produit.toLowerCase().includes("smecta")) {
    if (cat.includes("intestin") || pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `L'irritation intestinale peut persister après la diarrhée, ${p} protège la muqueuse digestive.`;
    }
    if (classe.includes("ains") || classe.includes("anti-inflamm") || medName.toLowerCase().includes("diclofénac") || medName.toLowerCase().includes("ibuprofène") || medName.toLowerCase().includes("kétoprofène")) {
      return `Les AINS augmentent l'acidité gastrique, ${p} aide à limiter les brûlures d'estomac.`;
    }
    if (pathologie.includes("reflux") || classe.includes("ipp")) {
      return `Le reflux acide irrite la muqueuse digestive, ${p} aide à protéger l'estomac et l'œsophage.`;
    }
    return `Ce traitement peut irriter la muqueuse gastrique, ${p} aide à protéger l'estomac.`;
  }

  // === IPP / PROTECTEUR GASTRIQUE ===
  if (cat.includes("ipp") || cat.includes("protecteur gastrique") || produit.toLowerCase().includes("oméprazole") || produit.toLowerCase().includes("pantoprazole")) {
    if (classe.includes("ains") || classe.includes("anti-inflamm") || medName.toLowerCase().includes("diclofénac") || medName.toLowerCase().includes("ibuprofène")) {
      return `Les anti-inflammatoires peuvent irriter la muqueuse gastrique, ${p} aide à protéger l'estomac.`;
    }
    return `Ce traitement peut augmenter l'acidité gastrique, ${p} aide à protéger la muqueuse digestive.`;
  }

  // === CHARBON ACTIF ===
  if (produit.toLowerCase().includes("charbon")) {
    if (pathologie.includes("gastro") || pathologie.includes("diarrhée")) {
      return `La diarrhée peut s'accompagner de gaz et de toxines intestinales, ${p} aide à les adsorber et réduire les ballonnements.`;
    }
    return `Les troubles digestifs peuvent générer gaz et toxines, ${p} aide à les adsorber.`;
  }

  // === SPRAY NASAL / DÉCONGESTIONNANT ===
  if (cat.includes("nasal") || cat.includes("spray") || produit.toLowerCase().includes("spray nasal") || produit.toLowerCase().includes("décongestionnant")) {
    if (pathologie.includes("allergie") || classe.includes("antihistaminique")) {
      return `L'allergie provoque une inflammation des voies nasales, ${p} aide à décongestionner et calmer l'irritation.`;
    }
    if (pathologie.includes("rhume") || pathologie.includes("rhinite")) {
      return `L'inflammation nasale obstrue les voies respiratoires, ${p} aide à dégager le nez et faciliter la respiration.`;
    }
    return `L'irritation des voies nasales gêne la respiration, ${p} aide à décongestionner et apaiser l'inflammation.`;
  }

  // === SOLUTION SALINE / LAVAGE NASAL ===
  if (produit.toLowerCase().includes("saline") || produit.toLowerCase().includes("lavage nasal") || produit.toLowerCase().includes("sérum physiologique")) {
    if (pathologie.includes("allergie")) {
      return `Les allergènes irritent la muqueuse nasale, ${p} permet d'éliminer les particules et d'apaiser l'inflammation.`;
    }
    return `Les sécrétions nasales encombrent les voies respiratoires, ${p} aide à les éliminer et faciliter la respiration.`;
  }

  // === COLLYRE ===
  if (cat.includes("collyre") || cat.includes("ophtalmique") || produit.toLowerCase().includes("collyre")) {
    if (pathologie.includes("allergie") || classe.includes("antihistaminique")) {
      return `L'allergie saisonnière irrite les yeux et provoque des démangeaisons, ${p} stabilise les mastocytes pour soulager le prurit.`;
    }
    return `L'irritation oculaire peut accompagner ce traitement, ${p} aide à apaiser et protéger les yeux.`;
  }

  // === LAXATIF ===
  if (cat.includes("laxatif") || produit.toLowerCase().includes("laxatif")) {
    if (classe.includes("opioïde") || classe.includes("opiacé") || medName.toLowerCase().includes("codéine") || medName.toLowerCase().includes("tramadol")) {
      return `La codéine ralentit le transit intestinal, ${p} aide à prévenir la constipation.`;
    }
    return `Ce traitement peut ralentir le transit intestinal, ${p} aide à prévenir la constipation.`;
  }

  // === FIBRES / PSYLLIUM ===
  if (produit.toLowerCase().includes("fibre") || produit.toLowerCase().includes("psyllium")) {
    if (cat.includes("laxatif") || pathologie.includes("constipation")) {
      return `Les laxatifs stimulants peuvent irriter le côlon, ${p} aide à réguler le transit plus naturellement.`;
    }
    return `Le transit peut être perturbé par ce traitement, ${p} aide à le réguler de manière physiologique.`;
  }

  // === MAGNÉSIUM ===
  if (produit.toLowerCase().includes("magnésium") || cat.includes("magnésium")) {
    if (classe.includes("ains") || classe.includes("anti-inflamm") || pathologie.includes("douleur")) {
      return `Les douleurs musculaires peuvent s'accompagner de tensions, ${p} aide à favoriser la détente musculaire.`;
    }
    if (classe.includes("diurétique") || pathologie.includes("hypertension")) {
      return `Certains traitements augmentent les pertes en magnésium, ${p} aide à compenser ce déficit.`;
    }
    return `Ce traitement peut augmenter les besoins en magnésium, ${p} aide à prévenir les crampes et la fatigue.`;
  }

  // === COENZYME Q10 ===
  if (produit.toLowerCase().includes("coenzyme") || produit.toLowerCase().includes("q10")) {
    if (classe.includes("statine") || medName.toLowerCase().includes("atorvastatine") || medName.toLowerCase().includes("rosuvastatine") || medName.toLowerCase().includes("simvastatine")) {
      return `Les statines peuvent diminuer la production de coenzyme Q10, ${p} aide à limiter les douleurs musculaires.`;
    }
    if (classe.includes("antihypertenseur") || classe.includes("cardiovasculaire") || medName.toLowerCase().includes("amlodipine")) {
      return `Certains traitements cardiovasculaires peuvent impacter l'énergie cellulaire, ${p} soutient la fonction cardiaque.`;
    }
    return `Ce traitement peut réduire les niveaux de coenzyme Q10, ${p} aide à maintenir l'énergie cellulaire.`;
  }

  // === RINÇAGE BUCCAL / ANTISEPTIQUE BUCCAL ===
  if (produit.toLowerCase().includes("rinçage") || produit.toLowerCase().includes("bain de bouche") || produit.toLowerCase().includes("antiseptique buccal")) {
    if (classe.includes("corticoïde") || medName.toLowerCase().includes("budésonide") || medName.toLowerCase().includes("béclométasone") || medName.toLowerCase().includes("fluticasone")) {
      return `Les corticoïdes inhalés peuvent favoriser les infections buccales, ${p} aide à prévenir les mycoses.`;
    }
    return `Ce traitement peut fragiliser la muqueuse buccale, ${p} aide à prévenir les infections locales.`;
  }

  // === VITAMINE D / CALCIUM ===
  if (produit.toLowerCase().includes("vitamine d") || produit.toLowerCase().includes("calcium")) {
    if (classe.includes("corticoïde")) {
      return `Les corticoïdes au long cours fragilisent les os, ${p} aide à prévenir la déminéralisation osseuse.`;
    }
    if (classe.includes("ipp") || medName.toLowerCase().includes("oméprazole")) {
      return `Les traitements prolongés par IPP réduisent l'absorption du calcium, ${p} aide à maintenir la santé osseuse.`;
    }
    return `Ce traitement peut affecter le métabolisme osseux, ${p} aide à maintenir un apport suffisant.`;
  }

  // === FER ===
  if (produit.toLowerCase().includes("fer") || cat.includes("fer")) {
    return `Ce traitement peut impacter l'absorption du fer, ${p} aide à prévenir les carences et la fatigue.`;
  }

  // === VITAMINE B ===
  if (produit.toLowerCase().includes("vitamine b") || produit.toLowerCase().includes("b12") || produit.toLowerCase().includes("acide folique")) {
    if (classe.includes("metformine") || medName.toLowerCase().includes("metformine")) {
      return `La metformine peut diminuer l'absorption de la vitamine B12, ${p} aide à prévenir les carences.`;
    }
    return `Ce traitement peut augmenter les besoins en vitamines du groupe B, ${p} aide à compenser les pertes.`;
  }

  // === ANTISEPTIQUE / CICATRISANT ===
  if (cat.includes("antiseptique") || cat.includes("cicatrisant") || produit.toLowerCase().includes("antiseptique")) {
    return `Les lésions cutanées nécessitent une protection contre les infections, ${p} favorise la cicatrisation.`;
  }

  // === CRÈME / ÉMOLLIENT ===
  if (cat.includes("émollient") || cat.includes("crème") || produit.toLowerCase().includes("émollient")) {
    if (classe.includes("corticoïde") || pathologie.includes("eczéma") || pathologie.includes("dermatite")) {
      return `L'inflammation cutanée fragilise la barrière de la peau, ${p} aide à restaurer l'hydratation et la protection.`;
    }
    return `Ce traitement peut assécher la peau, ${p} aide à restaurer la barrière cutanée.`;
  }

  // === LARMES ARTIFICIELLES ===
  if (produit.toLowerCase().includes("larmes artificielles") || produit.toLowerCase().includes("larme artificielle")) {
    return `La sécheresse oculaire réduit le film lacrymal, ${p} à base d'hyaluronate hydratent intensément la surface oculaire.`;
  }

  // === GENERIC FALLBACK using description ===
  if (description && description.length > 10) {
    const descClean = description.replace(/\.$/g, "").trim();
    // Build a proper phrase using description as context + product with determinant
    if (pathologie) {
      return `En cas de ${pathologie}, ${descClean}, ${p} aide à soulager les symptômes.`;
    }
    return `${descClean.charAt(0).toUpperCase() + descClean.slice(1)}, ${p} aide à soulager les symptômes associés.`;
  }

  // === PATHOLOGIE-BASED FALLBACK ===
  if (pathologie) {
    return `En cas de ${pathologie}, ${p} agit en complément pour limiter les effets secondaires du traitement.`;
  }

  // === CLASSE-BASED FALLBACK ===
  if (classe) {
    return `Les traitements de type ${classe} peuvent avoir des effets secondaires, ${p} aide à les atténuer.`;
  }

  // === ULTIMATE FALLBACK ===
  return `Ce traitement peut nécessiter un accompagnement, ${p} aide à en limiter les effets indésirables.`;
}

function buildFallbackMedical(produit: string, medName: string, classe: string, description: string): string {
  const p = withDeterminant(produit);
  if (classe) {
    return `Les traitements de type ${classe} peuvent avoir des effets secondaires, ${p} aide à les atténuer.`;
  }
  if (medName) {
    return `Ce traitement peut nécessiter un accompagnement, ${p} aide à en limiter les effets indésirables.`;
  }
  return `${p} est recommandé en accompagnement pour limiter les effets indésirables du traitement.`;
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

const OCR_MODEL = "google/gemini-3.1-pro-preview";
const TEXT_MODEL = "google/gemini-3-flash-preview";

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

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { prescriptionText, imageBase64, basketSessionId, blockedProducts } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse blocked products from basket context (anti-loop)
    const blockedPCSet = new Set<string>(
      (blockedProducts || []).map((p: string) => normalizeText(p))
    );

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

    // Step 3.5: Detect latent needs from medication combination
    const latentNeeds = await detectLatentNeeds(supabase, medNames);
    let latentNeedUsed = false;
    let usedLatentNeed: LatentNeed | null = null;

    // Step 4: Build direct recommendations per medication
    // Apply degressive rule based on total meds count
    const maxPCPerMed = getMaxPCsPerMed(enrichedMeds.length);
    const allContexts: string[] = [];
    let hasStructuredData = clinicalResults.length > 0;
    const medRecommendations: Map<number, any[]> = new Map();
    const medMainAdvice: Map<number, string> = new Map();
    const allProposedPCs: string[] = []; // track globally proposed PCs to avoid duplicates across meds

    // Load pharmacy-specific product mappings
    let productMappings: any[] = [];
    const pharmacyIdForMapping = await getPharmacyIdFromAuth(supabase, authHeader);
    if (pharmacyIdForMapping) {
      const { data: mappings } = await supabase
        .from("product_mapping")
        .select("categorie, produit_selectionne, cip_code")
        .eq("pharmacy_id", pharmacyIdForMapping)
        .eq("active", true);
      productMappings = mappings || [];
    }

    // Load new protocole_pathologie with joined data
    const { data: protocoles } = await supabase
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
      .eq("actif", true);

    // Also load legacy pathology_protocol as fallback
    const { data: legacyProtocols } = await supabase
      .from("pathology_protocol")
      .select("pathologie, conseil, produit_1, produit_2, priority")
      .order("priority", { ascending: false });

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

        // Use protocols from clinicalLookup first (per-medication, already filtered)
        const perMedProtocols = clinical?.protocoles || [];
        let matchedProtocol = perMedProtocols.length > 0
          ? perMedProtocols.sort((a: any, b: any) => (b?.priorite_produit_1 || 0) - (a?.priorite_produit_1 || 0))[0]
          : null;

        // Fallback to global protocol search
        if (!matchedProtocol) {
          matchedProtocol = findProtocolForPathologies(allProtocols, med.pathologies || []);
        }

        if (matchedProtocol) {
          // New protocole_pathologie format (has conseil_1 object)
          if (matchedProtocol.conseil_1) {
            const c1 = matchedProtocol.conseil_1;
            const c2 = matchedProtocol.conseil_2;
            advice = c1.conseil + (c1.description ? ` (${c1.description})` : "");
            if (c2?.conseil) {
              advice += `. ${c2.conseil}${c2.description ? ` (${c2.description})` : ""}`;
            }

            const protocolProducts = [
              matchedProtocol.produit_1 ? { ...matchedProtocol.produit_1, just: matchedProtocol.justification_1, prio: matchedProtocol.priorite_produit_1 } : null,
              matchedProtocol.produit_2 ? { ...matchedProtocol.produit_2, just: matchedProtocol.justification_2, prio: matchedProtocol.priorite_produit_2 } : null,
              matchedProtocol.produit_3 ? { ...matchedProtocol.produit_3, just: matchedProtocol.justification_3, prio: matchedProtocol.priorite_produit_3 } : null,
            ]
              .filter(Boolean)
              .map((p: any) => ({
                produit: p.produit,
                categorie: p.categorie || "Complément",
                description: p.just || p.description || "",
                priorite: p.prio || p.priorite || 50,
                pathologie: matchedProtocol.pathologie_nom || matchedProtocol.pathologies?.nom_pathologie || "",
                phrase_conseil: p.phrase_conseil || undefined,
              }));

            recs.push(...pickDistinctProducts(protocolProducts, MAX_RECOMMENDATIONS_PER_MED));
          } else {
            // Legacy pathology_protocol format
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
                  description: fromClinical?.description || "Produit pertinent",
                  priorite: fromClinical?.priorite || (matchedProtocol.priority || 80) - idx,
                  pathologie: fromClinical?.pathologies?.nom_pathologie || matchedProtocol.pathologie,
                  phrase_conseil: fromClinical?.phrase_conseil || undefined,
                };
              });
            recs.push(...pickDistinctProducts(protocolProducts, MAX_RECOMMENDATIONS_PER_MED));
          }
        }

        // Fallback on existing clinical product rows
        if (recs.length === 0 && clinical?.produits) {
          const mappedClinicalProducts = (clinical.produits || []).map((p: any) => ({
            produit: p.produit,
            categorie: p.categorie || "Complément",
            description: p.description || "",
            priorite: p.priorite || 50,
            pathologie: p.pathologies?.nom_pathologie || "",
            phrase_conseil: p.phrase_conseil || undefined,
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
            phrase_conseil: p.phrase_conseil || undefined,
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

      // Apply filters: blocked products (anti-loop), cross-med dedup, degressive cap
      let filteredRecs = recs
        .filter((r: any) => !blockedPCSet.has(normalizeText(r.produit)))
        .filter((r: any) => !allProposedPCs.includes(normalizeText(r.produit)));

      // Apply pharmacy product mapping (replace generic → specific)
      filteredRecs = filteredRecs.map((r: any) => {
        const mapping = productMappings.find(
          (m: any) => normalizeText(m.categorie) === normalizeText(r.categorie)
        );
        if (mapping) {
          return { ...r, produit: mapping.produit_selectionne, mapped: true };
        }
        return r;
      });

      // Cap to degressive limit
      const finalRecs = filteredRecs.slice(0, maxPCPerMed);

      // Generate phrase_conseil for each PC: [context/problem] + [simple explanation] + [patient benefit]
      for (const r of finalRecs) {
        if (!r.phrase_conseil) {
          r.phrase_conseil = generatePhraseConseil(r, med);
        }
        allProposedPCs.push(normalizeText(r.produit));
      }

      medRecommendations.set(i, finalRecs);
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

    // Step 8: Save to analysis_history + metrics + basket context
    try {
      const pharmacyId = pharmacyIdForMapping || await getPharmacyIdFromAuth(supabase, authHeader);
      
      
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
          patient_name: null,
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

        // Track recommendation metrics (upsert per PC)
        for (const med of medicamentsResult) {
          for (const rec of (med.recommendations || [])) {
            await supabase.rpc("upsert_recommendation_metric_noop", {}).catch(() => {});
            // Use upsert pattern
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
          }
        }

        // Track latent need metrics
        if (usedLatentNeed && pharmacyId) {
          const boostedRec = medicamentsResult
            .flatMap((m: any) => (m.recommendations || []))
            .find((r: any) => r.latent_need);
          
          if (boostedRec) {
            const { data: existingLN } = await supabase
              .from("latent_need_metrics")
              .select("id, times_proposed")
              .eq("pharmacy_id", pharmacyId)
              .eq("besoin", usedLatentNeed.besoin_infere)
              .eq("pc_proposed", boostedRec.produit)
              .maybeSingle();

            if (existingLN) {
              await supabase.from("latent_need_metrics")
                .update({ times_proposed: existingLN.times_proposed + 1, updated_at: new Date().toISOString() })
                .eq("id", existingLN.id);
            } else {
              await supabase.from("latent_need_metrics").insert({
                pharmacy_id: pharmacyId,
                besoin: usedLatentNeed.besoin_infere,
                medicament_source: usedLatentNeed.medicament_source,
                pc_proposed: boostedRec.produit,
                times_proposed: 1,
              });
            }
          }
        }

        // Update/create basket context
        if (basketSessionId) {
          const proposedList = medicamentsResult.flatMap((m: any) => (m.recommendations || []).map((r: any) => r.produit));
          await supabase.from("basket_context").upsert({
            pharmacy_id: pharmacyId,
            session_id: basketSessionId,
            scanned_medicaments: medNames,
            proposed_pcs: proposedList,
            active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "pharmacy_id,session_id" }).catch(() => {
            // If no unique constraint on session_id, insert
            supabase.from("basket_context").insert({
              pharmacy_id: pharmacyId,
              session_id: basketSessionId,
              scanned_medicaments: medNames,
              proposed_pcs: proposedList,
              active: true,
            });
          });
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
