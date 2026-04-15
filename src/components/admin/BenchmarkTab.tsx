import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, Users, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BenchmarkData {
  global: {
    total_pharmacies: number;
    active_pharmacies: number;
    total_analyses: number;
    avg_analyses_per_pharmacy: number;
    avg_conversion_rate: number | null;
    percentiles_analyses_day: { p25: number; p50: number; p75: number };
  };
  pharmacies: {
    label: string;
    city: string;
    status: string;
    total_analyses: number;
    analyses_30d: number;
    avg_analyses_per_day: number;
    avg_suggestions: number;
    major_interactions: number;
    conversion_rate: number | null;
    total_feedback: number;
  }[];
}

const BenchmarkTab = () => {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBenchmark();
  }, []);

  const loadBenchmark = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-benchmark");
      if (error) throw error;
      setData(result);
    } catch (e) {
      console.error("Benchmark error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground text-center py-8">Impossible de charger le benchmark</p>;
  }

  const { global, pharmacies } = data;
  const maxAnalyses = Math.max(...pharmacies.map((p) => p.total_analyses), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Benchmark anonymisé — vue globale
      </h3>

      {/* Global metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Pharmacies actives</span>
            </div>
            <p className="text-2xl font-bold">
              {global.active_pharmacies}
              <span className="text-sm text-muted-foreground font-normal"> / {global.total_pharmacies}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Moy. analyses / pharmacie</span>
            </div>
            <p className="text-2xl font-bold">{global.avg_analyses_per_pharmacy}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Conversion PC moy.</span>
            </div>
            <p className="text-2xl font-bold">
              {global.avg_conversion_rate !== null ? `${global.avg_conversion_rate}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Analyses / jour (P50)</span>
            </div>
            <p className="text-2xl font-bold">{global.percentiles_analyses_day.p50}</p>
            <p className="text-[10px] text-muted-foreground">
              P25: {global.percentiles_analyses_day.p25} · P75: {global.percentiles_analyses_day.p75}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-pharmacy ranking (anonymized) */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Classement (anonymisé)</h4>
        {pharmacies.map((p, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-[10px] text-muted-foreground">{p.city}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.conversion_rate !== null && (
                  <Badge variant={p.conversion_rate >= 50 ? "default" : "secondary"} className="text-[9px]">
                    {p.conversion_rate}% conv.
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px]">
                  {p.analyses_30d} / 30j
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={(p.total_analyses / maxAnalyses) * 100} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground w-16 text-right">
                {p.total_analyses} total
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-sm font-bold">{p.avg_analyses_per_day}</p>
                <p className="text-[9px] text-muted-foreground">/ jour</p>
              </div>
              <div>
                <p className="text-sm font-bold">{p.avg_suggestions}</p>
                <p className="text-[9px] text-muted-foreground">sugg. moy</p>
              </div>
              <div>
                <p className="text-sm font-bold">{p.major_interactions}</p>
                <p className="text-[9px] text-muted-foreground">majeures</p>
              </div>
              <div>
                <p className="text-sm font-bold">{p.total_feedback}</p>
                <p className="text-[9px] text-muted-foreground">feedbacks</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BenchmarkTab;
