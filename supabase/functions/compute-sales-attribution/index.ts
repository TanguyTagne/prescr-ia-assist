// Compute monthly sales attribution per pharmacy / category.
//
// Aggregates pc_feedback entries (segmented by detection_source) and recommendation_metrics
// to populate sales_attribution_monthly. Estimates a rough revenue using a flat average
// price per category (5€ default).
//
// Triggered by:
// - pg_cron monthly job (1st of each month, processes previous month)
// - manual admin invocation { month: "YYYY-MM-01" } (defaults to previous month)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Prix moyen indicatif par catégorie (EUR). Affiné en V2 avec prix LGO réels.
// Prix moyen unifié des PC à 12€ (calibré 2026-06 sur retours pharmacies).
const CATEGORY_AVG_PRICE: Record<string, number> = {};
const DEFAULT_AVG_PRICE = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_KEY,
    );

    // ── Auth: allow either service-role (pg_cron) or an admin user ────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (token !== SERVICE_KEY) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id, _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    // Parse target month — defaults to previous calendar month
    let targetMonth: Date;
    try {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      if (body?.month) {
        targetMonth = new Date(body.month);
      } else {
        const now = new Date();
        targetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      }
    } catch {
      const now = new Date();
      targetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    }

    const monthStart = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 1));
    const monthIso = monthStart.toISOString().slice(0, 10);

    // 1. Charger feedback du mois
    const { data: feedback, error: fbErr } = await supabase
      .from("pc_feedback")
      .select("pharmacy_id, pc_categorie, action, detection_source")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString());
    if (fbErr) throw fbErr;

    // 2. Charger recommendation_metrics (cumul — proxy de propositions)
    //    On agrège times_proposed mis à jour ce mois-ci via updated_at
    const { data: metrics, error: mErr } = await supabase
      .from("recommendation_metrics")
      .select("pharmacy_id, pc_categorie, times_proposed, updated_at")
      .gte("updated_at", monthStart.toISOString())
      .lt("updated_at", monthEnd.toISOString());
    if (mErr) throw mErr;

    // Agrégation
    type Key = string;
    const buckets = new Map<Key, {
      pharmacy_id: string;
      category: string;
      proposed: number;
      clicked: number;
      hidAuto: number;
      inferred: number;
    }>();

    const keyOf = (pharmId: string, cat: string | null) => `${pharmId}::${cat || ""}`;

    for (const m of metrics || []) {
      if (!m.pharmacy_id) continue;
      const k = keyOf(m.pharmacy_id, m.pc_categorie);
      const b = buckets.get(k) || {
        pharmacy_id: m.pharmacy_id,
        category: m.pc_categorie || "",
        proposed: 0, clicked: 0, hidAuto: 0, inferred: 0,
      };
      b.proposed += m.times_proposed || 0;
      buckets.set(k, b);
    }

    for (const f of feedback || []) {
      if (!f.pharmacy_id || f.action !== "accepted") continue;
      const k = keyOf(f.pharmacy_id, f.pc_categorie);
      const b = buckets.get(k) || {
        pharmacy_id: f.pharmacy_id,
        category: f.pc_categorie || "",
        proposed: 0, clicked: 0, hidAuto: 0, inferred: 0,
      };
      const src = f.detection_source || "manual_click";
      if (src === "hid_auto") b.hidAuto++;
      else if (src === "inferred") b.inferred++;
      else b.clicked++;
      buckets.set(k, b);
    }

    // Upsert
    const rows = Array.from(buckets.values()).map((b) => {
      const total = b.clicked + b.hidAuto + b.inferred;
      const avgPrice = CATEGORY_AVG_PRICE[b.category.toLowerCase()] ?? DEFAULT_AVG_PRICE;
      return {
        pharmacy_id: b.pharmacy_id,
        month: monthIso,
        category: b.category,
        proposed_count: b.proposed,
        clicked_count: b.clicked,
        hid_auto_count: b.hidAuto,
        inferred_count: b.inferred,
        total_attributed: total,
        revenue_estimate: total * avgPrice,
        computed_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from("sales_attribution_monthly")
        .upsert(rows, { onConflict: "pharmacy_id,month,category" });
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        month: monthIso,
        rows_written: rows.length,
        pharmacies: new Set(rows.map((r) => r.pharmacy_id)).size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
