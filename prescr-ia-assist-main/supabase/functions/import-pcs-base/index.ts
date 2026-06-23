/**
 * Importe base-medicaments-pcs-COMPLETE.csv depuis le bucket Storage "imports".
 * ~78 200 lignes | 2 602 médicaments | 2 PCs par pathologie.
 *
 * Appel : POST /import-pcs-base?pass=N  (Authorization: Bearer <admin_token>)
 *   pass=1 → upsert médicaments
 *   pass=2 → upsert pathologies
 *   pass=3 → upsert produits_complementaires
 *   pass=4 → upsert medicament_pathologie
 *   pass=5 → insert protocole_pathologie (skip si déjà existant)
 *
 * Chaque passe est idempotente. Appeler dans l'ordre 1→5.
 * Admin only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET    = "imports";
const FILE_NAME = "base-medicaments-pcs-COMPLETE.csv";
const BATCH     = 200;

// ── CSV parser ─────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Auth admin ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Non autorisé" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  const { data: { user }, error: userErr } =
    await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !user) return new Response(JSON.stringify({ error: "Token invalide" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Admin requis" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  // ── Lire le paramètre pass ────────────────────────────────────────────────
  const url  = new URL(req.url);
  const pass = parseInt(url.searchParams.get("pass") ?? "0", 10);
  if (pass < 1 || pass > 5) {
    return new Response(JSON.stringify({
      error: "Paramètre pass requis (1-5). Appelez pass=1 puis 2, 3, 4, 5 dans l'ordre.",
      usage: "POST /import-pcs-base?pass=1",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // ── Télécharger le CSV ────────────────────────────────────────────────
    const { data: blob, error: storageErr } = await supabase.storage
      .from(BUCKET)
      .download(FILE_NAME);

    if (storageErr || !blob) {
      return new Response(JSON.stringify({
        error: `Fichier introuvable dans "${BUCKET}/${FILE_NAME}": ${storageErr?.message ?? "blob null"}`,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const text = await blob.text();
    const rows = parseCsv(text);
    console.log(`CSV: ${rows.length} lignes, passe ${pass}`);

    // ── Colonnes CSV ──────────────────────────────────────────────────────
    // medicament, dosage, forme, laboratoire, cip, atc_code, molecule,
    // pathologie, score_med_patho, pc_propose, pc_categorie, type_produit,
    // finalite, pc_priorite, phrase_conseil

    const result: Record<string, unknown> = { pass, success: true };

    // ════════════════════════════════════════════════════════════════════════
    // PASSE 1 — Upsert médicaments
    // ════════════════════════════════════════════════════════════════════════
    if (pass === 1) {
      // Dédupliquer par nom_commercial (première occurrence)
      const medMap = new Map<string, Record<string, string>>();
      for (const r of rows) {
        if (!r["medicament"]) continue;
        if (!medMap.has(r["medicament"])) medMap.set(r["medicament"], r);
      }

      // Charger les médicaments existants
      const { data: existing } = await supabase
        .from("medicaments")
        .select("nom_commercial");
      const existingNames = new Set((existing || []).map((m: any) => m.nom_commercial));

      const toInsert = [...medMap.values()]
        .filter(r => !existingNames.has(r["medicament"]))
        .map(r => ({
          nom_commercial:   r["medicament"],
          atc_code:         r["atc_code"]   || null,
          forme_galenique:  r["forme"]      || null,
          laboratoire:      r["laboratoire"]|| null,
          dosage:           r["dosage"]     || null,
          cip_code:         r["cip"]        || null,
          est_otc:          false,
          est_produit_conseil: false,
          statut_officine:  "actif",
        }));

      let inserted = 0;
      for (const batch of chunks(toInsert, BATCH)) {
        const { error } = await supabase.from("medicaments").insert(batch);
        if (error) console.error("Pass1 batch error:", error.message);
        else inserted += batch.length;
      }

      result.unique_in_csv = medMap.size;
      result.already_existed = existingNames.size;
      result.inserted = inserted;
      result.skipped  = toInsert.length - inserted;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASSE 2 — Upsert pathologies
    // ════════════════════════════════════════════════════════════════════════
    else if (pass === 2) {
      const pathoSet = new Set<string>(
        rows.map(r => r["pathologie"]).filter(Boolean)
      );

      const { data: existing } = await supabase
        .from("pathologies")
        .select("nom_pathologie");
      const existingNames = new Set((existing || []).map((p: any) => p.nom_pathologie));

      const toInsert = [...pathoSet]
        .filter(nom => !existingNames.has(nom))
        .map(nom => ({ nom_pathologie: nom, niveau_gravite: 1 }));

      let inserted = 0;
      for (const batch of chunks(toInsert, BATCH)) {
        const { error } = await supabase.from("pathologies").insert(batch);
        if (error) console.error("Pass2 batch error:", error.message);
        else inserted += batch.length;
      }

      result.unique_in_csv   = pathoSet.size;
      result.already_existed = existingNames.size;
      result.inserted        = inserted;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASSE 3 — Upsert produits_complementaires
    // ════════════════════════════════════════════════════════════════════════
    else if (pass === 3) {
      // Construire la map (pathologie_nom, pc_propose) → données
      type PcEntry = {
        pathologie: string; pc_propose: string; pc_categorie: string;
        type_produit: string; finalite: string; pc_priorite: number;
        phrase_conseil: string;
      };
      const pcMap = new Map<string, PcEntry>();
      for (const r of rows) {
        if (!r["pathologie"] || !r["pc_propose"]) continue;
        const key = `${r["pathologie"]}__${r["pc_propose"]}`;
        if (!pcMap.has(key)) {
          pcMap.set(key, {
            pathologie:     r["pathologie"],
            pc_propose:     r["pc_propose"],
            pc_categorie:   r["pc_categorie"]   || "",
            type_produit:   r["type_produit"]   || "produit_conseil",
            finalite:       r["finalite"]       || "",
            pc_priorite:    parseInt(r["pc_priorite"] || "50", 10),
            phrase_conseil: r["phrase_conseil"] || "",
          });
        }
      }

      // Charger les IDs de pathologies
      const pathoNoms = [...new Set([...pcMap.values()].map(e => e.pathologie))];
      const { data: pathoRows } = await supabase
        .from("pathologies")
        .select("id, nom_pathologie")
        .in("nom_pathologie", pathoNoms);
      const pathoNameToId = new Map((pathoRows || []).map((p: any) => [p.nom_pathologie, p.id]));

      // Charger les PCs déjà existants (par pathologie_id + produit)
      const pathoIds = [...pathoNameToId.values()];
      let existingSet = new Set<string>();
      if (pathoIds.length > 0) {
        for (const idBatch of chunks(pathoIds, 200)) {
          const { data: existingPCs } = await supabase
            .from("produits_complementaires")
            .select("produit, pathologie_id")
            .in("pathologie_id", idBatch);
          (existingPCs || []).forEach((pc: any) => {
            existingSet.add(`${pc.pathologie_id}__${pc.produit}`);
          });
        }
      }

      const toInsert = [...pcMap.values()]
        .map(e => {
          const pathologie_id = pathoNameToId.get(e.pathologie);
          if (!pathologie_id) return null;
          const key = `${pathologie_id}__${e.pc_propose}`;
          if (existingSet.has(key)) return null;
          return {
            produit:               e.pc_propose,
            nom_produit:           e.pc_propose,
            categorie:             e.pc_categorie || null,
            description:           e.phrase_conseil || null,
            type_produit:          e.type_produit,
            pathologie_id,
            priorite:              e.pc_priorite,
            est_complement:        e.type_produit === "complement",
            est_dispositif_medical:e.type_produit === "dispositif_medical",
            est_otc:               true,
            est_eligible_cross_sell: true,
          };
        })
        .filter(Boolean) as any[];

      let inserted = 0;
      for (const batch of chunks(toInsert, BATCH)) {
        const { error } = await supabase.from("produits_complementaires").insert(batch);
        if (error) console.error("Pass3 batch error:", error.message);
        else inserted += batch.length;
      }

      result.unique_in_csv   = pcMap.size;
      result.pathos_resolved = pathoNameToId.size;
      result.already_existed = existingSet.size;
      result.inserted        = inserted;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASSE 4 — Upsert medicament_pathologie
    // ════════════════════════════════════════════════════════════════════════
    else if (pass === 4) {
      // Dédupliquer (medicament, pathologie) → score max
      const linkMap = new Map<string, { med: string; patho: string; score: number }>();
      for (const r of rows) {
        if (!r["medicament"] || !r["pathologie"]) continue;
        const key   = `${r["medicament"]}__${r["pathologie"]}`;
        const score = parseInt(r["score_med_patho"] || "50", 10);
        if (!linkMap.has(key) || score > linkMap.get(key)!.score) {
          linkMap.set(key, { med: r["medicament"], patho: r["pathologie"], score });
        }
      }

      // Charger les IDs
      const medNoms   = [...new Set([...linkMap.values()].map(l => l.med))];
      const pathoNoms = [...new Set([...linkMap.values()].map(l => l.patho))];

      const medNameToId   = new Map<string, string>();
      const pathoNameToId = new Map<string, string>();

      for (const batch of chunks(medNoms, 200)) {
        const { data } = await supabase
          .from("medicaments").select("id, nom_commercial").in("nom_commercial", batch);
        (data || []).forEach((m: any) => medNameToId.set(m.nom_commercial, m.id));
      }
      for (const batch of chunks(pathoNoms, 200)) {
        const { data } = await supabase
          .from("pathologies").select("id, nom_pathologie").in("nom_pathologie", batch);
        (data || []).forEach((p: any) => pathoNameToId.set(p.nom_pathologie, p.id));
      }

      // Charger les liens déjà existants
      const medIds   = [...medNameToId.values()];
      const existingLinks = new Set<string>();
      if (medIds.length > 0) {
        for (const batch of chunks(medIds, 200)) {
          const { data } = await supabase
            .from("medicament_pathologie")
            .select("medicament_id, pathologie_id")
            .in("medicament_id", batch);
          (data || []).forEach((l: any) => {
            existingLinks.add(`${l.medicament_id}__${l.pathologie_id}`);
          });
        }
      }

      const toInsert = [...linkMap.values()]
        .map(l => {
          const medicament_id = medNameToId.get(l.med);
          const pathologie_id = pathoNameToId.get(l.patho);
          if (!medicament_id || !pathologie_id) return null;
          if (existingLinks.has(`${medicament_id}__${pathologie_id}`)) return null;
          return {
            medicament_id,
            pathologie_id,
            score_pertinence: l.score,
            source_mapping:   "csv_import",
          };
        })
        .filter(Boolean) as any[];

      let inserted = 0;
      for (const batch of chunks(toInsert, BATCH)) {
        const { error } = await supabase.from("medicament_pathologie").insert(batch);
        if (error) console.error("Pass4 batch error:", error.message);
        else inserted += batch.length;
      }

      result.links_in_csv    = linkMap.size;
      result.meds_resolved   = medNameToId.size;
      result.pathos_resolved = pathoNameToId.size;
      result.already_existed = existingLinks.size;
      result.inserted        = inserted;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASSE 5 — Insert protocole_pathologie (skip si déjà actif)
    // ════════════════════════════════════════════════════════════════════════
    else if (pass === 5) {
      // Grouper les PCs par pathologie (triés par priorité DESC, dédupliqués)
      type PcSlot = {
        pc_propose: string; pc_priorite: number;
        phrase_conseil: string; type_produit: string; pc_categorie: string;
      };
      const pcsByPatho = new Map<string, PcSlot[]>();
      for (const r of rows) {
        if (!r["pathologie"] || !r["pc_propose"]) continue;
        const list = pcsByPatho.get(r["pathologie"]) ?? [];
        if (!list.some(s => s.pc_propose === r["pc_propose"])) {
          list.push({
            pc_propose:     r["pc_propose"],
            pc_priorite:    parseInt(r["pc_priorite"] || "50", 10),
            phrase_conseil: r["phrase_conseil"] || "",
            type_produit:   r["type_produit"]   || "produit_conseil",
            pc_categorie:   r["pc_categorie"]   || "",
          });
        }
        pcsByPatho.set(r["pathologie"], list);
      }

      const pathoNoms = [...pcsByPatho.keys()];

      // Charger IDs pathologies
      const pathoNameToId = new Map<string, string>();
      for (const batch of chunks(pathoNoms, 200)) {
        const { data } = await supabase
          .from("pathologies").select("id, nom_pathologie").in("nom_pathologie", batch);
        (data || []).forEach((p: any) => pathoNameToId.set(p.nom_pathologie, p.id));
      }

      // Pathologies qui ont déjà un protocole actif
      const pathoIds = [...pathoNameToId.values()];
      const existingProtoPathos = new Set<string>();
      if (pathoIds.length > 0) {
        for (const batch of chunks(pathoIds, 200)) {
          const { data } = await supabase
            .from("protocole_pathologie")
            .select("pathologie_id")
            .in("pathologie_id", batch)
            .eq("actif", true);
          (data || []).forEach((p: any) => existingProtoPathos.add(p.pathologie_id));
        }
      }

      // Pour chaque pathologie sans protocole, résoudre les IDs des PCs
      // et construire l'entrée protocole_pathologie
      const toInsert: any[] = [];

      for (const [pathoNom, pcList] of pcsByPatho) {
        const pathologie_id = pathoNameToId.get(pathoNom);
        if (!pathologie_id || existingProtoPathos.has(pathologie_id)) continue;

        // Top 3 PCs par priorité
        const top3 = pcList
          .sort((a, b) => b.pc_priorite - a.pc_priorite)
          .slice(0, 3);

        if (top3.length === 0) continue;

        // Résoudre les IDs produits_complementaires
        const pcNoms = top3.map(p => p.pc_propose);
        const { data: pcRows } = await supabase
          .from("produits_complementaires")
          .select("id, produit")
          .eq("pathologie_id", pathologie_id)
          .in("produit", pcNoms);

        const pcNomToId = new Map((pcRows || []).map((r: any) => [r.produit, r.id]));

        // Au moins 1 PC résolu pour créer un protocole
        const pc1 = pcNomToId.get(top3[0]?.pc_propose);
        if (!pc1) continue;

        toInsert.push({
          pathologie_id,
          produit_complementaire_1_id: pc1 ?? null,
          justification_1:             top3[0]?.phrase_conseil ?? null,
          priorite_produit_1:          top3[0]?.pc_priorite    ?? 90,
          produit_complementaire_2_id: pcNomToId.get(top3[1]?.pc_propose) ?? null,
          justification_2:             top3[1]?.phrase_conseil ?? null,
          priorite_produit_2:          top3[1]?.pc_priorite    ?? 70,
          produit_complementaire_3_id: pcNomToId.get(top3[2]?.pc_propose) ?? null,
          justification_3:             top3[2]?.phrase_conseil ?? null,
          priorite_produit_3:          top3[2]?.pc_priorite    ?? 50,
          actif:             true,
          version_protocole: 1,
        });
      }

      let inserted = 0;
      for (const batch of chunks(toInsert, 50)) {
        const { error } = await supabase.from("protocole_pathologie").insert(batch);
        if (error) console.error("Pass5 batch error:", error.message);
        else inserted += batch.length;
      }

      result.pathos_in_csv    = pathoNoms.length;
      result.pathos_resolved  = pathoNameToId.size;
      result.already_had_protocol = existingProtoPathos.size;
      result.inserted         = inserted;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`import-pcs-base pass${pass} fatal:`, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
