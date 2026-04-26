import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve groupement: admin can pass ?groupement_id=, group_manager uses their managed
    const url = new URL(req.url);
    let groupementId = url.searchParams.get("groupement_id");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("managed_groupement_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.managed_groupement_id) {
        return new Response(JSON.stringify({ error: "Accès groupement requis" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      groupementId = profile.managed_groupement_id;
    }

    if (!groupementId) {
      return new Response(JSON.stringify({ error: "groupement_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get groupement info + pharmacies
    const [{ data: groupement }, { data: pharmacies }] = await Promise.all([
      supabase.from("groupements").select("*").eq("id", groupementId).maybeSingle(),
      supabase.from("pharmacies").select("id, name, city, status").eq("groupement_id", groupementId),
    ]);

    if (!groupement) {
      return new Response(JSON.stringify({ error: "Groupement introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pharmaIds = (pharmacies || []).map((p: any) => p.id);

    // Period: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceISO = thirtyDaysAgo.toISOString();

    // 2. Pull data in parallel
    const [historyRes, feedbackRes, salesRes, allHistoryRes, allFeedbackRes] = await Promise.all([
      pharmaIds.length > 0
        ? supabase.from("analysis_history")
            .select("pharmacy_id, created_at, suggestions_count, has_major_interaction, medicaments")
            .in("pharmacy_id", pharmaIds)
            .gte("created_at", sinceISO)
        : Promise.resolve({ data: [] }),
      pharmaIds.length > 0
        ? supabase.from("pc_feedback")
            .select("pharmacy_id, action, pc_nom, pc_categorie, medicament_nom, created_at")
            .in("pharmacy_id", pharmaIds)
            .gte("created_at", sinceISO)
        : Promise.resolve({ data: [] }),
      pharmaIds.length > 0
        ? supabase.from("sales_transactions")
            .select("pharmacy_id, items, total_items, created_at")
            .in("pharmacy_id", pharmaIds)
            .gte("created_at", sinceISO)
        : Promise.resolve({ data: [] }),
      // National benchmark (anonymized)
      supabase.from("analysis_history")
        .select("pharmacy_id, suggestions_count")
        .gte("created_at", sinceISO)
        .limit(10000),
      supabase.from("pc_feedback")
        .select("pharmacy_id, action")
        .gte("created_at", sinceISO)
        .limit(10000),
    ]);

    const history = (historyRes.data as any[]) || [];
    const feedback = (feedbackRes.data as any[]) || [];
    const sales = (salesRes.data as any[]) || [];
    const allHistory = (allHistoryRes.data as any[]) || [];
    const allFeedback = (allFeedbackRes.data as any[]) || [];

    // 3. Per-pharmacy stats
    const pharmacyStats = (pharmacies || []).map((p: any) => {
      const pHist = history.filter((h) => h.pharmacy_id === p.id);
      const pFb = feedback.filter((f) => f.pharmacy_id === p.id);
      const pSales = sales.filter((s) => s.pharmacy_id === p.id);
      const accepted = pFb.filter((f) => f.action === "accepted").length;
      const totalFb = pFb.length;
      const conversion = totalFb > 0 ? Math.round((accepted / totalFb) * 100) : 0;

      // Avg basket: items per sale transaction
      const totalItems = pSales.reduce((s, x) => s + (x.total_items || 0), 0);
      const avgBasket = pSales.length > 0
        ? Math.round((totalItems / pSales.length) * 10) / 10
        : 0;

      return {
        id: p.id,
        name: p.name,
        city: p.city,
        status: p.status,
        analyses_30d: pHist.length,
        avg_analyses_per_day: Math.round((pHist.length / 30) * 10) / 10,
        avg_suggestions: pHist.length > 0
          ? Math.round((pHist.reduce((s, h) => s + (h.suggestions_count || 0), 0) / pHist.length) * 10) / 10
          : 0,
        conversion_rate: conversion,
        avg_basket: avgBasket,
        total_sales: pSales.length,
        accepted_count: accepted,
        proposed_count: totalFb,
      };
    });

    // 4. Group aggregates
    const totalAnalyses = pharmacyStats.reduce((s, p) => s + p.analyses_30d, 0);
    const totalAccepted = pharmacyStats.reduce((s, p) => s + p.accepted_count, 0);
    const totalProposed = pharmacyStats.reduce((s, p) => s + p.proposed_count, 0);
    const groupConversion = totalProposed > 0 ? Math.round((totalAccepted / totalProposed) * 100) : 0;
    const activeCount = pharmacyStats.filter((p) => p.analyses_30d > 0).length;
    const groupAvgBasket = pharmacyStats.length > 0
      ? Math.round((pharmacyStats.reduce((s, p) => s + p.avg_basket, 0) / pharmacyStats.length) * 10) / 10
      : 0;

    // 5. National benchmark
    const nationalAccepted = allFeedback.filter((f) => f.action === "accepted").length;
    const nationalConversion = allFeedback.length > 0
      ? Math.round((nationalAccepted / allFeedback.length) * 100)
      : 0;
    const allPharmaIds = new Set(allHistory.map((h) => h.pharmacy_id));
    const nationalAvgAnalysesPerPharma = allPharmaIds.size > 0
      ? Math.round((allHistory.length / allPharmaIds.size) * 10) / 10
      : 0;

    // 6. Top recommended products in network
    const productCount: Record<string, { count: number; accepted: number; categorie?: string }> = {};
    feedback.forEach((f) => {
      if (!f.pc_nom) return;
      if (!productCount[f.pc_nom]) {
        productCount[f.pc_nom] = { count: 0, accepted: 0, categorie: f.pc_categorie };
      }
      productCount[f.pc_nom].count++;
      if (f.action === "accepted") productCount[f.pc_nom].accepted++;
    });
    const topProducts = Object.entries(productCount)
      .map(([name, v]) => ({
        name,
        proposed: v.count,
        accepted: v.accepted,
        conversion: v.count > 0 ? Math.round((v.accepted / v.count) * 100) : 0,
        categorie: v.categorie,
      }))
      .sort((a, b) => b.proposed - a.proposed)
      .slice(0, 10);

    // 7. Auto-detect alerts (under-performance)
    const alerts: any[] = [];
    if (groupConversion > 0) {
      pharmacyStats.forEach((p) => {
        if (p.proposed_count >= 10 && p.conversion_rate < groupConversion * 0.6) {
          alerts.push({
            type: "underperformance",
            severity: "warning",
            pharmacy_id: p.id,
            pharmacy_name: p.name,
            message: `${p.name} : taux de conversion ${p.conversion_rate}% (réseau : ${groupConversion}%)`,
            metric: { value: p.conversion_rate, group_avg: groupConversion },
          });
        }
        if (p.analyses_30d === 0) {
          alerts.push({
            type: "inactive",
            severity: "info",
            pharmacy_id: p.id,
            pharmacy_name: p.name,
            message: `${p.name} : aucune analyse sur 30 jours`,
          });
        }
      });
    }

    // Persisted alerts from group_alerts table
    const { data: persistedAlerts } = await supabase
      .from("group_alerts")
      .select("*")
      .eq("groupement_id", groupementId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);

    return new Response(JSON.stringify({
      groupement,
      period: { since: sinceISO, days: 30 },
      summary: {
        pharmacies_total: pharmacies?.length || 0,
        pharmacies_active: activeCount,
        total_analyses: totalAnalyses,
        avg_analyses_per_day: Math.round((totalAnalyses / 30) * 10) / 10,
        conversion_rate: groupConversion,
        avg_basket: groupAvgBasket,
        total_pc_proposed: totalProposed,
        total_pc_accepted: totalAccepted,
      },
      national_benchmark: {
        conversion_rate: nationalConversion,
        avg_analyses_per_pharma_30d: nationalAvgAnalysesPerPharma,
        active_pharmacies: allPharmaIds.size,
      },
      pharmacies: pharmacyStats.sort((a, b) => b.analyses_30d - a.analyses_30d),
      top_products: topProducts,
      auto_alerts: alerts,
      persisted_alerts: persistedAlerts || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("group-kpis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
