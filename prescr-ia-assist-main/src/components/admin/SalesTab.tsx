import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart, TrendingUp, Package, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CrossSellRecord {
  id: string;
  medicament_nom: string;
  medicament_id: string | null;
  pathologie_nom: string | null;
  pathologie_id: string | null;
  produit_complementaire_nom: string;
  produit_complementaire_id: string | null;
  was_sold: boolean;
  created_at: string;
}

interface MedStats {
  medicament_nom: string;
  total_recommendations: number;
  total_sold: number;
  rate: number;
  topProducts: { name: string; sold: number; total: number; rate: number }[];
}

interface PathoStats {
  pathologie_nom: string;
  total_recommendations: number;
  total_sold: number;
  rate: number;
}

const SalesTab = () => {
  const [loading, setLoading] = useState(true);
  const [crossSellData, setCrossSellData] = useState<CrossSellRecord[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [view, setView] = useState<"global" | "medicament" | "pathologie">("global");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Paginate cross_sell_tracking
      let allCrossSell: CrossSellRecord[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("cross_sell_tracking" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allCrossSell = allCrossSell.concat(data as any[]);
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      setCrossSellData(allCrossSell);

      const { count } = await supabase
        .from("sales_transactions" as any)
        .select("id", { count: "exact", head: true });
      setSalesCount(count || 0);
    } catch (err) {
      console.error("SalesTab load error:", err);
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

  // Compute stats
  const totalRecommendations = crossSellData.length;
  const totalSold = crossSellData.filter(r => r.was_sold).length;
  const globalRate = totalRecommendations > 0 ? Math.round((totalSold / totalRecommendations) * 100) : 0;

  // By medicament
  const byMed = new Map<string, CrossSellRecord[]>();
  crossSellData.forEach(r => {
    const key = r.medicament_nom;
    if (!byMed.has(key)) byMed.set(key, []);
    byMed.get(key)!.push(r);
  });

  const medStats: MedStats[] = Array.from(byMed.entries()).map(([nom, records]) => {
    const sold = records.filter(r => r.was_sold).length;
    // Group by product
    const byProd = new Map<string, { sold: number; total: number }>();
    records.forEach(r => {
      const pName = r.produit_complementaire_nom;
      if (!byProd.has(pName)) byProd.set(pName, { sold: 0, total: 0 });
      const p = byProd.get(pName)!;
      p.total++;
      if (r.was_sold) p.sold++;
    });

    return {
      medicament_nom: nom,
      total_recommendations: records.length,
      total_sold: sold,
      rate: records.length > 0 ? Math.round((sold / records.length) * 100) : 0,
      topProducts: Array.from(byProd.entries())
        .map(([name, s]) => ({ name, ...s, rate: s.total > 0 ? Math.round((s.sold / s.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total),
    };
  }).sort((a, b) => b.total_recommendations - a.total_recommendations);

  // By pathologie
  const byPatho = new Map<string, CrossSellRecord[]>();
  crossSellData.forEach(r => {
    const key = r.pathologie_nom || "Non classé";
    if (!byPatho.has(key)) byPatho.set(key, []);
    byPatho.get(key)!.push(r);
  });

  const pathoStats: PathoStats[] = Array.from(byPatho.entries()).map(([nom, records]) => {
    const sold = records.filter(r => r.was_sold).length;
    return {
      pathologie_nom: nom,
      total_recommendations: records.length,
      total_sold: sold,
      rate: records.length > 0 ? Math.round((sold / records.length) * 100) : 0,
    };
  }).sort((a, b) => b.total_recommendations - a.total_recommendations);

  // Chart data (top 10 meds)
  const chartData = medStats.slice(0, 10).map(m => ({
    name: m.medicament_nom.length > 15 ? m.medicament_nom.substring(0, 15) + "…" : m.medicament_nom,
    rate: m.rate,
    ventes: m.total_sold,
  }));

  if (totalRecommendations === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Aucune donnée de vente pour le moment.
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Les stats de cross-sell se rempliront automatiquement quand la caisse enverra des tickets de vente 
          via le webhook (type: <code className="bg-muted px-1 rounded">"sale"</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Ventes tracées</span>
            </div>
            <p className="text-2xl font-bold">{salesCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Produits recommandés</span>
            </div>
            <p className="text-2xl font-bold">{totalRecommendations}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Vendus en cross-sell</span>
            </div>
            <p className="text-2xl font-bold">{totalSold}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Taux cross-sell</span>
            </div>
            <p className="text-2xl font-bold">{globalRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Taux de cross-sell par médicament (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "rate" ? `${value}%` : value,
                    name === "rate" ? "Taux" : "Vendus",
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} className="fill-primary" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* View selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("global")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            view === "global" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Par médicament
        </button>
        <button
          onClick={() => setView("pathologie")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            view === "pathologie" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Par pathologie
        </button>
      </div>

      {/* Detail views */}
      {view === "global" && (
        <div className="space-y-3">
          {medStats.map((m) => (
            <Card key={m.medicament_nom} className="border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{m.medicament_nom}</CardTitle>
                  <Badge variant={m.rate >= 30 ? "default" : "secondary"} className="text-[10px]">
                    {m.rate >= 30 ? (
                      <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {m.rate}% cross-sell
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {m.total_sold} vendus / {m.total_recommendations} recommandés
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1.5">
                  {m.topProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[60%]">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${p.rate}%` }}
                          />
                        </div>
                        <span className="font-medium w-10 text-right">{p.rate}%</span>
                        <span className="text-muted-foreground w-14 text-right">{p.sold}/{p.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "pathologie" && (
        <div className="space-y-2">
          {pathoStats.map((p) => (
            <div key={p.pathologie_nom} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{p.pathologie_nom}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.total_sold} vendus / {p.total_recommendations} recommandés
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${p.rate}%` }}
                  />
                </div>
                <Badge variant={p.rate >= 30 ? "default" : "outline"} className="text-[10px] w-14 justify-center">
                  {p.rate}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesTab;
