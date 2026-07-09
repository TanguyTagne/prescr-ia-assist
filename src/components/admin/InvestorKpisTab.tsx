import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, Activity, Target, DollarSign, Database, Shield, Zap, Building2, Sparkles, Save, Download } from "lucide-react";
import { fetchAll } from "@/lib/supabaseFetchAll";

// ────────────────────────────────────────────────────────────────────────────────
// Manual KPIs (saved in localStorage — non-PII, founder inputs)
// ────────────────────────────────────────────────────────────────────────────────
type ManualKpis = {
  mrr_eur: number;
  arpu_eur: number;
  cac_eur: number;
  ltv_eur: number;
  gross_margin_pct: number;
  nrr_pct: number;
  nps: number;
  csat: number;
  burn_eur_monthly: number;
  runway_months: number;
  capital_raised_eur: number;
  team_size: number;
  team_tech: number;
  team_sales: number;
  team_clinical: number;
  cycle_days: number;
  cost_per_analysis_eur: number;
  uptime_pct: number;
  latency_p95_ms: number;
};
const DEFAULT_MANUAL: ManualKpis = {
  mrr_eur: 0, arpu_eur: 0, cac_eur: 0, ltv_eur: 0, gross_margin_pct: 0,
  nrr_pct: 0, nps: 0, csat: 0, burn_eur_monthly: 0, runway_months: 0,
  capital_raised_eur: 0, team_size: 1, team_tech: 1, team_sales: 0, team_clinical: 0,
  cycle_days: 0, cost_per_analysis_eur: 0.002, uptime_pct: 99.9, latency_p95_ms: 2500,
};
const MANUAL_KEY = "asclion_investor_manual_kpis_v1";
const loadManual = (): ManualKpis => {
  try { return { ...DEFAULT_MANUAL, ...JSON.parse(localStorage.getItem(MANUAL_KEY) || "{}") }; }
  catch { return DEFAULT_MANUAL; }
};

// ────────────────────────────────────────────────────────────────────────────────
// Computed KPIs from DB
// ────────────────────────────────────────────────────────────────────────────────
type Computed = {
  // Traction
  total_pharmacies: number;
  pharmacies_active_30d: number;
  pharmacies_active_7d: number;
  pharmacies_active_1d: number;
  mau: number; wau: number; dau: number;
  stickiness_pct: number;
  total_users: number;
  active_users_30d: number;
  activated_pharmacies: number;
  activation_rate_pct: number;
  avg_ttfv_days: number | null;
  retention_m1_pct: number;
  retention_m3_pct: number;
  retention_m6_pct: number;
  retention_m12_pct: number;
  logo_churn_30d_pct: number;
  // Volume
  total_analyses: number;
  analyses_30d: number;
  analyses_7d: number;
  analyses_per_active_pharmacy_30d: number;
  // Funnel
  demo_sessions_total: number;
  demo_sessions_30d: number;
  demo_leads_total: number;
  demo_leads_30d: number;
  session_to_lead_pct: number;
  access_requests_total: number;
  access_requests_pending: number;
  requests_to_pharmacy_pct: number;
  tracking_links_count: number;
  tracking_clicks_total: number;
  tracking_demos_total: number;
  tracking_leads_total: number;
  // Engagement
  accept_rate_pct: number;
  feedback_total: number;
  cross_sell_conversion_pct: number;
  cross_sell_tracked: number;
  // Moat (DB clinique)
  medicaments_count: number;
  molecules_count: number;
  pathologies_count: number;
  conseils_count: number;
  latent_needs_count: number;
  pc_count: number;
  // Coverage
  coverage_pct: number;
  unmatched_count: number;
  // Distribution
  groupements_count: number;
  pharmacies_in_groupements: number;
  lgo_active_count: number;
  // Compliance
  gdpr_requests_total: number;
  gdpr_avg_days: number | null;
  signalements_total: number;
  // Performance
  latency_avg_ms: number | null;
};

const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const fmtEur = (n: number) => `${fmt(n)} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const daysBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const InvestorKpisTab = () => {
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<Computed | null>(null);
  const [manual, setManual] = useState<ManualKpis>(loadManual);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const now = Date.now();
    const d1 = new Date(now - 1 * 86400000).toISOString();
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const d30 = new Date(now - 30 * 86400000).toISOString();
    const d90 = new Date(now - 90 * 86400000).toISOString();
    const d180 = new Date(now - 180 * 86400000).toISOString();
    const d365 = new Date(now - 365 * 86400000).toISOString();

    const safeCount = async (table: string, filters?: (q: any) => any): Promise<number> => {
      try {
        let q: any = supabase.from(table as any).select("id", { count: "exact", head: true });
        if (filters) q = filters(q);
        const { count } = await q;
        return count || 0;
      } catch { return 0; }
    };
    const safeSelect = async <T,>(table: string, cols: string, filters?: (q: any) => any, maxRows = 100_000): Promise<T[]> => {
      try {
        return await fetchAll<T>(
          () => {
            let q: any = supabase.from(table as any).select(cols);
            if (filters) q = filters(q);
            return q;
          },
          1000,
          maxRows
        );
      } catch { return []; }
    };

    const [
      pharmacies, profiles, history,
      sessionsAll, sessionsRecent, leadsAll, leadsRecent,
      requests, trackingLinks,
      pcFeedback, crossSell,
      medCount, molCount, pathoCount, conseilsCount, latentCount, pcCount,
      coverageRows, unmatchedC, groupCount, pharmGroups,
      lgoConfigs, gdprAll, signalC, analyticsLatency,
    ] = await Promise.all([
      safeSelect<{ id: string; created_at: string; status?: string; groupement_id?: string }>("pharmacies", "id, created_at, status, groupement_id"),
      safeSelect<{ id: string; pharmacy_id: string; created_at: string }>("profiles", "id, pharmacy_id, created_at"),
      safeSelect<{ pharmacy_id: string; user_id: string; created_at: string; metadata: any; medicaments: any }>("analysis_history", "pharmacy_id, user_id, created_at, metadata, medicaments", undefined, 10000),
      safeCount("demo_sessions"),
      safeSelect<{ session_id: string; created_at: string }>("demo_sessions", "session_id, created_at", q => q.gte("created_at", d30)),
      safeCount("demo_leads"),
      safeCount("demo_leads", q => q.gte("created_at", d30)),
      safeSelect<{ status: string; created_at: string }>("access_requests", "status, created_at"),
      safeSelect<{ clicks_count?: number; demos_count?: number; leads_count?: number }>("tracking_links", "clicks_count, demos_count, leads_count"),
      safeSelect<{ action: string }>("pc_feedback", "action", undefined, 10000),
      safeSelect<{ was_sold: boolean }>("cross_sell_tracking", "was_sold", undefined, 5000),
      safeCount("medicaments"),
      safeCount("molecules"),
      safeCount("pathologies"),
      safeCount("conseils_associes"),
      safeCount("latent_needs"),
      safeCount("produits_complementaires"),
      safeSelect<{ status: string }>("medication_coverage_audit", "status", undefined, 10000),
      safeCount("unmatched_medicaments", q => q.eq("status", "pending")),
      safeCount("groupements", q => q.eq("status", "active")),
      safeSelect<{ id: string; groupement_id: string | null }>("pharmacies", "id, groupement_id", q => q.not("groupement_id", "is", null)),
      safeSelect<{ pharmacy_id: string; enabled: boolean }>("pharmacy_lgo_config", "pharmacy_id, enabled", q => q.eq("enabled", true)),
      safeSelect<{ requested_at: string; completed_at: string | null; status: string }>("gdpr_requests", "requested_at, completed_at, status"),
      safeCount("pc_feedback", q => q.eq("action", "rejected")),
      safeSelect<{ metadata: any; created_at: string }>("analytics_events", "metadata, created_at", q => q.eq("event_type", "analysis_completed").gte("created_at", d30), 1000),
    ]);

    // ── Traction
    const total_pharmacies = pharmacies.length;
    const activeSet = (since: string) => new Set(history.filter(h => h.created_at >= since).map(h => h.pharmacy_id));
    const mauSet = activeSet(d30);
    const wauSet = activeSet(d7);
    const dauSet = activeSet(d1);
    const mau = mauSet.size, wau = wauSet.size, dau = dauSet.size;
    const stickiness_pct = mau > 0 ? (dau / mau) * 100 : 0;
    const total_users = profiles.length;
    const activeUserSet = new Set(history.filter(h => h.created_at >= d30).map(h => h.user_id));
    const active_users_30d = activeUserSet.size;

    // Activation: pharmacies with >=10 analyses lifetime
    const medicationCount = (h: { metadata?: any; medicaments?: any }) => {
      const fromMetadata = Number(h.metadata?.medications_count);
      if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;
      return Array.isArray(h.medicaments) ? h.medicaments.length : 0;
    };
    const analysesByPharm = new Map<string, number>();
    const firstAnalysisByPharm = new Map<string, string>();
    for (const h of history) {
      analysesByPharm.set(h.pharmacy_id, (analysesByPharm.get(h.pharmacy_id) || 0) + medicationCount(h));
      const prev = firstAnalysisByPharm.get(h.pharmacy_id);
      if (!prev || h.created_at < prev) firstAnalysisByPharm.set(h.pharmacy_id, h.created_at);
    }
    const activated = [...analysesByPharm.values()].filter(n => n >= 10).length;
    const activation_rate_pct = total_pharmacies > 0 ? (activated / total_pharmacies) * 100 : 0;

    // TTFV
    const ttfvDays: number[] = [];
    for (const p of pharmacies) {
      const f = firstAnalysisByPharm.get(p.id);
      if (f) ttfvDays.push(daysBetween(p.created_at, f));
    }
    const avg_ttfv_days = ttfvDays.length ? ttfvDays.reduce((a, b) => a + b, 0) / ttfvDays.length : null;

    // Retention cohorts: pharmacies created N months ago, still active in last 30d
    const cohortRetention = (sinceISO: string, untilISO: string) => {
      const cohort = pharmacies.filter(p => p.created_at >= sinceISO && p.created_at < untilISO);
      if (cohort.length === 0) return 0;
      const retained = cohort.filter(p => mauSet.has(p.id)).length;
      return (retained / cohort.length) * 100;
    };
    const retention_m1_pct = cohortRetention(new Date(now - 60 * 86400000).toISOString(), d30);
    const retention_m3_pct = cohortRetention(new Date(now - 120 * 86400000).toISOString(), d90);
    const retention_m6_pct = cohortRetention(new Date(now - 210 * 86400000).toISOString(), d180);
    const retention_m12_pct = cohortRetention(new Date(now - 395 * 86400000).toISOString(), d365);
    const logo_churn_30d_pct = Math.max(0, 100 - retention_m1_pct);

    // Volume
    const analyses_30d = history.filter(h => h.created_at >= d30).reduce((sum, h) => sum + medicationCount(h), 0);
    const analyses_7d = history.filter(h => h.created_at >= d7).reduce((sum, h) => sum + medicationCount(h), 0);
    const analyses_per_active_pharmacy_30d = mau > 0 ? analyses_30d / mau : 0;

    // Funnel
    const demo_sessions_30d = sessionsRecent.length;
    const session_to_lead_pct = demo_sessions_30d > 0 ? (leadsRecent / demo_sessions_30d) * 100 : 0;
    const access_requests_pending = requests.filter(r => r.status === "pending").length;
    const access_requests_total = requests.length;
    const requests_converted = requests.filter(r => r.status === "approved" || r.status === "accepted").length;
    const requests_to_pharmacy_pct = access_requests_total > 0 ? (requests_converted / access_requests_total) * 100 : 0;
    const tracking_links_count = trackingLinks.length;
    const tracking_clicks_total = trackingLinks.reduce((s, t) => s + (t.clicks_count || 0), 0);
    const tracking_demos_total = trackingLinks.reduce((s, t) => s + (t.demos_count || 0), 0);
    const tracking_leads_total = trackingLinks.reduce((s, t) => s + (t.leads_count || 0), 0);

    // Engagement
    const fb_accepted = pcFeedback.filter(f => f.action === "accepted").length;
    const accept_rate_pct = pcFeedback.length > 0 ? (fb_accepted / pcFeedback.length) * 100 : 0;
    const cross_sell_sold = crossSell.filter(r => r.was_sold).length;
    const cross_sell_conversion_pct = crossSell.length > 0 ? (cross_sell_sold / crossSell.length) * 100 : 0;

    // Coverage
    const coverageOk = coverageRows.filter(r => r.status === "complete" || r.status === "ok").length;
    const coverage_pct = coverageRows.length > 0 ? (coverageOk / coverageRows.length) * 100 : 0;

    // Compliance
    const gdprDone = gdprAll.filter(g => g.completed_at);
    const gdprDurations = gdprDone.map(g => daysBetween(g.requested_at, g.completed_at!));
    const gdpr_avg_days = gdprDurations.length ? gdprDurations.reduce((a, b) => a + b, 0) / gdprDurations.length : null;

    // Latency avg from analytics_events metadata.duration_ms (if present)
    const latencies = analyticsLatency.map(e => Number(e.metadata?.duration_ms || e.metadata?.latency_ms || 0)).filter(n => n > 0);
    const latency_avg_ms = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

    setC({
      total_pharmacies, pharmacies_active_30d: mau, pharmacies_active_7d: wau, pharmacies_active_1d: dau,
      mau, wau, dau, stickiness_pct,
      total_users, active_users_30d,
      activated_pharmacies: activated, activation_rate_pct, avg_ttfv_days,
      retention_m1_pct, retention_m3_pct, retention_m6_pct, retention_m12_pct, logo_churn_30d_pct,
      total_analyses: history.reduce((sum, h) => sum + medicationCount(h), 0), analyses_30d, analyses_7d, analyses_per_active_pharmacy_30d,
      demo_sessions_total: sessionsAll, demo_sessions_30d, demo_leads_total: leadsAll, demo_leads_30d: leadsRecent, session_to_lead_pct,
      access_requests_total, access_requests_pending, requests_to_pharmacy_pct,
      tracking_links_count, tracking_clicks_total, tracking_demos_total, tracking_leads_total,
      accept_rate_pct, feedback_total: pcFeedback.length, cross_sell_conversion_pct, cross_sell_tracked: crossSell.length,
      medicaments_count: medCount, molecules_count: molCount, pathologies_count: pathoCount,
      conseils_count: conseilsCount, latent_needs_count: latentCount, pc_count: pcCount,
      coverage_pct, unmatched_count: unmatchedC,
      groupements_count: groupCount, pharmacies_in_groupements: pharmGroups.length,
      lgo_active_count: lgoConfigs.length,
      gdpr_requests_total: gdprAll.length, gdpr_avg_days, signalements_total: signalC,
      latency_avg_ms,
    });
    setLoading(false);
  };

  // Derived investor metrics from manual + computed
  const derived = useMemo(() => {
    const arr_eur = manual.mrr_eur * 12;
    const ltv_cac = manual.cac_eur > 0 ? manual.ltv_eur / manual.cac_eur : 0;
    const payback_months = manual.arpu_eur > 0 && manual.gross_margin_pct > 0
      ? manual.cac_eur / (manual.arpu_eur * (manual.gross_margin_pct / 100))
      : 0;
    // Rule of 40 = growth% + margin% (NRR-1 proxy for growth)
    const rule_of_40 = (manual.nrr_pct - 100) + manual.gross_margin_pct;
    return { arr_eur, ltv_cac, payback_months, rule_of_40 };
  }, [manual]);

  const saveManual = () => {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manual));
    setSavedAt(new Date().toLocaleTimeString("fr-FR"));
  };

  const exportJson = () => {
    const payload = { generated_at: new Date().toISOString(), computed: c, manual, derived };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `asclion-investor-kpis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading || !c) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          KPIs investisseurs · données live + inputs founder · {new Date().toLocaleString("fr-FR")}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <Section icon={<Sparkles className="h-4 w-4" />} title="Executive Summary">
        <Grid>
          <Tile label="ARR" value={fmtEur(derived.arr_eur)} hint="MRR × 12" />
          <Tile label="MRR" value={fmtEur(manual.mrr_eur)} hint="input" />
          <Tile label="Pharmacies actives (MAU)" value={fmt(c.mau)} hint={`/ ${c.total_pharmacies} total`} />
          <Tile label="Analyses 30j" value={fmt(c.analyses_30d)} hint={`${fmt(c.analyses_per_active_pharmacy_30d, 1)} / pharma`} />
          <Tile label="LTV/CAC" value={derived.ltv_cac.toFixed(2)} accent={derived.ltv_cac >= 3 ? "good" : derived.ltv_cac > 0 ? "warn" : "muted"} />
          <Tile label="NRR" value={fmtPct(manual.nrr_pct)} accent={manual.nrr_pct >= 110 ? "good" : manual.nrr_pct >= 100 ? "warn" : "muted"} />
          <Tile label="Churn logo 30j" value={fmtPct(c.logo_churn_30d_pct)} accent={c.logo_churn_30d_pct < 5 ? "good" : "warn"} />
          <Tile label="Rule of 40" value={derived.rule_of_40.toFixed(0)} accent={derived.rule_of_40 >= 40 ? "good" : "muted"} hint="growth+margin" />
        </Grid>
      </Section>

      {/* 1. Traction & Adoption */}
      <Section icon={<Users className="h-4 w-4" />} title="1. Traction & Adoption">
        <Grid>
          <Tile label="Pharmacies totales" value={fmt(c.total_pharmacies)} />
          <Tile label="MAU pharmacies" value={fmt(c.mau)} />
          <Tile label="WAU pharmacies" value={fmt(c.wau)} />
          <Tile label="DAU pharmacies" value={fmt(c.dau)} />
          <Tile label="Stickiness DAU/MAU" value={fmtPct(c.stickiness_pct)} accent={c.stickiness_pct >= 40 ? "good" : "muted"} />
          <Tile label="Utilisateurs totaux" value={fmt(c.total_users)} hint="préparateurs + titulaires" />
          <Tile label="Utilisateurs actifs 30j" value={fmt(c.active_users_30d)} />
          <Tile label="Taux d'activation" value={fmtPct(c.activation_rate_pct)} hint="≥10 analyses" />
          <Tile label="Time-to-first-value" value={c.avg_ttfv_days != null ? `${c.avg_ttfv_days.toFixed(1)} j` : "—"} />
          <Tile label="Rétention M1" value={fmtPct(c.retention_m1_pct)} />
          <Tile label="Rétention M3" value={fmtPct(c.retention_m3_pct)} />
          <Tile label="Rétention M6" value={fmtPct(c.retention_m6_pct)} />
          <Tile label="Rétention M12" value={fmtPct(c.retention_m12_pct)} />
          <Tile label="Churn logo 30j" value={fmtPct(c.logo_churn_30d_pct)} />
        </Grid>
      </Section>

      {/* 2. Revenus & Unit Economics (manuel) */}
      <Section icon={<DollarSign className="h-4 w-4" />} title="2. Revenus & Unit Economics" subtitle="Inputs founder (sauvegardés localement)">
        <ManualForm manual={manual} setManual={setManual} onSave={saveManual} savedAt={savedAt} />
        <div className="mt-4">
          <Grid>
            <Tile label="ARR" value={fmtEur(derived.arr_eur)} />
            <Tile label="MRR" value={fmtEur(manual.mrr_eur)} />
            <Tile label="ARPU / pharma" value={fmtEur(manual.arpu_eur)} />
            <Tile label="CAC" value={fmtEur(manual.cac_eur)} />
            <Tile label="LTV" value={fmtEur(manual.ltv_eur)} />
            <Tile label="LTV / CAC" value={derived.ltv_cac.toFixed(2)} accent={derived.ltv_cac >= 3 ? "good" : "warn"} />
            <Tile label="Payback CAC" value={derived.payback_months > 0 ? `${derived.payback_months.toFixed(1)} mois` : "—"} accent={derived.payback_months > 0 && derived.payback_months < 12 ? "good" : "warn"} />
            <Tile label="Gross margin" value={fmtPct(manual.gross_margin_pct)} accent={manual.gross_margin_pct >= 75 ? "good" : "warn"} />
            <Tile label="NRR" value={fmtPct(manual.nrr_pct)} />
            <Tile label="Burn mensuel" value={fmtEur(manual.burn_eur_monthly)} />
            <Tile label="Runway" value={`${manual.runway_months} mois`} />
            <Tile label="Capital levé" value={fmtEur(manual.capital_raised_eur)} />
            <Tile label="Rule of 40" value={derived.rule_of_40.toFixed(0)} accent={derived.rule_of_40 >= 40 ? "good" : "muted"} />
          </Grid>
        </div>
      </Section>

      {/* 3. Pipeline commercial & Funnel */}
      <Section icon={<Target className="h-4 w-4" />} title="3. Pipeline commercial & Funnel">
        <Grid>
          <Tile label="Sessions démo (total)" value={fmt(c.demo_sessions_total)} />
          <Tile label="Sessions démo 30j" value={fmt(c.demo_sessions_30d)} />
          <Tile label="Leads démo (total)" value={fmt(c.demo_leads_total)} />
          <Tile label="Leads démo 30j" value={fmt(c.demo_leads_30d)} />
          <Tile label="Conv. session → lead 30j" value={fmtPct(c.session_to_lead_pct)} />
          <Tile label="Demandes d'accès" value={fmt(c.access_requests_total)} hint={`${c.access_requests_pending} en attente`} />
          <Tile label="Conv. demande → pharma" value={fmtPct(c.requests_to_pharmacy_pct)} />
          <Tile label="Liens trackables actifs" value={fmt(c.tracking_links_count)} />
          <Tile label="Clicks trackés (cumul)" value={fmt(c.tracking_clicks_total)} />
          <Tile label="Démos via liens" value={fmt(c.tracking_demos_total)} />
          <Tile label="Leads via liens" value={fmt(c.tracking_leads_total)} />
          <Tile label="Cycle de vente moyen" value={manual.cycle_days > 0 ? `${manual.cycle_days} j` : "—"} hint="input" />
        </Grid>
      </Section>

      {/* 4. Produit & Engagement */}
      <Section icon={<Activity className="h-4 w-4" />} title="4. Produit & Engagement">
        <Grid>
          <Tile label="Analyses totales (lifetime)" value={fmt(c.total_analyses)} />
          <Tile label="Analyses 30j" value={fmt(c.analyses_30d)} />
          <Tile label="Analyses 7j" value={fmt(c.analyses_7d)} />
          <Tile label="Analyses / pharma active" value={fmt(c.analyses_per_active_pharmacy_30d, 1)} hint="30j" />
          <Tile label="Taux d'acceptation reco" value={fmtPct(c.accept_rate_pct)} accent={c.accept_rate_pct >= 30 ? "good" : "muted"} hint={`${c.feedback_total} feedbacks`} />
          <Tile label="Conversion cross-sell" value={fmtPct(c.cross_sell_conversion_pct)} hint={`${c.cross_sell_tracked} tracés`} />
          <Tile label="NPS" value={manual.nps ? String(manual.nps) : "—"} accent={manual.nps >= 50 ? "good" : manual.nps > 0 ? "warn" : "muted"} />
          <Tile label="CSAT" value={manual.csat ? `${manual.csat}/5` : "—"} />
          <Tile label="Latence moy. (mesurée)" value={c.latency_avg_ms != null ? `${Math.round(c.latency_avg_ms)} ms` : "—"} accent={c.latency_avg_ms != null && c.latency_avg_ms < 2500 ? "good" : "muted"} />
          <Tile label="Latence P95 (input)" value={`${manual.latency_p95_ms} ms`} />
        </Grid>
      </Section>

      {/* 5. Data Moat */}
      <Section icon={<Database className="h-4 w-4" />} title="5. Données & Moat technologique">
        <Grid>
          <Tile label="Médicaments en base" value={fmt(c.medicaments_count)} />
          <Tile label="Molécules" value={fmt(c.molecules_count)} />
          <Tile label="Pathologies" value={fmt(c.pathologies_count)} />
          <Tile label="Conseils associés" value={fmt(c.conseils_count)} />
          <Tile label="Latent needs" value={fmt(c.latent_needs_count)} />
          <Tile label="Produits complémentaires" value={fmt(c.pc_count)} />
          <Tile label="Couverture clinique" value={fmtPct(c.coverage_pct)} accent={c.coverage_pct >= 80 ? "good" : "warn"} />
          <Tile label="Médicaments non couverts" value={fmt(c.unmatched_count)} accent={c.unmatched_count === 0 ? "good" : "warn"} />
          <Tile label="Feedbacks accumulés" value={fmt(c.feedback_total)} hint="data moat" />
        </Grid>
      </Section>

      {/* 6. Distribution & Marché */}
      <Section icon={<Building2 className="h-4 w-4" />} title="6. Marché & Distribution">
        <Grid>
          <Tile label="TAM France" value="21 000" hint="officines" />
          <Tile label="SAM Europe" value="150 000" hint="officines" />
          <Tile label="Part FR" value={fmtPct((c.total_pharmacies / 21000) * 100)} hint="% TAM" />
          <Tile label="Groupements actifs" value={fmt(c.groupements_count)} />
          <Tile label="Pharma dans groupements" value={fmt(c.pharmacies_in_groupements)} />
          <Tile label="Intégrations LGO actives" value={fmt(c.lgo_active_count)} />
        </Grid>
      </Section>

      {/* 7. Tech & Scalabilité */}
      <Section icon={<Zap className="h-4 w-4" />} title="7. Tech & Scalabilité">
        <Grid>
          <Tile label="Uptime" value={fmtPct(manual.uptime_pct)} accent={manual.uptime_pct >= 99.5 ? "good" : "warn"} />
          <Tile label="Coût IA / analyse" value={`${manual.cost_per_analysis_eur.toFixed(4)} €`} />
          <Tile label="Coût IA 30j (estim.)" value={fmtEur(c.analyses_30d * manual.cost_per_analysis_eur)} />
          <Tile label="Latence P95" value={`${manual.latency_p95_ms} ms`} />
          <Tile label="Signalements" value={fmt(c.signalements_total)} hint="feedback rejected" />
        </Grid>
      </Section>

      {/* 8. Conformité & Risque */}
      <Section icon={<Shield className="h-4 w-4" />} title="8. Conformité & Risque">
        <Grid>
          <Tile label="Demandes RGPD" value={fmt(c.gdpr_requests_total)} />
          <Tile label="Délai moyen RGPD" value={c.gdpr_avg_days != null ? `${c.gdpr_avg_days.toFixed(1)} j` : "—"} accent={c.gdpr_avg_days != null && c.gdpr_avg_days < 30 ? "good" : "muted"} hint="légal: < 30j" />
          <Tile label="Statut MDR" value="Non-DM" hint="probabiliste" accent="good" />
          <Tile label="Hébergement" value="UE" hint="Frankfurt" accent="good" />
          <Tile label="RLS actif" value="100%" accent="good" />
          <Tile label="DPA dispo" value="Oui" accent="good" />
        </Grid>
      </Section>

      {/* 9. Équipe */}
      <Section icon={<Users className="h-4 w-4" />} title="9. Équipe">
        <Grid>
          <Tile label="Taille équipe" value={fmt(manual.team_size)} />
          <Tile label="Tech" value={fmt(manual.team_tech)} />
          <Tile label="Sales / Growth" value={fmt(manual.team_sales)} />
          <Tile label="Clinique" value={fmt(manual.team_clinical)} />
        </Grid>
      </Section>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Les inputs founder (revenu, équipe, NPS…) sont stockés localement dans ce navigateur. Cliquez « Sauvegarder » pour persister.
      </p>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// UI helpers
// ────────────────────────────────────────────────────────────────────────────────
const Section = ({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) => (
  <Card className="border-border">
    <CardHeader className="pb-3 pt-4 px-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </CardHeader>
    <CardContent className="px-4 pb-4">{children}</CardContent>
  </Card>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{children}</div>
);

const Tile = ({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "good" | "warn" | "muted" }) => {
  const accentCls =
    accent === "good" ? "border-primary/40 bg-primary/5"
    : accent === "warn" ? "border-destructive/40 bg-destructive/5"
    : "border-border bg-secondary/30";
  return (
    <div className={`rounded-md border ${accentCls} p-2.5`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
      <p className="text-lg font-bold leading-tight mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
};

const ManualForm = ({ manual, setManual, onSave, savedAt }: { manual: ManualKpis; setManual: (m: ManualKpis) => void; onSave: () => void; savedAt: string | null }) => {
  const upd = (k: keyof ManualKpis) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setManual({ ...manual, [k]: Number(e.target.value) || 0 });

  const fields: { k: keyof ManualKpis; l: string; step?: string }[] = [
    { k: "mrr_eur", l: "MRR (€)" },
    { k: "arpu_eur", l: "ARPU / pharma (€)" },
    { k: "cac_eur", l: "CAC (€)" },
    { k: "ltv_eur", l: "LTV (€)" },
    { k: "gross_margin_pct", l: "Gross margin (%)" },
    { k: "nrr_pct", l: "NRR (%)" },
    { k: "nps", l: "NPS" },
    { k: "csat", l: "CSAT /5", step: "0.1" },
    { k: "burn_eur_monthly", l: "Burn mensuel (€)" },
    { k: "runway_months", l: "Runway (mois)" },
    { k: "capital_raised_eur", l: "Capital levé (€)" },
    { k: "cycle_days", l: "Cycle vente (jours)" },
    { k: "team_size", l: "Équipe totale" },
    { k: "team_tech", l: "Équipe tech" },
    { k: "team_sales", l: "Équipe sales" },
    { k: "team_clinical", l: "Équipe clinique" },
    { k: "cost_per_analysis_eur", l: "Coût IA / analyse (€)", step: "0.0001" },
    { k: "uptime_pct", l: "Uptime (%)", step: "0.1" },
    { k: "latency_p95_ms", l: "Latence P95 (ms)" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {fields.map(f => (
          <div key={f.k}>
            <Label className="text-[10px] text-muted-foreground">{f.l}</Label>
            <Input
              type="number"
              step={f.step || "1"}
              value={manual[f.k]}
              onChange={upd(f.k)}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Sauvegarder
        </Button>
        {savedAt && <Badge variant="secondary" className="text-[10px]">Sauvegardé à {savedAt}</Badge>}
      </div>
    </div>
  );
};

export default InvestorKpisTab;
