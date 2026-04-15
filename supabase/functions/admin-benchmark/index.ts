import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin
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

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès admin requis" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather anonymized benchmark data
    const { data: pharmacies } = await supabase.from("pharmacies").select("id, city, status");
    const { data: history } = await supabase
      .from("analysis_history")
      .select("pharmacy_id, created_at, suggestions_count, has_major_interaction, interactions_count")
      .order("created_at", { ascending: false })
      .limit(5000);

    const { data: feedback } = await supabase
      .from("pc_feedback")
      .select("pharmacy_id, action, created_at")
      .limit(5000);

    if (!pharmacies || !history) {
      return new Response(JSON.stringify({ error: "Données non disponibles" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build per-pharmacy stats (anonymized)
    const pharmacyStats = pharmacies.map((p, idx) => {
      const pHistory = history.filter((h: any) => h.pharmacy_id === p.id);
      const pFeedback = (feedback || []).filter((f: any) => f.pharmacy_id === p.id);
      const accepted = pFeedback.filter((f: any) => f.action === "accepted").length;
      const totalFb = pFeedback.length;

      // Calculate analyses per day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAnalyses = pHistory.filter(
        (h: any) => new Date(h.created_at) >= thirtyDaysAgo
      );

      return {
        label: `Pharmacie ${idx + 1}`,
        city: p.city || "Non renseignée",
        status: p.status,
        total_analyses: pHistory.length,
        analyses_30d: recentAnalyses.length,
        avg_analyses_per_day: Math.round((recentAnalyses.length / 30) * 10) / 10,
        avg_suggestions: pHistory.length > 0
          ? Math.round(
              pHistory.reduce((s: number, h: any) => s + (h.suggestions_count || 0), 0) /
              pHistory.length * 10
            ) / 10
          : 0,
        major_interactions: pHistory.filter((h: any) => h.has_major_interaction).length,
        conversion_rate: totalFb > 0 ? Math.round((accepted / totalFb) * 100) : null,
        total_feedback: totalFb,
      };
    });

    // Global aggregates
    const activePharmacies = pharmacyStats.filter((p) => p.total_analyses > 0);
    const totalAnalyses = activePharmacies.reduce((s, p) => s + p.total_analyses, 0);
    const avgAnalysesPerPharmacy = activePharmacies.length > 0
      ? Math.round(totalAnalyses / activePharmacies.length)
      : 0;
    const conversionRates = pharmacyStats
      .map((p) => p.conversion_rate)
      .filter((r): r is number => r !== null);
    const avgConversion = conversionRates.length > 0
      ? Math.round(conversionRates.reduce((s, r) => s + r, 0) / conversionRates.length)
      : null;

    // Percentiles
    const sorted30d = activePharmacies.map((p) => p.avg_analyses_per_day).sort((a, b) => a - b);
    const p25 = sorted30d[Math.floor(sorted30d.length * 0.25)] || 0;
    const p50 = sorted30d[Math.floor(sorted30d.length * 0.5)] || 0;
    const p75 = sorted30d[Math.floor(sorted30d.length * 0.75)] || 0;

    return new Response(
      JSON.stringify({
        global: {
          total_pharmacies: pharmacies.length,
          active_pharmacies: activePharmacies.length,
          total_analyses: totalAnalyses,
          avg_analyses_per_pharmacy: avgAnalysesPerPharmacy,
          avg_conversion_rate: avgConversion,
          percentiles_analyses_day: { p25, p50, p75 },
        },
        pharmacies: pharmacyStats.sort((a, b) => b.total_analyses - a.total_analyses),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("admin-benchmark error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
