import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Metric {
  id: string;
  medicament_source: string;
  pc_proposed: string;
  pc_categorie: string | null;
  times_proposed: number;
  times_displayed: number;
  times_clicked: number;
  times_scanned: number;
  times_sold: number;
  conversion_rate: number;
  pharmacy_id: string;
}

const RecommendationMetrics = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"conversion_rate" | "times_proposed" | "times_sold">("times_proposed");

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    const { data } = await supabase
      .from("recommendation_metrics")
      .select("*")
      .order("times_proposed", { ascending: false })
      .limit(100);

    setMetrics((data as any[]) || []);
    setLoading(false);
  };

  const sorted = [...metrics].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  const topPerformers = sorted.filter(m => m.times_sold > 0).slice(0, 5);
  const lowPerformers = sorted.filter(m => m.times_proposed >= 5 && m.times_sold === 0).slice(0, 5);

  const totalProposed = metrics.reduce((s, m) => s + m.times_proposed, 0);
  const totalSold = metrics.reduce((s, m) => s + m.times_sold, 0);
  const globalConversion = totalProposed > 0 ? ((totalSold / totalProposed) * 100).toFixed(1) : "0";

  if (loading) return <div className="text-xs text-muted-foreground p-4">Chargement des métriques...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Performance des recommandations</h3>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-secondary/50 border text-center">
          <p className="text-lg font-bold text-foreground">{totalProposed}</p>
          <p className="text-[10px] text-muted-foreground">PC proposés</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 border text-center">
          <p className="text-lg font-bold text-foreground">{totalSold}</p>
          <p className="text-[10px] text-muted-foreground">PC vendus</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
          <p className="text-lg font-bold text-primary">{globalConversion}%</p>
          <p className="text-[10px] text-muted-foreground">Conversion</p>
        </div>
      </div>

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs font-semibold text-green-700">Top performers</span>
          </div>
          {topPerformers.map(m => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-900/10 text-xs">
              <div>
                <span className="font-medium">{m.pc_proposed}</span>
                <span className="text-muted-foreground ml-1.5">← {m.medicament_source}</span>
              </div>
              <Badge className="bg-green-100 text-green-800 text-[10px]">
                {((m.times_sold / m.times_proposed) * 100).toFixed(0)}% conv.
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Low performers */}
      {lowPerformers.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-destructive" />
            <span className="text-xs font-semibold text-destructive">À optimiser</span>
          </div>
          {lowPerformers.map(m => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded bg-destructive/5 text-xs">
              <div>
                <span className="font-medium">{m.pc_proposed}</span>
                <span className="text-muted-foreground ml-1.5">← {m.medicament_source}</span>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                {m.times_proposed}× proposé, 0 vendu
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Full table */}
      {metrics.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Détail complet</span>
            <div className="flex gap-1">
              {(["times_proposed", "times_sold", "conversion_rate"] as const).map(key => (
                <Button
                  key={key}
                  size="sm"
                  variant={sortBy === key ? "default" : "ghost"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setSortBy(key)}>
                  {key === "times_proposed" ? "Proposés" : key === "times_sold" ? "Vendus" : "Conv."}
                </Button>
              ))}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {sorted.slice(0, 20).map(m => (
              <div key={m.id} className="flex items-center justify-between p-1.5 rounded bg-secondary/30 text-[11px]">
                <div className="truncate flex-1">
                  <span className="font-medium">{m.pc_proposed}</span>
                  <span className="text-muted-foreground"> ← {m.medicament_source}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <span>{m.times_proposed}p</span>
                  <span>{m.times_clicked}c</span>
                  <span>{m.times_sold}v</span>
                  <span className="font-semibold text-foreground">
                    {m.times_proposed > 0 ? ((m.times_sold / m.times_proposed) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
          Aucune donnée de performance encore. Les métriques apparaîtront après les premières analyses.
        </div>
      )}
    </div>
  );
};

export default RecommendationMetrics;
