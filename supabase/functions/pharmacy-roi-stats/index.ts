/**
 * pharmacy-roi-stats — Agrège les KPIs ROI d'une pharmacie + benchmark réseau.
 *
 * INPUT (POST JSON) :
 *   { pharmacy_id: string, period_days: 7 | 30 | 90 }
 *
 * OUTPUT :
 *   {
 *     kpis: {
 *       total_proposed, total_accepted, total_rejected, conversion_rate,
 *       ca_estime_euros, manque_a_gagner_euros,
 *       pcs_per_day_avg, days_active
 *     },
 *     benchmark: {
 *       avg_conversion_rate, avg_pcs_per_day, top_quartile_conversion,
 *       my_rank, total_pharmacies
 *     },
 *     underperforming_pcs: [
 *       { pc_nom, pc_categorie, my_rate, network_rate, gap, my_count, ca_perdu_estime }
 *     ],
 *     missed_opportunities: [
 *       { medicament_nom, scans_count, pcs_proposed, pcs_accepted, acceptance_rate }
 *     ],
 *     daily_trend: [
 *       { date, proposed, accepted, conversion_rate }
 *     ]
 *   }
 *
 * Admin uniquement.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { fetchAllPages } from "../_shared/paginate.ts";

// ── Fallback final : moyenne grossière par catégorie ───────────────────────
// Utilisé UNIQUEMENT si le PC n'est ni dans pc_pricing ni dans pc_category_pricing.
// La vraie source de vérité est en base (pc_pricing + pc_category_pricing).
const FALLBACK_PAR_CATEGORIE: Record<string, number> = {
  "complement":          12,
  "complément":          12,
  "complément alimentaire": 12,
  "dispositif_medical":  15,
  "dispositif médical":  15,
  "dermocosmétique":     18,
  "dermocosmetique":     18,
  "cosmétique":          14,
  "hygiène":              5,
  "hygiene":              5,
  "médicament otc":       6,
  "medicament otc":       6,
  "produit_conseil":      8,
  "probiotique":         15,
  "ophtalmologie":       12,
  "premiers soins":       4,
  "phytothérapie":       10,
  "phytotherapie":       10,
  "vitamine":            10,
};
const PRIX_DEFAULT = 8;

// Normalisation des noms (cohérente avec pc_pricing.pc_nom_normalise)
function normalizePcName(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+\s*(mg|g|ml|ui|µg|comprim|gelule|gel|sachet|patch|cp|cpr|tube|flacon)\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Résolveur de prix 3-niveaux : prix exact (par nom normalisé)
//   → moyenne pondérée par catégorie → fallback constant
function makePriceResolver(
  exactPrices:    Map<string, number>,
  categoryPrices: Map<string, number>,
) {
  return (pc_nom: string | null | undefined, categorie: string | null | undefined): number => {
    // Niveau 1 : prix exact via nom normalisé
    if (pc_nom) {
      const norm = normalizePcName(pc_nom);
      if (exactPrices.has(norm)) return exactPrices.get(norm)!;
    }
    // Niveau 2 : moyenne pondérée par catégorie
    if (categorie) {
      const catKey = categorie.toLowerCase().trim();
      if (categoryPrices.has(catKey)) return categoryPrices.get(catKey)!;
    }
    // Niveau 3 : fallback constant
    if (categorie) {
      const k = categorie.toLowerCase().trim();
      if (FALLBACK_PAR_CATEGORIE[k] !== undefined) return FALLBACK_PAR_CATEGORIE[k];
    }
    return PRIX_DEFAULT;
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Auth ──────────────────────────────────────────────────────────────
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

  try {
    const body = await req.json().catch(() => ({}));
    const pharmacy_id  = body?.pharmacy_id as string | undefined;
    const period_days  = Math.min(Math.max(Number(body?.period_days) || 30, 1), 365);

    if (!pharmacy_id) {
      return new Response(JSON.stringify({ error: "pharmacy_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Autorisation : l'user doit être admin OU avoir cette pharmacy_id ─
    // dans son profil. Sans ça, un pharmacien pourrait lire les KPIs des
    // autres pharmacies du réseau en passant n'importe quel pharmacy_id.
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || (profile as any).pharmacy_id !== pharmacy_id) {
        return new Response(JSON.stringify({
          error: "Accès non autorisé à cette pharmacie",
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sinceIso = new Date(Date.now() - period_days * 86400e3).toISOString();

    // ════ 0. Chargement des tarifs réels (1 fois par appel) ═══════════════
    // pc_pricing       : prix exact par PC (top vendus)
    // pc_category_pricing : moyenne pondérée par catégorie (fallback)
    const [prices, catPricesList] = await Promise.all([
      fetchAllPages<any>(
        () => supabase.from("pc_pricing").select("pc_nom_normalise, prix_unitaire_ttc"),
        1000,
        100_000
      ),
      fetchAllPages<any>(
        () => supabase.from("pc_category_pricing").select("categorie, prix_moyen_pondere"),
        1000,
        100_000
      ),
    ]);
    const exactPrices = new Map<string, number>(
      prices.map((r: any) => [r.pc_nom_normalise, Number(r.prix_unitaire_ttc)]),
    );
    const catPrices = new Map<string, number>(
      catPricesList.map((r: any) => [r.categorie.toLowerCase().trim(), Number(r.prix_moyen_pondere)]),
    );
    const priceFor = makePriceResolver(exactPrices, catPrices);

    // ════ 1. KPIs pharmacie ═══════════════════════════════════════════════
    const myFeedback = await fetchAllPages<any>(
      () =>
        supabase
          .from("pc_feedback")
          .select("action, pc_categorie, pc_nom, medicament_nom, created_at, detection_source")
          .eq("pharmacy_id", pharmacy_id)
          .gte("created_at", sinceIso),
      1000,
      100_000
    );

    const my = myFeedback ?? [];
    const accepted = my.filter(r => r.action === "accepted");
    const rejected = my.filter(r => r.action === "rejected");
    const total    = my.length;
    const conversion_rate = total > 0 ? (accepted.length / total) * 100 : 0;
    const ca_estime = accepted.reduce((sum, r) => sum + priceFor(r.pc_nom, r.pc_categorie), 0);
    const manque    = rejected.reduce((sum, r) => sum + priceFor(r.pc_nom, r.pc_categorie), 0);

    // Détail attribution : clic manuel vs auto-détection par scan douchette
    const accepted_manual = accepted.filter(r => r.detection_source === "manual_click").length;
    const accepted_auto   = accepted.filter(r => r.detection_source === "hid_auto").length;
    const accepted_other  = accepted.length - accepted_manual - accepted_auto;
    const auto_detection_rate = accepted.length > 0
      ? Math.round((accepted_auto / accepted.length) * 100)
      : 0;

    // Jours actifs (jours avec au moins 1 feedback)
    const activeDays = new Set(my.map(r => r.created_at.slice(0, 10))).size;
    const pcs_per_day_avg = activeDays > 0 ? total / activeDays : 0;

    // ════ 2. Benchmark réseau ═════════════════════════════════════════════
    const allFeedback = await fetchAllPages<any>(
      () =>
        supabase
          .from("pc_feedback")
          .select("pharmacy_id, action, pc_categorie")
          .gte("created_at", sinceIso),
      1000,
      100_000
    );

    // Group by pharmacy
    const byPharm: Record<string, { accepted: number; total: number }> = {};
    for (const r of allFeedback ?? []) {
      byPharm[r.pharmacy_id] = byPharm[r.pharmacy_id] || { accepted: 0, total: 0 };
      byPharm[r.pharmacy_id].total += 1;
      if (r.action === "accepted") byPharm[r.pharmacy_id].accepted += 1;
    }
    const rates = Object.values(byPharm)
      .filter(p => p.total >= 10) // exclure pharmacies avec trop peu de données
      .map(p => (p.accepted / p.total) * 100)
      .sort((a, b) => b - a);

    const avg_conversion_rate = rates.length > 0
      ? rates.reduce((s, r) => s + r, 0) / rates.length
      : 0;
    const top_quartile_conversion = rates.length > 0
      ? rates[Math.floor(rates.length * 0.25)] ?? rates[0]
      : 0;
    const my_rank = rates.filter(r => r > conversion_rate).length + 1;

    // ════ 3. PCs sous-performants vs réseau ═══════════════════════════════
    // Pour chaque PC : taux chez moi vs taux réseau (autres pharmacies)
    const myPcStats: Record<string, { categorie: string | null; accepted: number; total: number }> = {};
    for (const r of my) {
      const key = r.pc_nom;
      myPcStats[key] = myPcStats[key] || { categorie: r.pc_categorie, accepted: 0, total: 0 };
      myPcStats[key].total += 1;
      if (r.action === "accepted") myPcStats[key].accepted += 1;
    }

    // Re-fetch all feedback with pc_nom inclu (excl. notre pharmacie)
    const networkFeedback = await fetchAllPages<any>(
      () =>
        supabase
          .from("pc_feedback")
          .select("pc_nom, action")
          .neq("pharmacy_id", pharmacy_id)
          .gte("created_at", sinceIso),
      1000,
      100_000
    );

    const networkPcStats: Record<string, { accepted: number; total: number }> = {};
    for (const r of networkFeedback ?? []) {
      const key = r.pc_nom;
      networkPcStats[key] = networkPcStats[key] || { accepted: 0, total: 0 };
      networkPcStats[key].total += 1;
      if (r.action === "accepted") networkPcStats[key].accepted += 1;
    }

    // Identifier les PCs où mon taux est nettement inférieur au réseau
    const underperforming = Object.entries(myPcStats)
      .filter(([, s]) => s.total >= 3) // min 3 propositions pour stat fiable
      .map(([pc_nom, s]) => {
        const my_rate = (s.accepted / s.total) * 100;
        const net = networkPcStats[pc_nom];
        const network_rate = (net && net.total >= 5) ? (net.accepted / net.total) * 100 : null;
        const gap = network_rate !== null ? network_rate - my_rate : 0;
        return {
          pc_nom,
          pc_categorie: s.categorie,
          my_rate: Math.round(my_rate),
          network_rate: network_rate !== null ? Math.round(network_rate) : null,
          gap: Math.round(gap),
          my_count: s.total,
          ca_perdu_estime: Math.round((s.total - s.accepted) * priceFor(pc_nom, s.categorie) * (gap / 100)),
        };
      })
      .filter(p => p.network_rate !== null && p.gap >= 15) // gap d'au moins 15 points
      .sort((a, b) => b.ca_perdu_estime - a.ca_perdu_estime)
      .slice(0, 10);

    // ════ 4. Opportunités manquées par médicament ═════════════════════════
    const byMed: Record<string, { proposed: number; accepted: number }> = {};
    for (const r of my) {
      const k = r.medicament_nom || "?";
      byMed[k] = byMed[k] || { proposed: 0, accepted: 0 };
      byMed[k].proposed += 1;
      if (r.action === "accepted") byMed[k].accepted += 1;
    }
    const missed_opportunities = Object.entries(byMed)
      .filter(([, s]) => s.proposed >= 3 && s.accepted / s.proposed < 0.3) // <30% accept
      .map(([medicament_nom, s]) => ({
        medicament_nom,
        scans_count: s.proposed,
        pcs_proposed: s.proposed,
        pcs_accepted: s.accepted,
        acceptance_rate: Math.round((s.accepted / s.proposed) * 100),
      }))
      .sort((a, b) => b.scans_count - a.scans_count)
      .slice(0, 10);

    // ════ 5. Tendance quotidienne ═════════════════════════════════════════
    const byDay: Record<string, { proposed: number; accepted: number }> = {};
    for (const r of my) {
      const day = r.created_at.slice(0, 10);
      byDay[day] = byDay[day] || { proposed: 0, accepted: 0 };
      byDay[day].proposed += 1;
      if (r.action === "accepted") byDay[day].accepted += 1;
    }
    const daily_trend = Object.entries(byDay)
      .map(([date, s]) => ({
        date,
        proposed: s.proposed,
        accepted: s.accepted,
        conversion_rate: s.proposed > 0 ? Math.round((s.accepted / s.proposed) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return new Response(JSON.stringify({
      kpis: {
        total_proposed: total,
        total_accepted: accepted.length,
        total_rejected: rejected.length,
        conversion_rate: Math.round(conversion_rate),
        ca_estime_euros: Math.round(ca_estime),
        manque_a_gagner_euros: Math.round(manque),
        pcs_per_day_avg: Math.round(pcs_per_day_avg * 10) / 10,
        days_active: activeDays,
        // Détail attribution
        accepted_manual,
        accepted_auto,
        accepted_other,
        auto_detection_rate,
      },
      benchmark: {
        avg_conversion_rate: Math.round(avg_conversion_rate),
        avg_pcs_per_day: 0, // TODO: calcul plus précis
        top_quartile_conversion: Math.round(top_quartile_conversion),
        my_rank,
        total_pharmacies: rates.length,
      },
      underperforming_pcs: underperforming,
      missed_opportunities,
      daily_trend,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pharmacy-roi-stats fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
