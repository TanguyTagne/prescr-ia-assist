import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scanner-key, x-device-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── CIP lookup enrichi ────────────────────────────────────────────────────
// 1. Cherche d'abord dans medicaments.cip_code (lookup direct, le plus rapide)
// 2. Pour les CIPs non résolus, cherche dans medicament_cip (table BDPM complète)
//    puis résout le nom_commercial → medicament_id
async function lookupMedicamentsByCip(
  supabase: ReturnType<typeof createClient>,
  cipCodes: string[],
): Promise<{ meds: any[]; unrecognized: string[] }> {
  if (!cipCodes.length) return { meds: [], unrecognized: [] };

  // ── Pass 1 : lookup direct ──────────────────────────────────────────────
  const { data: directMeds } = await supabase
    .from("medicaments")
    .select("id, nom_commercial, atc_code, molecule_id, cip_code")
    .in("cip_code", cipCodes);

  const foundCips = new Set((directMeds || []).map((m: any) => m.cip_code as string));
  const missing   = cipCodes.filter(c => !foundCips.has(c));

  if (!missing.length) {
    return { meds: directMeds || [], unrecognized: [] };
  }

  // ── Pass 2 : fallback via medicament_cip (table BDPM) ──────────────────
  const { data: cipRows } = await supabase
    .from("medicament_cip")
    .select("cip13, medicament_nom")
    .in("cip13", missing);

  if (!cipRows?.length) {
    return { meds: directMeds || [], unrecognized: missing };
  }

  const nomSet = [...new Set(cipRows.map((r: any) => r.medicament_nom as string))];
  // ILIKE prefix match : "Doliprane" matche "Doliprane 1000mg", "Doliprane 500mg", etc.
  const { data: resolvedMeds } = await supabase
    .from("medicaments")
    .select("id, nom_commercial, atc_code, molecule_id, cip_code")
    .or(nomSet.map((n: string) => `nom_commercial.ilike.${n}%`).join(","));

  // Pour chaque nom court (ex: "Doliprane"), trouver le meilleur médicament correspondant
  // Préférence : match exact, sinon le nom le plus court (forme générique).
  // On filtre côté JS les vieux orphelins préfixés "__" : en SQL LIKE, "_"
  // est un wildcard, donc un filtre "not like '__%'" exclurait tous les noms.
  const nomToMed = new Map<string, any>();
  for (const nom of nomSet) {
    const matches = (resolvedMeds || []).filter((m: any) =>
      m.nom_commercial.toLowerCase().startsWith(nom.toLowerCase()) &&
      !String(m.nom_commercial || "").startsWith("__"),
    );
    if (!matches.length) continue;
    const exact = matches.find((m: any) => m.nom_commercial.toLowerCase() === nom.toLowerCase());
    nomToMed.set(nom, exact ?? matches.sort((a: any, b: any) => a.nom_commercial.length - b.nom_commercial.length)[0]);
  }

  const extraMeds: any[]   = [];
  const stillMissing: string[] = [];

  for (const cip of missing) {
    const cipRow = cipRows.find((r: any) => r.cip13 === cip);
    if (!cipRow) { stillMissing.push(cip); continue; }
    const med = nomToMed.get(cipRow.medicament_nom);
    if (!med)  { stillMissing.push(cip); continue; }
    // Injecter le CIP scanné comme cip_code pour que le filtre "unrecognized" fonctionne
    extraMeds.push({ ...med, cip_code: cip });
  }

  return {
    meds:         [...(directMeds || []), ...extraMeds],
    unrecognized: stillMissing,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Authentifier via X-Scanner-Key ────────────────────────────────────
    const scannerKey = req.headers.get("x-scanner-key");
    if (!scannerKey) {
      return new Response(JSON.stringify({ error: "Missing x-scanner-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: keyData, error: keyErr } = await supabaseAdmin
      .from("pharmacy_scanner_keys")
      .select("pharmacy_id, active")
      .eq("api_key", scannerKey)
      .single();

    if (keyErr || !keyData || !keyData.active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive scanner key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pharmacyId = keyData.pharmacy_id;
    const deviceId   = req.headers.get("x-device-id") || null;
    const body       = await req.json();
    const scanType   = body.type   || "prescription";
    const source     = body.source || "api";

    // ════════════════════════════════════════════════════════════════════════
    // SCAN TYPE : prescription
    // ════════════════════════════════════════════════════════════════════════
    if (scanType === "prescription") {
      const inputData: Record<string, unknown> = {};
      if (body.image_base64) inputData.imageBase64      = body.image_base64;
      if (body.text)         inputData.prescriptionText = body.text;
      if (body.file_url)     inputData.fileUrl          = body.file_url;

      if (!inputData.imageBase64 && !inputData.prescriptionText && !inputData.fileUrl) {
        return new Response(JSON.stringify({ error: "Provide image_base64, text, or file_url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: scan, error: insertErr } = await supabaseAdmin
        .from("scan_queue")
        .insert({
          pharmacy_id: pharmacyId,
          scan_type:   "prescription",
          status:      "processing",
          input_data:  inputData,
          source,
          device_id:   deviceId,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      try {
        const analyzeResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-prescription`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify(inputData),
          },
        );

        const result = await analyzeResp.json();

        await supabaseAdmin
          .from("scan_queue")
          .update({
            status:       analyzeResp.ok ? "completed" : "error",
            result,
            processed_at: new Date().toISOString(),
          })
          .eq("id", scan.id);

        return new Response(
          JSON.stringify({ scan_id: scan.id, status: "completed", result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (procErr) {
        await supabaseAdmin
          .from("scan_queue")
          .update({
            status:       "error",
            result:       { error: String(procErr) },
            processed_at: new Date().toISOString(),
          })
          .eq("id", scan.id);
        throw procErr;
      }

    // ════════════════════════════════════════════════════════════════════════
    // SCAN TYPE : article / barcode_batch
    // ════════════════════════════════════════════════════════════════════════
    } else if (scanType === "article" || scanType === "barcode_batch") {
      const cipCodes: string[] = scanType === "barcode_batch"
        ? (body.cip_codes || [])
        : [body.cip_code].filter(Boolean);

      if (cipCodes.length === 0) {
        return new Response(JSON.stringify({ error: "Provide cip_code or cip_codes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Lookup enrichi (cip_code direct + fallback medicament_cip BDPM) ──
      const { meds, unrecognized } = await lookupMedicamentsByCip(supabaseAdmin, cipCodes);

      const medIds    = (meds || []).map((m: any) => m.id);
      let suggestions: any[] = [];

      if (medIds.length > 0) {
        const { data: curated } = await supabaseAdmin
          .from("medicament_curated_pcs")
          .select("medicament_id, pc_1, pc_2")
          .in("medicament_id", medIds);

        suggestions = (curated || []).map((c: any) => {
          const med = (meds || []).find((m: any) => m.id === c.medicament_id);
          const produits = [c.pc_1, c.pc_2]
            .filter((p: any) => p && String(p).trim().length > 0)
            .map((p: string) => ({ produit: p, categorie: "", type_produit: "curated" }));
          return {
            medicament: med?.nom_commercial,
            medicament_id: c.medicament_id,
            produits,
          };
        }).filter((s: any) => s.produits.length > 0);
      }

      // ── Tracking temporel cross-sell : fenêtre 10 minutes ────────────────
      const normalize = (s: string) =>
        (s || "")
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      // 1) MATCH : le scan courant correspond-il à un PC proposé dans les 10 dernières min ?
      let matchedCount = 0;
      try {
        const { data: pendings } = await supabaseAdmin
          .from("pending_cross_sell")
          .select("*")
          .eq("pharmacy_id", pharmacyId)
          .is("matched_at", null)
          .gt("expires_at", new Date().toISOString());

        if (pendings?.length) {
          const scannedNames = (meds || []).map((m: any) => ({
            nom: m.nom_commercial as string,
            cip: m.cip_code as string | null,
            norm: normalize(m.nom_commercial),
          }));
          const scannedCipsSet = new Set(cipCodes);
          // Si aucun med reconnu, on tente quand même un match nom via le code brut (rare)
          if (!scannedNames.length) {
            for (const c of cipCodes) scannedNames.push({ nom: c, cip: c, norm: normalize(c) });
          }

          const toMarkIds: string[] = [];
          const crossSellInserts: any[] = [];

          for (const p of pendings) {
            let matched = false;
            if (p.pc_cip && scannedCipsSet.has(p.pc_cip)) matched = true;
            if (!matched) {
              matched = scannedNames.some((s) => {
                if (!s.norm || !p.pc_normalized) return false;
                if (s.norm === p.pc_normalized) return true;
                if (s.norm.includes(p.pc_normalized) || p.pc_normalized.includes(s.norm)) return true;
                const pcWords = (p.pc_normalized as string).split(" ").filter((w) => w.length >= 4);
                return pcWords.some((w) => s.norm.includes(w));
              });
            }
            if (matched) {
              toMarkIds.push(p.id);
              crossSellInserts.push({
                pharmacy_id: pharmacyId,
                sale_id: null,
                medicament_id: p.medicament_id,
                medicament_nom: p.medicament_nom,
                pathologie_id: p.pathologie_id,
                pathologie_nom: p.pathologie_nom,
                produit_complementaire_nom: p.pc_name,
                was_sold: true,
                match_source: "scan_window_10min",
                matched_at: new Date().toISOString(),
              });
            }
          }

          if (toMarkIds.length) {
            await supabaseAdmin
              .from("pending_cross_sell")
              .update({
                matched_at: new Date().toISOString(),
                matched_cip: cipCodes[0] || null,
                matched_nom: (meds?.[0] as any)?.nom_commercial ?? null,
              })
              .in("id", toMarkIds);
          }
          if (crossSellInserts.length) {
            await supabaseAdmin.from("cross_sell_tracking").insert(crossSellInserts);
            matchedCount = crossSellInserts.length;
            // Incrément times_sold sur recommendation_metrics (best-effort, ignore les manquants)
            for (const m of crossSellInserts) {
              const { data: row } = await supabaseAdmin
                .from("recommendation_metrics")
                .select("id, times_sold")
                .eq("pharmacy_id", pharmacyId)
                .eq("medicament_source", m.medicament_nom)
                .eq("pc_proposed", m.produit_complementaire_nom)
                .maybeSingle();
              if (row?.id) {
                await supabaseAdmin
                  .from("recommendation_metrics")
                  .update({ times_sold: (row.times_sold ?? 0) + 1, updated_at: new Date().toISOString() })
                  .eq("id", row.id);
              }
            }
          }
        }
      } catch (e) {
        console.error("pending cross-sell match error:", e);
      }

      // 2) PROPOSITION : enregistre tous les PCs proposés pour CE scan (10 min de fenêtre)
      try {
        const pendingRows: any[] = [];
        for (const s of suggestions) {
          for (const p of (s.produits || [])) {
            pendingRows.push({
              pharmacy_id: pharmacyId,
              device_id: deviceId,
              medicament_id: s.medicament_id || null,
              medicament_nom: s.medicament || "Inconnu",
              pc_name: p.produit,
              pc_normalized: normalize(p.produit),
              pc_cip: p.cip_code || null,
            });
          }
        }
        if (pendingRows.length) {
          await supabaseAdmin.from("pending_cross_sell").insert(pendingRows);
        }
      } catch (e) {
        console.error("pending cross-sell insert error:", e);
      }

      const { data: scan } = await supabaseAdmin
        .from("scan_queue")
        .insert({
          pharmacy_id: pharmacyId,
          scan_type:   scanType,
          status:      "completed",
          input_data:  { cip_codes: cipCodes },
          result: {
            medicaments: meds || [],
            suggestions,
            unrecognized,
            cross_sell_matched: matchedCount,
          },
          source,
          device_id:    deviceId,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          scan_id: scan?.id,
          medicaments: meds || [],
          suggestions,
          unrecognized,
          cross_sell_matched: matchedCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    // ════════════════════════════════════════════════════════════════════════
    // SCAN TYPE : sale
    // ════════════════════════════════════════════════════════════════════════
    } else if (scanType === "sale") {
      const items         = body.items || [];
      const transactionId = body.transaction_id || null;

      if (!items.length) {
        return new Response(JSON.stringify({ error: "Provide items array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sale, error: saleErr } = await supabaseAdmin
        .from("sales_transactions")
        .insert({
          pharmacy_id:    pharmacyId,
          transaction_id: transactionId,
          device_id:      deviceId,
          items,
          total_items:    items.length,
          source,
        })
        .select()
        .single();

      if (saleErr) throw saleErr;

      const saleCipCodes: string[] = items.map((i: any) => i.cip_code).filter(Boolean);
      if (!saleCipCodes.length) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ── Lookup enrichi pour les médicaments de la vente ─────────────────
      const { meds: saleMeds } = await lookupMedicamentsByCip(supabaseAdmin, saleCipCodes);

      const soldMedIds = (saleMeds || []).map((m: any) => m.id);
      if (!soldMedIds.length) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No known medications in sale" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: medPathos } = await supabaseAdmin
        .from("medicament_pathologie")
        .select("medicament_id, pathologie_id, pathologies(nom_pathologie)")
        .in("medicament_id", soldMedIds);

      if (!medPathos?.length) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No pathology links found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pathoIds = [...new Set(medPathos.map((mp: any) => mp.pathologie_id))];
      const { data: protos } = await supabaseAdmin
        .from("protocole_pathologie")
        .select(`
          pathologie_id, pathologies(nom_pathologie),
          produit_complementaire_1_id, produit_complementaire_2_id, produit_complementaire_3_id
        `)
        .in("pathologie_id", pathoIds)
        .eq("actif", true);

      if (!protos?.length) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No protocols found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const recProdIds = protos.flatMap((p: any) =>
        [p.produit_complementaire_1_id, p.produit_complementaire_2_id, p.produit_complementaire_3_id]
          .filter(Boolean),
      );

      const { data: recProducts } = await supabaseAdmin
        .from("produits_complementaires")
        .select("id, produit, categorie, type_produit")
        .in("id", recProdIds);

      const soldItemNames = items.map((i: any) => (i.nom || "").toLowerCase().trim());

      const crossSellRecords: any[] = [];

      for (const proto of protos) {
        const pathoName      = (proto.pathologies as any)?.nom_pathologie || "";
        const triggerMedPatho = medPathos.find((mp: any) => mp.pathologie_id === proto.pathologie_id);
        const triggerMed      = saleMeds?.find((m: any) => m.id === triggerMedPatho?.medicament_id);

        const complementaryIds = [
          proto.produit_complementaire_1_id,
          proto.produit_complementaire_2_id,
          proto.produit_complementaire_3_id,
        ].filter(Boolean);

        for (const compId of complementaryIds) {
          const compProduct = recProducts?.find((p: any) => p.id === compId);
          if (!compProduct) continue;

          const compName = compProduct.produit.toLowerCase().trim();
          const wasSold  = soldItemNames.some((soldName: string) => {
            if (!soldName) return false;
            return soldName.includes(compName) || compName.includes(soldName) ||
              soldName.split(" ").some((w: string) => w.length > 3 && compName.includes(w)) ||
              compName.split(" ").some((w: string) => w.length > 3 && soldName.includes(w));
          });

          crossSellRecords.push({
            pharmacy_id:              pharmacyId,
            sale_id:                  sale.id,
            medicament_id:            triggerMed?.id   || null,
            medicament_nom:           triggerMed?.nom_commercial || "Inconnu",
            pathologie_id:            proto.pathologie_id,
            pathologie_nom:           pathoName,
            produit_complementaire_id:   compId,
            produit_complementaire_nom:  compProduct.produit,
            was_sold:                 wasSold,
          });
        }
      }

      let inserted = 0;
      if (crossSellRecords.length > 0) {
        const { data: insertedData, error: csErr } = await supabaseAdmin
          .from("cross_sell_tracking")
          .insert(crossSellRecords)
          .select("id");
        if (csErr) console.error("cross_sell insert error:", csErr);
        inserted = insertedData?.length || 0;
      }

      const soldCount = crossSellRecords.filter(r => r.was_sold).length;

      return new Response(
        JSON.stringify({
          sale_id:             sale.id,
          cross_sell_matches:  inserted,
          products_sold:       soldCount,
          products_recommended: crossSellRecords.length,
          cross_sell_rate:     crossSellRecords.length > 0
            ? Math.round((soldCount / crossSellRecords.length) * 100)
            : 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Unknown scan type: ${scanType}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("scanner-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
