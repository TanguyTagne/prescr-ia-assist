/**
 * Importe le CSV maître Asclion (le plus récent du bucket "imports") :
 *   id, cip_code, nom_commercial, laboratoire, dosage,
 *   forme_galenique, voie_administration, atc_code, nom_molecule,
 *   classe_therapeutique, cible_age, statut_officine, est_otc,
 *   est_produit_conseil, posologie, pc_1, pc_2,
 *   pertinence_pc1, pertinence_pc2, phrase_conseil_pc1, phrase_conseil_pc2,
 *   vigilance, phrase_vigilance, pertinence_vigilance
 *
 * Modes :
 *   POST /import-asclion-base?mode=wipe         → vide medicaments + curated_pcs
 *   POST /import-asclion-base?mode=import&offset=0&limit=1000 → importe une tranche (wipe auto à offset 0)
 *   POST /import-asclion-base?mode=upload       → pousse un nouveau CSV maître (nom d'origine conservé)
 *   POST /import-asclion-base?mode=peek&match=x → debug admin : en-têtes + lignes correspondantes
 * Admin only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET = "imports";
const MASTER_FILE = "asclion_medicaments_conseil_v3.csv";
const BATCH = 200;

function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .replace(/^"|"$/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowValue(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct != null && direct.trim() !== "") return direct.trim();
    const normalized = row[normalizeHeaderKey(alias)];
    if (normalized != null && normalized.trim() !== "") return normalized.trim();
  }
  return "";
}

function detectDelim(headerLine: string): string {
  // Comptage hors des guillemets pour deviner le séparateur (`,` ou `;` ou `\t`).
  let semi = 0, comma = 0, tab = 0, inQ = false;
  for (const ch of headerLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ) {
      if (ch === ';') semi++;
      else if (ch === ',') comma++;
      else if (ch === '\t') tab++;
    }
  }
  if (semi >= comma && semi >= tab) return ';';
  if (tab >= comma) return '\t';
  return ',';
}

/**
 * Parseur CSV en streaming : ne matérialise QUE les lignes de la tranche
 * demandée (offset/limit). Matérialiser tout le fichier faisait exploser la
 * mémoire de l'edge function (WORKER_RESOURCE_LIMIT).
 */
function parseCsvRange(
  text: string,
  start = 0,
  count = Number.MAX_SAFE_INTEGER,
): { headers: string[]; rows: Record<string, string>[]; total: number } {
  const cleaned = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const headerLine = cleaned.split(/\r?\n/, 1)[0] || "";
  if (!headerLine) return { headers: [], rows: [], total: 0 };
  const delim = detectDelim(headerLine);

  let headers: string[] | null = null;
  const normalizedHeaders: string[] = [];
  const rows: Record<string, string>[] = [];
  let total = 0;

  const emit = (record: string[]) => {
    if (!record.some((value) => value.trim())) return;
    if (!headers) {
      headers = record.map((h) => h.trim().replace(/^"|"$/g, ""));
      for (const h of headers) normalizedHeaders.push(normalizeHeaderKey(h));
      return;
    }
    const index = total++;
    if (index < start || rows.length >= count) return;
    const row: Record<string, string> = {};
    for (let idx = 0; idx < headers.length; idx++) {
      const value = (record[idx] ?? "").trim();
      row[headers[idx]] = value;
      const normalized = normalizedHeaders[idx];
      if (normalized && row[normalized] == null) row[normalized] = value;
    }
    rows.push(row);
  };

  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"') {
      if (inQuotes && cleaned[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      record.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && cleaned[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      emit(record);
      record = [];
    } else {
      field += ch;
    }
  }
  record.push(field);
  emit(record);

  return { headers: headers ?? [], rows, total };
}


async function resolveMasterFile(supabase: any): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;
  const master = (data || []).find((object: any) => String(object.name || "") === MASTER_FILE);
  if (!master) throw new Error(`CSV maître introuvable : imports/${MASTER_FILE}`);
  return MASTER_FILE;
}

function chunks<T>(a: T[], n: number): T[][] {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
}

function cleanCip(raw: string): string | null {
  if (!raw) return null;
  const s = raw.replace(/\.0$/, "").trim();
  return s || null;
}

function normalizeLookupKey(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productNamesMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeLookupKey(a || "");
  const right = normalizeLookupKey(b || "");
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function cleanText(value: string): string | null {
  const cleaned = (value || "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function csvBytesFromBody(bodyJson: any): Uint8Array | null {
  const csvText = typeof bodyJson.csvText === "string" ? bodyJson.csvText : "";
  const contentBase64 = typeof bodyJson.contentBase64 === "string" ? bodyJson.contentBase64 : "";
  if (contentBase64) {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (csvText) return new TextEncoder().encode(csvText);
  return null;
}

function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function findMedicamentId(supabase: any, row: Record<string, string>): Promise<string | null> {
  const directId = rowValue(row, ["medicament_id", "id_medicament", "id"]);
  if (directId) return directId;

  const medName = rowValue(row, [
    "nom_commercial",
    "nom commercial",
    "medicament",
    "médicament",
    "medicament_nom",
    "nom_medicament",
    "nom médicament",
    "nom",
  ]);
  if (!medName) return null;

  const normalizedTarget = normalizeLookupKey(medName);
  const firstWord = normalizedTarget.split(" ")[0];
  if (!firstWord || firstWord.length < 3) return null;

  const { data } = await supabase
    .from("medicaments")
    .select("id, nom_commercial")
    .or(`nom_commercial.ilike.${medName},nom_commercial.ilike.${firstWord}%`)
    .limit(20);

  const rows = (data || []) as any[];
  const exact = rows.find((r) => normalizeLookupKey(r.nom_commercial || "") === normalizedTarget);
  return (exact || rows[0])?.id ?? null;
}


function asBool(s: string): boolean {
  return s === "t" || s === "true" || s === "1";
}

const ALLOWED_AGE = new Set(["nourrisson", "enfant", "adulte", "tous"]);

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const auth = req.headers.get("authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Admin requis" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  const url = new URL(req.url);
  let bodyJson: any = {};
  try { bodyJson = await req.json(); } catch { /* no body */ }
  const mode = url.searchParams.get("mode") ?? bodyJson.mode ?? "";

  try {
    // ── WIPE ────────────────────────────────────────────────────────────
    if (mode === "wipe") {
      const { data, error: wipeErr } = await supabase.rpc("wipe_asclion_base");
      if (wipeErr) throw wipeErr;
      return new Response(JSON.stringify(data ?? { ok: true, deleted: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── PEEK (debug admin) : en-têtes + lignes correspondant à ?match= ──
    if (mode === "peek") {
      const sourceFile = await resolveMasterFile(supabase);
      const { data: blob, error: stErr } = await supabase.storage.from(BUCKET).download(sourceFile);
      if (stErr || !blob) throw new Error(`Fichier introuvable: ${stErr?.message ?? "blob null"}`);
      const text = decodeCsvBytes(new Uint8Array(await blob.arrayBuffer()));
      const match = (url.searchParams.get("match") ?? bodyJson.match ?? "").toLowerCase();
      // Streaming : on ne garde que les premières lignes (ou 2000 max pour la recherche)
      const parsed = parseCsvRange(text, 0, match ? 2000 : 2);
      const headers = parsed.headers;
      const hits = match
        ? parsed.rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(match))).slice(0, 10)
        : parsed.rows;
      return new Response(
        JSON.stringify({ source_file: sourceFile, total_rows: parsed.total, headers, hits }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );

    }

    // ── UPLOAD CSV ENRICHI ──────────────────────────────────────────────
    if (mode === "upload") {
      const bytes = csvBytesFromBody(bodyJson);
      if (!bytes) {
        return new Response(JSON.stringify({ error: "CSV manquant" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const previewText = decodeCsvBytes(bytes);
      const previewParsed = parseCsvRange(previewText, 0, 200);
      const previewSample = previewParsed.rows;

      const hasPertinence = previewSample.some((row) =>
        !!(
          rowValue(row, ["pertinence_pc1", "pertinence pc1", "pertinence_1", "raison_pc1", "raison pc1", "pertinence", "raison"]) ||
          rowValue(row, ["pertinence_pc2", "pertinence pc2", "pertinence_2", "raison_pc2", "raison pc2"])
        )
      );
      const hasPhrase = previewSample.some((row) =>
        !!(
          rowValue(row, ["phrase_conseil_pc1", "phrase conseil pc1", "phrase_pc1", "conseil_pc1", "phrase_conseil_1", "conseil_1", "phrase_conseil", "phrase conseil", "phrase", "conseil"]) ||
          rowValue(row, ["phrase_conseil_pc2", "phrase conseil pc2", "phrase_pc2", "conseil_pc2", "phrase_conseil_2", "conseil_2"])
        )
      );
      const hasPc = previewSample.some((row) => !!rowValue(row, [
        "pc_1", "pc1", "pc", "pc_suggere", "pc suggéré", "pc_suggere_1", "pc suggéré 1",
        "suggestion", "suggestion_1", "suggestion 1", "produit_suggere", "produit suggéré",
        "produit_suggere_1", "produit suggéré 1", "produit_complementaire", "produit complémentaire",
        "produit_complementaire_1", "produit complémentaire 1", "produit_conseil", "produit_conseil_1",
        "pc_2", "pc2", "pc_suggere_2", "pc suggéré 2", "suggestion_2", "suggestion 2",
        "produit_suggere_2", "produit suggéré 2", "produit_complementaire_2", "produit complémentaire 2", "produit_conseil_2",
      ]));
      if (!hasPc) {
        const headers = previewParsed.headers.length
          ? [...new Set(previewParsed.headers.filter((key) => key === normalizeHeaderKey(key)))].join(", ")
          : "aucun en-tête";
        void ((key: string) => Object.keys({}.filter((key) => key === normalizeHeaderKey(key)))].join(", ")
          : "aucun en-tête";
        return new Response(JSON.stringify({
          error: "COLONNES_PC_INTROUVABLES",
          message: `Aucun nom de produit complémentaire reconnu. En-têtes détectés : ${headers}`,
        }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(MASTER_FILE, bytes, { contentType: "text/csv; charset=utf-8", upsert: true });
      if (uploadErr) throw uploadErr;

      return new Response(JSON.stringify({
        ok: true,
        file: `${BUCKET}/${MASTER_FILE}`,
        size: bytes.byteLength,
        rows: previewParsed.total,
        has_pertinence: hasPertinence,
        has_phrase_conseil: hasPhrase,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── IMPORT ──────────────────────────────────────────────────────────
    if (mode === "import") {
      const offset = parseInt(url.searchParams.get("offset") ?? String(bodyJson.offset ?? 0), 10);
      const limit = parseInt(url.searchParams.get("limit") ?? String(bodyJson.limit ?? 1000), 10);

      const sourceFile = await resolveMasterFile(supabase);
      const { data: blob, error: stErr } = await supabase.storage.from(BUCKET).download(sourceFile);
      if (stErr || !blob) throw new Error(`Fichier introuvable: ${stErr?.message ?? "blob null"}`);
      const buf = new Uint8Array(await blob.arrayBuffer());
      // Détection encodage : si UTF-8 invalide, fallback windows-1252 (export Numbers/Excel par défaut)
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("windows-1252").decode(buf);
      }
      // Garde anti-mojibake : si le CSV contient déjà le replacement char U+FFFD,
      // les accents ont été perdus AVANT l'upload (export source en mauvais
      // encoding). Aucun décodeur ne peut récupérer l'info — on refuse l'import.
      const fffdCount = (text.match(/\uFFFD/g) || []).length;
      if (fffdCount > 0) {
        return new Response(JSON.stringify({
          ok: false,
          error: "MOJIBAKE_DETECTED",
          message: `Le CSV contient ${fffdCount} caractère(s) "�" (accents perdus à l'export). Ré-exporte depuis la source en UTF-8 (Google Sheets : Fichier → Télécharger → CSV ; Excel : "CSV UTF-8 (séparateur point-virgule)") puis relance l'import.`,
          fffd_count: fffdCount,
        }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const parsed = parseCsvRange(text, offset, limit);
      const total = parsed.total;
      const slice = parsed.rows;


      // Import autoritaire réel : le premier lot supprime la base précédente.
      // Sans ceci, les upserts laissaient les anciennes valeurs en place pour
      // les lignes non encore retraitées, malgré le libellé affiché dans l'admin.
      if (offset === 0) {
        const { error: wipeErr } = await supabase.rpc("wipe_asclion_base");
        if (wipeErr) throw new Error(`Échec remise à zéro avant import: ${wipeErr.message}`);
      }

      // Dédupliquer par id dans la tranche
      const seen = new Set<string>();
      const meds: any[] = [];
      const pcs: any[] = [];
      const atcByCode = new Map<string, string>();
      for (const r of slice) {
        const id = rowValue(r, ["id"]);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const cibleAge = rowValue(r, ["cible_age", "age", "cible age"]);
        const age = ALLOWED_AGE.has(cibleAge) ? cibleAge : "tous";
        const atcCode = rowValue(r, ["atc_code", "code_atc", "atc code"]);
        if (atcCode) atcByCode.set(atcCode, rowValue(r, ["classe_therapeutique", "classe thérapeutique", "classe_therapie"]) || atcCode);
        meds.push({
          id,
          nom_commercial: rowValue(r, ["nom_commercial", "nom commercial", "nom", "medicament", "médicament"]) || "?",
          cip_code: cleanCip(rowValue(r, ["cip_code", "cip", "code_cip", "code cip"])),
          atc_code: atcCode || null,
          laboratoire: rowValue(r, ["laboratoire", "labo"]) || null,
          forme_galenique: rowValue(r, ["forme_galenique", "forme galénique", "forme"]) || null,
          dosage: rowValue(r, ["dosage"]) || null,
          voie_administration: rowValue(r, ["voie_administration", "voie administration", "voie"]) || null,
          posologie: rowValue(r, ["posologie"]) || null,
          cible_age: age,
          statut_officine: rowValue(r, ["statut_officine", "statut officine", "statut"]) || "actif",
          est_otc: asBool(rowValue(r, ["est_otc", "otc"])),
          est_produit_conseil: asBool(rowValue(r, ["est_produit_conseil", "produit_conseil", "est produit conseil"])),
        });
        // Le fichier « Produits Complémentaires » peut contenir soit deux
        // colonnes numérotées, soit un seul PC avec des en-têtes au singulier.
        // Dans ce second cas, ce PC doit alimenter pc_1 (et non être perdu).
        const pc1 = rowValue(r, [
          "pc_1", "pc1", "pc", "pc_suggere", "pc suggéré", "pc suggere",
          "pc_suggere_1", "pc suggéré 1", "pc suggere 1",
           "suggestion", "suggestion_1", "suggestion 1",
          "produit_suggere", "produit suggéré", "produit suggere",
          "produit_suggere_1", "produit suggéré 1", "produit suggere 1",
          "produit_complementaire_1", "produit complémentaire 1",
          "produit_complementaire", "produit complémentaire", "produit_conseil_1", "produit_conseil",
        ]);
        const pc2 = rowValue(r, ["pc_2", "pc2", "pc_suggere_2", "pc suggéré 2", "pc suggere 2", "suggestion_2", "suggestion 2", "produit_suggere_2", "produit suggéré 2", "produit suggere 2", "produit_complementaire_2", "produit complémentaire 2", "produit_conseil_2"]);
        const pert1 = rowValue(r, ["pertinence_pc1", "pertinence pc1", "pertinence_1", "raison_pc1", "raison pc1", "raison_1", "pertinence", "raison", "type"]);
        const pert2 = rowValue(r, ["pertinence_pc2", "pertinence pc2", "pertinence_2", "raison_pc2", "raison pc2", "raison_2"]);
        // Phrase conseil — accepte plusieurs noms de colonnes possibles
        const phrase1 = rowValue(r, ["phrase_conseil_pc1", "phrase conseil pc1", "phrase_pc1", "conseil_pc1", "phrase_conseil_1", "conseil_1", "phrase conseil 1", "phrase_conseil", "phrase conseil", "phrase", "conseil"]);
        const phrase2 = rowValue(r, ["phrase_conseil_pc2", "phrase conseil pc2", "phrase_pc2", "conseil_pc2", "phrase_conseil_2", "conseil_2", "phrase conseil 2"]);
        // Vigilance (message sécurité, non commercial)
        const vigilance = rowValue(r, ["vigilance", "vigilance_1", "pc_vigilance", "securite", "sécurité"]);
        const phraseVig = rowValue(r, ["phrase_vigilance", "phrase vigilance", "phrase_conseil_vigilance", "conseil_vigilance", "phrase_securite"]);
        const pertVig = rowValue(r, ["pertinence_vigilance", "pertinence vigilance", "raison_vigilance"]);
        // Le CSV maître fait AUTORITÉ : on écrit toujours la ligne curated,
        // y compris avec des valeurs nulles, afin d'effacer d'anciennes
        // suggestions héritées d'imports/seeds précédents (ex. Febuxostat qui
        // gardait des PC alors que le CSV n'en a aucun).
        pcs.push({
          medicament_id: id,
          pc_1: pc1 || null,
          pc_2: pc2 || null,
          pertinence_pc1: pc1 ? (pert1 || null) : null,
          pertinence_pc2: pc2 ? (pert2 || null) : null,
          phrase_conseil_pc1: pc1 ? (phrase1 || null) : null,
          phrase_conseil_pc2: pc2 ? (phrase2 || null) : null,
          vigilance: vigilance || null,
          phrase_vigilance: phraseVig || null,
          pertinence_vigilance: pertVig || (vigilance || phraseVig ? "Sécurité" : null),
          source: "asclion_2026_06",
        });


      }

      // Dédup CIP (la contrainte UNIQUE rejetterait sinon)
      const cipSeen = new Set<string>();
      for (const m of meds) {
        if (m.cip_code) {
          if (cipSeen.has(m.cip_code)) m.cip_code = null;
          else cipSeen.add(m.cip_code);
        }
      }

      const atcRows = [...atcByCode.entries()].map(([atc_code, nom_classe]) => ({
        atc_code,
        nom_classe: nom_classe || atc_code,
        niveau: Math.max(1, Math.min(5, atc_code.length)),
      }));
      for (const b of chunks(atcRows, BATCH)) {
        const { error } = await supabase.from("classe_atc").upsert(b, { onConflict: "atc_code" });
        if (error) throw error;
      }

      let medsIns = 0, medsErr = 0;
      for (const b of chunks(meds, BATCH)) {
        const { error } = await supabase.from("medicaments").upsert(b, { onConflict: "id" });
        if (error) { medsErr += b.length; throw new Error(`Échec médicaments: ${error.message}`); }
        else medsIns += b.length;
      }
      let pcsIns = 0, pcsErr = 0;
      const pcsWithPertinence = pcs.filter((p) => p.pertinence_pc1 || p.pertinence_pc2).length;
      const pcsWithPhrase = pcs.filter((p) => p.phrase_conseil_pc1 || p.phrase_conseil_pc2).length;
      const pcsWithVigilance = pcs.filter((p) => p.vigilance || p.phrase_vigilance).length;
      const orphanPhraseRows = pcs.filter((p) =>
        (p.phrase_conseil_pc1 && !p.pc_1) || (p.phrase_conseil_pc2 && !p.pc_2)
      ).length;
      for (const b of chunks(pcs, BATCH)) {
        const { error } = await supabase.from("medicament_curated_pcs").upsert(b, { onConflict: "medicament_id" });
        if (error) { pcsErr += b.length; throw new Error(`Échec PC/vigilance: ${error.message}`); }
        else pcsIns += b.length;
      }

      const nextOffset = offset + limit;
      return new Response(JSON.stringify({
        ok: true, source_file: sourceFile, total_in_csv: total, offset, limit,
        processed: slice.length, meds_upserted: medsIns, meds_failed: medsErr,
        pcs_upserted: pcsIns, pcs_failed: pcsErr,
        pcs_with_pertinence: pcsWithPertinence,
        pcs_with_phrase_conseil: pcsWithPhrase,
        pcs_with_vigilance: pcsWithVigilance,
        orphan_phrase_rows: orphanPhraseRows,
        next_offset: nextOffset < total ? nextOffset : null,
        done: nextOffset >= total,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }


    return new Response(JSON.stringify({
        error: "mode requis : ?mode=upload, ?mode=wipe, ?mode=import&offset=0&limit=1000 ou ?mode=peek&match=nom",
    }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-asclion-base fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
