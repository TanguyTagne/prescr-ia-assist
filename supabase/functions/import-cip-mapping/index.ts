/**
 * Importe cip-produit-mapping-COMPLETE.csv depuis le bucket Storage "imports".
 * Peuple public.medicament_cip avec ~37 600 entrées CIP13 → nom médicament.
 *
 * Appel : POST /import-cip-mapping  (Authorization: Bearer <admin_token>)
 * Admin only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET    = "imports";
const FILE_NAME = "cip-produit-mapping-COMPLETE.csv";
const BATCH     = 500;

// ── CSV parser minimal (gère les champs entre guillemets) ──────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  // Supprimer le BOM UTF-8 si présent
  const cleaned = text.startsWith("﻿") ? text.slice(1) : text;
  const lines   = cleaned.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0].replace(/\r$/, "")).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
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

  // ── Auth admin ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user }, error: userErr } =
    await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin requis" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Télécharger le CSV depuis Storage ─────────────────────────────────
    const { data: blob, error: storageErr } = await supabase.storage
      .from(BUCKET)
      .download(FILE_NAME);

    if (storageErr || !blob) {
      return new Response(JSON.stringify({
        error: `Fichier introuvable dans le bucket "${BUCKET}/${FILE_NAME}": ${storageErr?.message ?? "blob null"}`,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const text    = await blob.text();
    const records = parseCsv(text);

    // Colonnes attendues : produit, cip13, denomination, forme, statut, cis
    const valid = records.filter(r => /^\d{13}$/.test(r["cip13"] ?? ""));
    console.log(`Parsed ${records.length} rows → ${valid.length} CIP13 valides`);

    let inserted = 0;
    let batchErrors = 0;

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH)
        .map(r => ({
          cip13:          r["cip13"],
          medicament_nom: r["produit"]      || "",
          denomination:   r["denomination"] || null,
          forme:          r["forme"]        || null,
          statut:         r["statut"]       || null,
          cis:            r["cis"]          || null,
        }))
        .filter(r => r.medicament_nom.length > 0); // ignorer les noms vides

      if (!batch.length) continue;

      const { error } = await supabase
        .from("medicament_cip")
        .upsert(batch, { onConflict: "cip13,medicament_nom", ignoreDuplicates: true });

      if (error) {
        console.error(`Batch ${i} error:`, error.message);
        batchErrors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return new Response(JSON.stringify({
      success:  true,
      parsed:   records.length,
      valid:    valid.length,
      inserted,
      errors:   batchErrors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-cip-mapping fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
