// build: roi-manque-a-gagner tab live — v2026.06.01.3
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, Target, Euro, AlertCircle, Trophy,
  Loader2, RefreshCw, Award, Sparkles, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────────
interface RoiStats {
  kpis: {
    total_proposed: number;
    total_accepted: number;
    total_rejected: number;
    conversion_rate: number;
    ca_estime_euros: number;
    manque_a_gagner_euros: number;
    pcs_per_day_avg: number;
    days_active: number;
  };
  benchmark: {
    avg_conversion_rate: number;
    avg_pcs_per_day: number;
    top_quartile_conversion: number;
    my_rank: number;
    total_pharmacies: number;
  };
  underperforming_pcs: Array<{
    pc_nom: string;
    pc_categorie: string | null;
    my_rate: number;
    network_rate: number | null;
    gap: number;
    my_count: number;
    ca_perdu_estime: number;
  }>;
  missed_opportunities: Array<{
    medicament_nom: string;
    scans_count: number;
    pcs_proposed: number;
    pcs_accepted: number;
    acceptance_rate: number;
  }>;
  daily_trend: Array<{
    date: string;
    proposed: number;
    accepted: number;
    conversion_rate: number;
  }>;
}

interface Pharmacy {
  id: string;
  name: string;
  city: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const formatEuros = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// ── Component ───────────────────────────────────────────────────────────────
const RoiManqueAGagnerTab = () => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string>("");
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [stats, setStats] = useState<RoiStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger la liste des pharmacies
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pharmacies")
        .select("id, name, city")
        .order("name");
      setPharmacies((data as Pharmacy[]) || []);
      if (data && data.length > 0 && !pharmacyId) {
        setPharmacyId(data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = useCallback(async () => {
    if (!pharmacyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pharmacy-roi-stats", {
        body: { pharmacy_id: pharmacyId, period_days: periodDays },
      });
      if (error) throw new Error(error.message);
      setStats(data as RoiStats);
    } catch (e: any) {
      toast.error("Erreur de chargement : " + (e?.message ?? String(e)));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, periodDays]);

  useEffect(() => {
    if (pharmacyId) loadStats();
  }, [pharmacyId, periodDays, loadStats]);

  const selectedPharmacy = useMemo(
    () => pharmacies.find(p => p.id === pharmacyId),
    [pharmacies, pharmacyId],
  );

  // ── KPI Cards ─────────────────────────────────────────────────────────────
  const conversionDelta = stats
    ? stats.kpis.conversion_rate - stats.benchmark.avg_conversion_rate
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Euro className="h-5 w-5 text-emerald-600" />
            ROI & Manque à gagner
          </h2>
          <p className="text-xs text-muted-foreground">
            Performance commerciale des suggestions Asclion vs benchmark réseau
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={pharmacyId} onValueChange={setPharmacyId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Sélectionner une pharmacie…" />
            </SelectTrigger>
            <SelectContent>
              {pharmacies.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.city ? ` — ${p.city}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(periodDays)} onValueChange={v => setPeriodDays(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && stats && (
        <>
          {/* ── KPI Cards top ──────────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* CA estimé */}
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Euro className="h-4 w-4 text-emerald-600" />
                  CA généré (estimé)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-700">
                  {formatEuros(stats.kpis.ca_estime_euros)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.kpis.total_accepted} suggestions acceptées
                </p>
              </CardContent>
            </Card>

            {/* Manque à gagner */}
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Manque à gagner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-700">
                  {formatEuros(stats.kpis.manque_a_gagner_euros)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.kpis.total_rejected} suggestions refusées
                </p>
              </CardContent>
            </Card>

            {/* Taux de conversion */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Taux d'acceptation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold">{stats.kpis.conversion_rate}%</div>
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${conversionDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {conversionDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(conversionDelta)}pt
                  </span>
                </div>
                <Progress value={stats.kpis.conversion_rate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Réseau : {stats.benchmark.avg_conversion_rate}% · Top 25% : {stats.benchmark.top_quartile_conversion}%
                </p>
              </CardContent>
            </Card>

            {/* Classement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Classement réseau
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  #{stats.benchmark.my_rank}
                  <span className="text-base font-normal text-muted-foreground"> / {stats.benchmark.total_pharmacies}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.kpis.pcs_per_day_avg.toFixed(1)} PCs/jour · {stats.kpis.days_active} jours actifs
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── PCs sous-performants ────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                PCs qui marchent ailleurs… mais pas chez vous
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Suggestions où votre taux d'acceptation est inférieur de 15 points ou plus au reste du réseau.
                Une formation ciblée de l'équipe ou un argumentaire revu peut récupérer ce CA.
              </p>
            </CardHeader>
            <CardContent>
              {stats.underperforming_pcs.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Award className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  Aucun PC sous-performant détecté. Votre équipe maîtrise les suggestions !
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit complémentaire</TableHead>
                      <TableHead className="text-right">Chez vous</TableHead>
                      <TableHead className="text-right">Réseau</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead className="text-right">CA perdu estimé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.underperforming_pcs.map((pc, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{pc.pc_nom}</div>
                          {pc.pc_categorie && (
                            <Badge variant="outline" className="mt-1 text-[10px]">{pc.pc_categorie}</Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Proposé {pc.my_count} fois
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{pc.my_rate}%</TableCell>
                        <TableCell className="text-right font-mono text-emerald-700">{pc.network_rate}%</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                            -{pc.gap}pt
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-700">
                          {formatEuros(pc.ca_perdu_estime)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ── Opportunités manquées par médicament ─────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Médicaments où vous ratez le plus de ventes
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Médicaments fréquemment scannés mais où l'équipe accepte rarement les suggestions complémentaires.
              </p>
            </CardHeader>
            <CardContent>
              {stats.missed_opportunities.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Pas de pattern significatif détecté sur la période.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Médicament</TableHead>
                      <TableHead className="text-right">Scans</TableHead>
                      <TableHead className="text-right">Acceptés</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.missed_opportunities.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.medicament_nom}</TableCell>
                        <TableCell className="text-right font-mono">{m.scans_count}</TableCell>
                        <TableCell className="text-right font-mono">{m.pcs_accepted}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={m.acceptance_rate < 15 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}>
                            {m.acceptance_rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ── Tendance quotidienne ─────────────────────────────────────── */}
          {stats.daily_trend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Tendance — Suggestions vs acceptations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {stats.daily_trend.slice(-14).reverse().map(d => (
                    <div key={d.date} className="flex items-center gap-3 text-xs">
                      <div className="w-20 text-muted-foreground tabular-nums">
                        {new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Progress value={d.conversion_rate} className="h-1.5 flex-1" />
                          <span className="w-12 text-right font-mono">{d.conversion_rate}%</span>
                        </div>
                      </div>
                      <div className="w-32 text-right text-muted-foreground tabular-nums">
                        {d.accepted} / {d.proposed} acceptés
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Footer info ──────────────────────────────────────────────── */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            💡 <strong>Méthode</strong> — CA estimé sur la base des prix moyens officinaux par catégorie (complément 12€,
            dispositif 15€, dermo 18€, OTC 6€, etc.). Le benchmark exclut les pharmacies avec moins de 10 propositions
            sur la période. Le PC est marqué "sous-performant" à partir de 15 points d'écart vs réseau.
          </div>
        </>
      )}
    </div>
  );
};

export default RoiManqueAGagnerTab;
