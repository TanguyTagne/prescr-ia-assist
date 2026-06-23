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
    if (!authHeader) return jsonError("Non autorisé", 401);

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonError("Non autorisé", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    let groupementId = url.searchParams.get("groupement_id");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles").select("managed_groupement_id").eq("id", user.id).maybeSingle();
      if (!profile?.managed_groupement_id) return jsonError("Accès groupement requis", 403);
      groupementId = profile.managed_groupement_id;
    }
    if (!groupementId) return jsonError("groupement_id requis", 400);

    const { data: pharmacies } = await supabase
      .from("pharmacies").select("id, name, city").eq("groupement_id", groupementId);
    const pharmaIds = (pharmacies || []).map((p: any) => p.id);

    const since = new Date();
    since.setDate(since.getDate() - 60);
    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

    if (pharmaIds.length === 0) {
      return new Response(JSON.stringify({
        pathology_trends: [], top_advice: [], epidemic_alerts: [], case_studies: [],
        cities: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get analyses with pathologies (in metadata)
    const { data: history } = await supabase
      .from("analysis_history")
      .select("pharmacy_id, created_at, medicaments, metadata")
      .in("pharmacy_id", pharmaIds)
      .gte("created_at", since.toISOString())
      .limit(5000);

    const { data: feedback } = await supabase
      .from("pc_feedback")
      .select("pharmacy_id, action, pc_nom, pc_categorie, medicament_nom, created_at")
      .in("pharmacy_id", pharmaIds)
      .gte("created_at", since.toISOString());

    // 1. Pathology trends (compare last 30d vs prior 30d)
    const pathoCurrent: Record<string, number> = {};
    const pathoPrevious: Record<string, number> = {};
    (history || []).forEach((h: any) => {
      const d = new Date(h.created_at);
      const isCurrent = d >= previousPeriodStart;
      const meds = Array.isArray(h.medicaments) ? h.medicaments : [];
      meds.forEach((m: any) => {
        const pathos: string[] = m.pathologies || m.pathologies_detectees || [];
        pathos.forEach((p) => {
          if (!p) return;
          if (isCurrent) pathoCurrent[p] = (pathoCurrent[p] || 0) + 1;
          else pathoPrevious[p] = (pathoPrevious[p] || 0) + 1;
        });
      });
    });

    const pathoTrends = Object.entries(pathoCurrent).map(([name, count]) => {
      const prev = pathoPrevious[name] || 0;
      const change = prev > 0 ? Math.round(((count - prev) / prev) * 100) : null;
      return { pathologie: name, count_30d: count, count_previous_30d: prev, change_pct: change };
    }).sort((a, b) => b.count_30d - a.count_30d).slice(0, 20);

    // 2. Top advice (best converting products)
    const adviceMap: Record<string, { proposed: number; accepted: number; categorie?: string }> = {};
    (feedback || []).forEach((f: any) => {
      if (!f.pc_nom) return;
      if (!adviceMap[f.pc_nom]) adviceMap[f.pc_nom] = { proposed: 0, accepted: 0, categorie: f.pc_categorie };
      adviceMap[f.pc_nom].proposed++;
      if (f.action === "accepted") adviceMap[f.pc_nom].accepted++;
    });
    const topAdvice = Object.entries(adviceMap)
      .filter(([_, v]) => v.proposed >= 5)
      .map(([name, v]) => ({
        produit: name,
        categorie: v.categorie,
        proposed: v.proposed,
        accepted: v.accepted,
        conversion: Math.round((v.accepted / v.proposed) * 100),
      }))
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 15);

    // 3. Epidemic alerts (pathology surge by city)
    const cityMap = new Map<string, string>();
    (pharmacies || []).forEach((p: any) => cityMap.set(p.id, p.city || "Non renseignée"));

    const cityPathoCount: Record<string, Record<string, number>> = {};
    (history || []).forEach((h: any) => {
      const city = cityMap.get(h.pharmacy_id) || "Inconnue";
      const d = new Date(h.created_at);
      if (d < previousPeriodStart) return; // Only current period
      const meds = Array.isArray(h.medicaments) ? h.medicaments : [];
      meds.forEach((m: any) => {
        const pathos: string[] = m.pathologies || m.pathologies_detectees || [];
        pathos.forEach((p) => {
          if (!p) return;
          if (!cityPathoCount[city]) cityPathoCount[city] = {};
          cityPathoCount[city][p] = (cityPathoCount[city][p] || 0) + 1;
        });
      });
    });

    const epidemicAlerts: any[] = [];
    const watchPathos = ["Gastro-entérite", "Grippe", "Rhume", "Bronchiolite", "Otite", "Angine", "Conjonctivite"];
    Object.entries(cityPathoCount).forEach(([city, pathoMap]) => {
      Object.entries(pathoMap).forEach(([patho, count]) => {
        const isWatched = watchPathos.some((wp) => patho.toLowerCase().includes(wp.toLowerCase()));
        if (isWatched && count >= 5) {
          epidemicAlerts.push({
            severity: count >= 15 ? "high" : count >= 8 ? "medium" : "low",
            city,
            pathologie: patho,
            count,
            message: `${count} cas de ${patho} détectés à ${city} sur 30j`,
          });
        }
      });
    });
    epidemicAlerts.sort((a, b) => b.count - a.count);

    // 4. Case studies (pharmacies with high product proposal => high basket)
    const phStats: Record<string, { sales: number; recos: number }> = {};
    (feedback || []).forEach((f: any) => {
      if (!phStats[f.pharmacy_id]) phStats[f.pharmacy_id] = { sales: 0, recos: 0 };
      phStats[f.pharmacy_id].recos++;
      if (f.action === "accepted") phStats[f.pharmacy_id].sales++;
    });
    const sortedByReco = Object.entries(phStats).sort((a, b) => b[1].recos - a[1].recos);
    const caseStudies: any[] = [];
    if (sortedByReco.length >= 2) {
      const topPh = sortedByReco[0];
      const topRate = topPh[1].recos > 0 ? Math.round((topPh[1].sales / topPh[1].recos) * 100) : 0;
      const ph = (pharmacies || []).find((p: any) => p.id === topPh[0]);
      if (ph) {
        caseStudies.push({
          title: `${ph.name} : la plus active du réseau`,
          metric: `${topPh[1].recos} recommandations / ${topRate}% de conversion`,
          insight: `Cette officine a recommandé ${topPh[1].recos} PC sur 60j avec un taux de conversion de ${topRate}%.`,
        });
      }
    }

    return new Response(JSON.stringify({
      pathology_trends: pathoTrends,
      top_advice: topAdvice,
      epidemic_alerts: epidemicAlerts.slice(0, 20),
      case_studies: caseStudies,
      cities: Array.from(new Set((pharmacies || []).map((p: any) => p.city).filter(Boolean))),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("group-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function jsonError(msg: string, status: number) {
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
