/**
 * Importe asclion-pc-cip-mapping.csv depuis le bucket "imports".
 * Peuple public.pc_cip_mapping (libellé PC → codes CIP13/EAN13/ACL7).
 *
 * Format CSV : ; comme séparateur
 * Colonnes : pc_label, occurrences, categorie, type_produit, code, type_code,
 *            produit_reference, marque, source, statut
 *
 * Admin only — POST /import-pc-cip-mapping
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET    = "imports";
const FILE_NAME = "asclion-pc-cip-mapping.csv";
const BATCH     = 500;

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin requis" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: blob, error: storageErr } = await supabase.storage.from(BUCKET).download(FILE_NAME);
    if (storageErr || !blob) {
      return new Response(JSON.stringify({ error: `Fichier introuvable: ${storageErr?.message ?? "blob null"}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const text = await blob.text();
    const records = parseCsv(text);

    // Purge totale avant re-import (table reconstruite à chaque import).
    await supabase.from("pc_cip_mapping").delete().gt("created_at", "1970-01-01");

    const valid = records
      .filter((r) => r.pc_label && r.code)
      .map((r) => ({
        pc_label: r.pc_label,
        pc_label_norm: normalize(r.pc_label),
        categorie: r.categorie || null,
        type_produit: r.type_produit || null,
        code: r.code.replace(/\s+/g, ""),
        type_code: r.type_code || null,
        produit_reference: r.produit_reference || null,
        marque: r.marque || null,
        source: r.source || null,
        statut: r.statut || null,
        occurrences: Number(r.occurrences) || 0,
      }));

    // Dédup en mémoire (pc_label_norm + code)
    const seen = new Set<string>();
    const deduped = valid.filter((r) => {
      const k = `${r.pc_label_norm}::${r.code}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let inserted = 0, errors = 0;
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH);
      const { error } = await supabase.from("pc_cip_mapping").insert(batch);
      if (error) { console.error("batch err", error.message); errors += batch.length; }
      else inserted += batch.length;
    }

    return new Response(JSON.stringify({ success: true, parsed: records.length, inserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-pc-cip-mapping fatal:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
