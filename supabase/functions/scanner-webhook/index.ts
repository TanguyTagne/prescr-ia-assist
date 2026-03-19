import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scanner-key, x-device-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Authenticate via X-Scanner-Key header
    const scannerKey = req.headers.get("x-scanner-key");
    if (!scannerKey) {
      return new Response(JSON.stringify({ error: "Missing x-scanner-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate scanner key
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
    const deviceId = req.headers.get("x-device-id") || null;
    const body = await req.json();

    // Determine scan type
    const scanType = body.type || "prescription";
    const source = body.source || "api";

    if (scanType === "prescription") {
      // Insert into queue for async processing
      const inputData: Record<string, unknown> = {};
      if (body.image_base64) inputData.imageBase64 = body.image_base64;
      if (body.text) inputData.prescriptionText = body.text;
      if (body.file_url) inputData.fileUrl = body.file_url;

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
          scan_type: "prescription",
          status: "processing",
          input_data: inputData,
          source,
          device_id: deviceId,
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
            status: analyzeResp.ok ? "completed" : "error",
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
          .update({ status: "error", result: { error: String(procErr) }, processed_at: new Date().toISOString() })
          .eq("id", scan.id);
        throw procErr;
      }
    } else if (scanType === "article" || scanType === "barcode_batch") {
      // Article scan: lookup CIP codes and suggest complementary products
      const cipCodes: string[] = scanType === "barcode_batch"
        ? (body.cip_codes || [])
        : [body.cip_code].filter(Boolean);

      if (cipCodes.length === 0) {
        return new Response(JSON.stringify({ error: "Provide cip_code or cip_codes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: meds } = await supabaseAdmin
        .from("medicaments")
        .select("id, nom_commercial, atc_code, molecule_id, cip_code")
        .in("cip_code", cipCodes);

      const medIds = (meds || []).map((m) => m.id);
      let suggestions: unknown[] = [];

      if (medIds.length > 0) {
        const { data: medPathos } = await supabaseAdmin
          .from("medicament_pathologie")
          .select("pathologie_id, pathologies(id, nom_pathologie)")
          .in("medicament_id", medIds);

        const pathoIds = [...new Set((medPathos || []).map((mp) => mp.pathologie_id))];

        if (pathoIds.length > 0) {
          const { data: protos } = await supabaseAdmin
            .from("protocole_pathologie")
            .select(`
              pathologie_id,
              pathologies(nom_pathologie),
              produit_complementaire_1_id, produit_complementaire_2_id, produit_complementaire_3_id,
              justification_1, justification_2, justification_3,
              conseil_1_id, conseil_2_id,
              conseils_1:conseils_associes!protocole_pathologie_conseil_1_id_fkey(conseil),
              conseils_2:conseils_associes!protocole_pathologie_conseil_2_id_fkey(conseil)
            `)
            .in("pathologie_id", pathoIds)
            .eq("actif", true);

          const prodIds = (protos || []).flatMap((p) =>
            [p.produit_complementaire_1_id, p.produit_complementaire_2_id, p.produit_complementaire_3_id].filter(Boolean)
          );

          let products: Record<string, any> = {};
          if (prodIds.length > 0) {
            const { data: prods } = await supabaseAdmin
              .from("produits_complementaires")
              .select("id, produit, categorie, description, type_produit")
              .in("id", prodIds);
            (prods || []).forEach((p) => { products[p.id] = p; });
          }

          suggestions = (protos || []).map((proto) => ({
            pathologie: (proto.pathologies as any)?.nom_pathologie,
            conseil_1: (proto.conseils_1 as any)?.conseil,
            conseil_2: (proto.conseils_2 as any)?.conseil,
            produits: [
              proto.produit_complementaire_1_id ? { ...products[proto.produit_complementaire_1_id], justification: proto.justification_1 } : null,
              proto.produit_complementaire_2_id ? { ...products[proto.produit_complementaire_2_id], justification: proto.justification_2 } : null,
              proto.produit_complementaire_3_id ? { ...products[proto.produit_complementaire_3_id], justification: proto.justification_3 } : null,
            ].filter(Boolean),
          }));
        }
      }

      const { data: scan } = await supabaseAdmin
        .from("scan_queue")
        .insert({
          pharmacy_id: pharmacyId,
          scan_type: scanType,
          status: "completed",
          input_data: { cip_codes: cipCodes },
          result: {
            medicaments: meds || [],
            suggestions,
            unrecognized: cipCodes.filter((c) => !(meds || []).some((m) => m.cip_code === c)),
          },
          source,
          device_id: deviceId,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          scan_id: scan?.id,
          medicaments: meds || [],
          suggestions,
          unrecognized: cipCodes.filter((c) => !(meds || []).some((m) => m.cip_code === c)),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    } else if (scanType === "sale") {
      // ===== SALE TRACKING =====
      // The POS sends a completed sale with all items (CIP codes)
      // We detect which items are prescription meds vs complementary products
      const items = body.items || []; // [{cip_code, nom, quantity, prix}]
      const transactionId = body.transaction_id || null;

      if (!items.length) {
        return new Response(JSON.stringify({ error: "Provide items array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Record the sale transaction
      const { data: sale, error: saleErr } = await supabaseAdmin
        .from("sales_transactions")
        .insert({
          pharmacy_id: pharmacyId,
          transaction_id: transactionId,
          device_id: deviceId,
          items,
          total_items: items.length,
          source,
        })
        .select()
        .single();

      if (saleErr) throw saleErr;

      // 2. Extract all CIP codes from the sale
      const cipCodes = items.map((i: any) => i.cip_code).filter(Boolean);
      if (cipCodes.length === 0) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 3. Find which items are known medicaments
      const { data: saleMeds } = await supabaseAdmin
        .from("medicaments")
        .select("id, nom_commercial, cip_code")
        .in("cip_code", cipCodes);

      const soldMedIds = (saleMeds || []).map(m => m.id);

      if (soldMedIds.length === 0) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No known medications in sale" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 4. Get pathologies linked to those meds
      const { data: medPathos } = await supabaseAdmin
        .from("medicament_pathologie")
        .select("medicament_id, pathologie_id, pathologies(nom_pathologie)")
        .in("medicament_id", soldMedIds);

      if (!medPathos || medPathos.length === 0) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No pathology links found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 5. Get recommended complementary products for those pathologies
      const pathoIds = [...new Set(medPathos.map(mp => mp.pathologie_id))];
      const { data: protos } = await supabaseAdmin
        .from("protocole_pathologie")
        .select(`
          pathologie_id, pathologies(nom_pathologie),
          produit_complementaire_1_id, produit_complementaire_2_id, produit_complementaire_3_id
        `)
        .in("pathologie_id", pathoIds)
        .eq("actif", true);

      if (!protos || protos.length === 0) {
        return new Response(
          JSON.stringify({ sale_id: sale.id, cross_sell_matches: 0, message: "No protocols found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 6. Get all recommended product details
      const recProdIds = protos.flatMap(p =>
        [p.produit_complementaire_1_id, p.produit_complementaire_2_id, p.produit_complementaire_3_id].filter(Boolean)
      );

      const { data: recProducts } = await supabaseAdmin
        .from("produits_complementaires")
        .select("id, produit, categorie, type_produit")
        .in("id", recProdIds);

      // 7. Get medicaments that match complementary product names (fuzzy match by name)
      // Also check if any sale item name matches a complementary product
      const soldItemNames = items.map((i: any) => (i.nom || "").toLowerCase().trim());
      const soldCipSet = new Set(cipCodes);

      // Build cross-sell tracking records
      const crossSellRecords: any[] = [];

      for (const proto of protos) {
        const pathoName = (proto.pathologies as any)?.nom_pathologie || "";
        
        // Find which med triggered this pathology
        const triggerMedPatho = medPathos.find(mp => mp.pathologie_id === proto.pathologie_id);
        const triggerMed = saleMeds?.find(m => m.id === triggerMedPatho?.medicament_id);

        const complementaryIds = [
          proto.produit_complementaire_1_id,
          proto.produit_complementaire_2_id,
          proto.produit_complementaire_3_id,
        ].filter(Boolean);

        for (const compId of complementaryIds) {
          const compProduct = recProducts?.find(p => p.id === compId);
          if (!compProduct) continue;

          // Check if the complementary product was sold in this transaction
          // Match by name similarity (case-insensitive partial match)
          const compName = compProduct.produit.toLowerCase().trim();
          const wasSold = soldItemNames.some((soldName: string) => {
            if (!soldName) return false;
            return soldName.includes(compName) || compName.includes(soldName) ||
              // Also check partial word match (e.g. "Doliprane 1000mg" matches "Doliprane")
              soldName.split(" ").some((w: string) => w.length > 3 && compName.includes(w)) ||
              compName.split(" ").some((w: string) => w.length > 3 && soldName.includes(w));
          });

          crossSellRecords.push({
            pharmacy_id: pharmacyId,
            sale_id: sale.id,
            medicament_id: triggerMed?.id || null,
            medicament_nom: triggerMed?.nom_commercial || "Inconnu",
            pathologie_id: proto.pathologie_id,
            pathologie_nom: pathoName,
            produit_complementaire_id: compId,
            produit_complementaire_nom: compProduct.produit,
            was_sold: wasSold,
          });
        }
      }

      // 8. Insert cross-sell tracking records
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
          sale_id: sale.id,
          cross_sell_matches: inserted,
          products_sold: soldCount,
          products_recommended: crossSellRecords.length,
          cross_sell_rate: crossSellRecords.length > 0
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
