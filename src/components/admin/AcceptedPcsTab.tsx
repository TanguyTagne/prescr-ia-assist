import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  Activity,
  Target,
  ShoppingBasket,
  Percent,
} from "lucide-react";

interface FeedbackRow {
  id: string;
  pharmacy_id: string;
  medicament_nom: string;
  pc_nom: string;
  pc_categorie: string | null;
  created_at: string;
  action: string;
  analysis_id: string | null;
}

interface AnalysisRow {
  id: string;
  pharmacy_id: string;
  suggestions_count: number;
  medicaments: any;
}

interface PharmacyStats {
  pharmacy_id: string;
  pharmacy_name: string;
  analyses: number;
  analyses_with_suggestions: number;
  meds_in_analyses: number;
  suggestions: number;
  accepted: number;
  rejected: number;
  analyses_with_accept: number;
  pcs: Map<string, { count: number; last: string; categorie: string | null; meds: Set<string> }>;
}

// Paginate around PostgREST 1000-row default cap
async function fetchAll<T>(
  build: () => any,
  pageSize = 1000,
  maxRows = 100000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}

// Hypothèses pricing (sources : panier moyen OTC France ~ 8-10€, ticket moyen officine ~ 42€)
const AVG_PC_PRICE_EUR = 9;
const AVG_BASKET_EUR = 42;

const fmtPct = (n: number, digits = 1) =>
  isFinite(n) ? `${n.toFixed(digits)}%` : "—";
const fmtNum = (n: number, digits = 2) =>
  isFinite(n) ? n.toFixed(digits) : "—";
const fmtEur = (n: number, digits = 2) =>
  isFinite(n) ? `${n.toFixed(digits).replace(".", ",")} €` : "—";

const AcceptedPcsTab = () => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PharmacyStats[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [pharmRes, feedbackData, historyData] = await Promise.all([
      supabase.from("pharmacies").select("id, name"),
      fetchAll<FeedbackRow>(() =>
        supabase
          .from("pc_feedback")
          .select("id, pharmacy_id, medicament_nom, pc_nom, pc_categorie, created_at, action, analysis_id")
          .order("created_at", { ascending: false }),
      ),
      fetchAll<AnalysisRow>(() =>
        supabase
          .from("analysis_history")
          .select("id, pharmacy_id, suggestions_count, medicaments")
          .order("created_at", { ascending: false }),
      ),
    ]);

    const pharmMap = new Map<string, string>(
      (pharmRes.data || []).map((p: any) => [p.id, p.name]),
    );
    const byPharm = new Map<string, PharmacyStats>();
    const ensure = (id: string): PharmacyStats => {
      let g = byPharm.get(id);
      if (!g) {
        g = {
          pharmacy_id: id,
          pharmacy_name: pharmMap.get(id) || id.slice(0, 8),
          analyses: 0,
          analyses_with_suggestions: 0,
          meds_in_analyses: 0,
          suggestions: 0,
          accepted: 0,
          rejected: 0,
          analyses_with_accept: 0,
          pcs: new Map(),
        };
        byPharm.set(id, g);
      }
      return g;
    };

    const acceptedAnalysesByPharm = new Map<string, Set<string>>();

    for (const h of historyData) {
      const g = ensure(h.pharmacy_id);
      g.analyses++;
      const sc = h.suggestions_count || 0;
      g.suggestions += sc;
      if (sc > 0) g.analyses_with_suggestions++;
      g.meds_in_analyses += Array.isArray(h.medicaments) ? h.medicaments.length : 0;
    }

    for (const fb of feedbackData) {
      const g = ensure(fb.pharmacy_id);
      if (fb.action === "accepted") {
        g.accepted++;
        if (fb.analysis_id) {
          let s = acceptedAnalysesByPharm.get(fb.pharmacy_id);
          if (!s) {
            s = new Set();
            acceptedAnalysesByPharm.set(fb.pharmacy_id, s);
          }
          s.add(fb.analysis_id);
        }
        const existing = g.pcs.get(fb.pc_nom);
        if (existing) {
          existing.count++;
          existing.meds.add(fb.medicament_nom);
        } else {
          g.pcs.set(fb.pc_nom, {
            count: 1,
            last: fb.created_at,
            categorie: fb.pc_categorie,
            meds: new Set([fb.medicament_nom]),
          });
        }
      } else if (fb.action === "rejected" || fb.action === "dismissed") {
        g.rejected++;
      }
    }

    for (const [pid, s] of acceptedAnalysesByPharm.entries()) {
      const g = byPharm.get(pid);
      if (g) g.analyses_with_accept = s.size;
    }

    setGroups(
      Array.from(byPharm.values()).sort((a, b) => b.accepted - a.accepted),
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        pcs: new Map(
          Array.from(g.pcs.entries()).filter(
            ([pc]) => pc.toLowerCase().includes(q) || g.pharmacy_name.toLowerCase().includes(q),
          ),
        ),
      }))
      .filter(
        (g) => g.pcs.size > 0 || g.pharmacy_name.toLowerCase().includes(q),
      );
  }, [groups, filter]);

  const global = useMemo(() => {
    const totals = groups.reduce(
      (acc, g) => {
        acc.analyses += g.analyses;
        acc.analyses_with_suggestions += g.analyses_with_suggestions;
        acc.meds += g.meds_in_analyses;
        acc.suggestions += g.suggestions;
        acc.accepted += g.accepted;
        acc.rejected += g.rejected;
        acc.analyses_with_accept += g.analyses_with_accept;
        return acc;
      },
      { analyses: 0, analyses_with_suggestions: 0, meds: 0, suggestions: 0, accepted: 0, rejected: 0, analyses_with_accept: 0 },
    );
    // Denominator for "per analyse" metrics = analyses où l'on a effectivement suggéré au moins 1 PC
    const denom = totals.analyses_with_suggestions || totals.analyses;
    const avgMeds = totals.analyses > 0 ? totals.meds / totals.analyses : 0;
    const avgAcceptedPerAnalysis = denom > 0 ? totals.accepted / denom : 0;
    const acceptanceRate = totals.suggestions > 0 ? (totals.accepted / totals.suggestions) * 100 : 0;
    const conversionRate = denom > 0 ? (totals.analyses_with_accept / denom) * 100 : 0;
    const basketUpliftItems = avgMeds > 0 ? (avgAcceptedPerAnalysis / avgMeds) * 100 : 0;
    const upliftEurPerAnalysis = avgAcceptedPerAnalysis * AVG_PC_PRICE_EUR;
    const basketUpliftEur = (upliftEurPerAnalysis / AVG_BASKET_EUR) * 100;
    const totalCaGenerated = totals.accepted * AVG_PC_PRICE_EUR;
    return { ...totals, denom, avgMeds, avgAcceptedPerAnalysis, acceptanceRate, conversionRate, basketUpliftItems, upliftEurPerAnalysis, basketUpliftEur, totalCaGenerated };
  }, [groups]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">PC acceptés &amp; impact panier</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi des PCs validés (commande / clic) et de leur impact sur le panier moyen.
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Analyses
          </div>
          <div className="text-xl font-semibold mt-1">{global.analyses}</div>
          <div className="text-[10px] text-muted-foreground">
            dont {global.analyses_with_suggestions} avec PC suggéré · ø {fmtNum(global.avgMeds)} médic./analyse
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> PCs proposés
          </div>
          <div className="text-xl font-semibold mt-1">{global.suggestions}</div>
          <div className="text-[10px] text-muted-foreground">
            ø {fmtNum(global.denom > 0 ? global.suggestions / global.denom : 0)} / analyse suggérée
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> PCs acceptés
          </div>
          <div className="text-xl font-semibold mt-1 text-emerald-700 dark:text-emerald-500">
            {global.accepted}
          </div>
          <div className="text-[10px] text-muted-foreground">
            ø {fmtNum(global.avgAcceptedPerAnalysis)} / analyse suggérée
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Percent className="h-3.5 w-3.5" /> Taux d'acceptation
          </div>
          <div className="text-xl font-semibold mt-1">{fmtPct(global.acceptanceRate)}</div>
          <div className="text-[10px] text-muted-foreground">
            {fmtPct(global.conversionRate, 0)} d'analyses suggérées converties
          </div>
        </Card>
      </div>

      {/* Impact CA – KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Uplift panier
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-500">
            +{fmtPct(global.basketUpliftEur, 1)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            vs panier moyen {AVG_BASKET_EUR} €
          </div>
        </Card>

        <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShoppingBasket className="h-3.5 w-3.5 text-emerald-600" /> Panier moyen estimé
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-500">
            {fmtEur(AVG_BASKET_EUR + global.upliftEurPerAnalysis)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {AVG_BASKET_EUR} € + {fmtEur(global.upliftEurPerAnalysis)} de PCs
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> CA additionnel / analyse
          </div>
          <div className="text-2xl font-bold mt-1">
            {fmtEur(global.upliftEurPerAnalysis)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            ø PCs acceptés × {AVG_PC_PRICE_EUR} €
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> CA total généré
          </div>
          <div className="text-2xl font-bold mt-1">
            {fmtEur(global.totalCaGenerated, 0)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {global.accepted} PCs × {AVG_PC_PRICE_EUR} €
          </div>
        </Card>
      </div>

      <Card className="p-3 text-xs text-muted-foreground flex items-start gap-2">
        <ShoppingBasket className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Méthode :</strong> Uplift € = (ø PCs acceptés/analyse × prix moyen PC {AVG_PC_PRICE_EUR} €) ÷ panier moyen officine {AVG_BASKET_EUR} €.
          Sur {global.analyses} analyse(s), chaque ordonnance ajoute en moyenne {fmtNum(global.avgAcceptedPerAnalysis)} PC validé(s) ≈ <strong>{fmtEur(global.upliftEurPerAnalysis)}</strong> de CA additionnel,
          soit <strong>+{fmtPct(global.basketUpliftEur)}</strong> sur le panier moyen.
          En volume : +{fmtPct(global.basketUpliftItems)} d'articles vs ordonnance seule.
          <br />
          <span className="text-[10px] italic">
            Hypothèses : prix moyen PC OTC France ~ {AVG_PC_PRICE_EUR} € ; ticket moyen officine ~ {AVG_BASKET_EUR} € (source FSPF/Le Moniteur).
          </span>
        </div>
      </Card>



      <Input
        placeholder="Filtrer par PC ou pharmacie…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune donnée pour le moment.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const isOpen = expanded[g.pharmacy_id] ?? false;
            const pcList = Array.from(g.pcs.entries()).sort(
              (a, b) => b[1].count - a[1].count,
            );
            const denom = g.analyses_with_suggestions || g.analyses;
            const avgMeds = g.analyses > 0 ? g.meds_in_analyses / g.analyses : 0;
            const avgAcc = denom > 0 ? g.accepted / denom : 0;
            const accRate = g.suggestions > 0 ? (g.accepted / g.suggestions) * 100 : 0;
            const convRate = denom > 0 ? (g.analyses_with_accept / denom) * 100 : 0;
            const upliftItems = avgMeds > 0 ? (avgAcc / avgMeds) * 100 : 0;
            const upliftEurAnalysis = avgAcc * AVG_PC_PRICE_EUR;
            const upliftEurPct = (upliftEurAnalysis / AVG_BASKET_EUR) * 100;
            const caTotal = g.accepted * AVG_PC_PRICE_EUR;
            return (
              <Card key={g.pharmacy_id} className="p-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [g.pharmacy_id]: !isOpen,
                    }))
                  }
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-medium truncate">{g.pharmacy_name}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <Badge variant="outline">{g.analyses} analyses ({g.analyses_with_suggestions} suggérées)</Badge>
                    <Badge variant="secondary">{g.accepted} acceptés</Badge>
                    <Badge variant="outline">{fmtPct(accRate, 0)} acc.</Badge>
                    <Badge variant="outline">{fmtEur(caTotal, 0)}</Badge>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      +{fmtPct(upliftEurPct, 0)} panier
                    </Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 border-t pt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">ø médic./analyse</div>
                        <div className="font-semibold">{fmtNum(avgMeds)}</div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">ø PCs acceptés</div>
                        <div className="font-semibold">{fmtNum(avgAcc)}</div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Conversion</div>
                        <div className="font-semibold">{fmtPct(convRate, 0)}</div>
                      </div>
                      <div className="rounded border p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <div className="text-muted-foreground">+€ / analyse</div>
                        <div className="font-semibold text-emerald-700 dark:text-emerald-500">
                          {fmtEur(upliftEurAnalysis)}
                        </div>
                      </div>
                      <div className="rounded border p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <div className="text-muted-foreground">Uplift panier</div>
                        <div className="font-semibold text-emerald-700 dark:text-emerald-500">
                          +{fmtPct(upliftEurPct)}
                        </div>
                      </div>
                      <div className="rounded border p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <div className="text-muted-foreground">CA total</div>
                        <div className="font-semibold text-emerald-700 dark:text-emerald-500">
                          {fmtEur(caTotal, 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground italic">
                      Volume : +{fmtPct(upliftItems, 0)} d'articles ({g.pcs.size} PC uniques).
                    </div>

                    {pcList.length > 0 && (
                      <div className="space-y-1.5">
                        {pcList.map(([pc, data]) => (
                          <div
                            key={pc}
                            className="flex items-start justify-between gap-3 text-sm py-1.5"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{pc}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {data.categorie ? `${data.categorie} • ` : ""}
                                Suite à : {Array.from(data.meds).slice(0, 3).join(", ")}
                                {data.meds.size > 3 ? `, +${data.meds.size - 3}` : ""}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="outline">{data.count}×</Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(data.last).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          Rafraîchir
        </Button>
      </div>
    </div>
  );
};

export default AcceptedPcsTab;
