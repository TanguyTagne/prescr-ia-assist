/**
 * Importe asclion-medicaments-avec-pcs.csv depuis le bucket "imports".
 * CSV = base définitive : id, cip_code, nom_commercial, laboratoire, dosage,
 *   forme_galenique, voie_administration, atc_code, nom_molecule,
 *   classe_therapeutique, cible_age, statut_officine, est_otc,
 *   est_produit_conseil, posologie, pc_1, pc_2, pc_3 (ignoré, max 2 PC)
 *
 * Modes :
 *   POST /import-asclion-base?mode=wipe         → vide medicaments + curated_pcs
 *   POST /import-asclion-base?mode=import&offset=0&limit=1000 → importe une tranche
 * Admin only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET = "imports";
const FILE = "asclion-medicaments-pertinence.csv";
const BATCH = 200;

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
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

function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = cleaned.split("\n");
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/\r$/, "");
  const delim = detectDelim(headerLine);
  const headers = parseCsvLine(headerLine, delim).map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim()) continue;
    const vals = parseCsvLine(line, delim);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => row[h] = (vals[idx] ?? "").trim());
    rows.push(row);
  }
  return rows;
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

    // ── IMPORT ──────────────────────────────────────────────────────────
    if (mode === "import") {
      const offset = parseInt(url.searchParams.get("offset") ?? String(bodyJson.offset ?? 0), 10);
      const limit = parseInt(url.searchParams.get("limit") ?? String(bodyJson.limit ?? 1000), 10);

      const { data: blob, error: stErr } = await supabase.storage.from(BUCKET).download(FILE);
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
      const rows = parseCsv(text);

      const total = rows.length;
      const slice = rows.slice(offset, offset + limit);

      // Dédupliquer par id dans la tranche
      const seen = new Set<string>();
      const meds: any[] = [];
      const pcs: any[] = [];
      const atcByCode = new Map<string, string>();
      for (const r of slice) {
        const id = r["id"];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const age = ALLOWED_AGE.has(r["cible_age"]) ? r["cible_age"] : "tous";
        const atcCode = (r["atc_code"] || "").trim();
        if (atcCode) atcByCode.set(atcCode, r["classe_therapeutique"] || atcCode);
        meds.push({
          id,
          nom_commercial: r["nom_commercial"] || "?",
          cip_code: cleanCip(r["cip_code"]),
          atc_code: atcCode || null,
          laboratoire: r["laboratoire"] || null,
          forme_galenique: r["forme_galenique"] || null,
          dosage: r["dosage"] || null,
          voie_administration: r["voie_administration"] || null,
          posologie: r["posologie"] || null,
          cible_age: age,
          statut_officine: r["statut_officine"] || "actif",
          est_otc: asBool(r["est_otc"]),
          est_produit_conseil: asBool(r["est_produit_conseil"]),
        });
        const pc1 = (r["pc_1"] || "").trim();
        const pc2 = (r["pc_2"] || "").trim();
        if (pc1 || pc2) {
          pcs.push({
            medicament_id: id,
            pc_1: pc1 || null,
            pc_2: pc2 || null,
            source: "asclion_2026_06",
          });
        }
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
        if (error) { medsErr += b.length; console.error("med batch err:", error.message); }
        else medsIns += b.length;
      }
      let pcsIns = 0, pcsErr = 0;
      for (const b of chunks(pcs, BATCH)) {
        const { error } = await supabase.from("medicament_curated_pcs").upsert(b, { onConflict: "medicament_id" });
        if (error) { pcsErr += b.length; console.error("pc batch err:", error.message); }
        else pcsIns += b.length;
      }

      const nextOffset = offset + limit;
      return new Response(JSON.stringify({
        ok: true, total_in_csv: total, offset, limit,
        processed: slice.length, meds_upserted: medsIns, meds_failed: medsErr,
        pcs_upserted: pcsIns, pcs_failed: pcsErr,
        next_offset: nextOffset < total ? nextOffset : null,
        done: nextOffset >= total,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "mode requis : ?mode=wipe ou ?mode=import&offset=0&limit=1000",
    }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-asclion-base fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
