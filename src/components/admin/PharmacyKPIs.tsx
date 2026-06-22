import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, AlertTriangle, ShoppingBag, TrendingUp, Users, ShoppingCart, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import PatientCRM from "./PatientCRM";
import { fetchAll } from "@/lib/supabaseFetchAll";

interface PharmacyKPI {
  pharmacy_id: string;
  pharmacy_name: string;
  city: string | null;
  total_analyses: number;
  unique_patients: number;
  total_interactions: number;
  major_interactions: number;
  avg_suggestions: number;
  duplicate_prescriptions: number;
  last_analysis: string | null;
}

interface UnmatchedMed {
  id: string;
  nom_saisi: string;
  nom_normalise: string;
  occurrence_count: number;
  last_seen_at: string;
  status: string;
}

const PharmacyKPIs = () => {
  const [kpis, setKpis] = useState<PharmacyKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [unmatched, setUnmatched] = useState<UnmatchedMed[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalAnalyses: 0,
    totalPharmacies: 0,
    totalPatients: 0,
    majorInteractions: 0,
    crossSellRate: 0,
    totalSales: 0,
    medsInDB: 0,
    uniqueMedsAnalyzed: 0,
    unmatchedCount: 0,
  });

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    setLoading(true);
    try {
      // Get all pharmacies
      const { data: pharmacies } = await supabase
        .from("pharmacies")
        .select("id, name, city");

      // Get all analysis history (paginated to avoid PostgREST 1000-row cap)
      const history = await fetchAll<any>(
        () =>
          supabase
            .from("analysis_history" as any)
            .select("*")
            .order("created_at", { ascending: false }),
        1000,
        200_000
      );

      if (!pharmacies) {
        setLoading(false);
        return;
      }

      const historyItems = history as any[];
      let totalPatientSet = new Set<string>();

      const pharmacyKPIs: PharmacyKPI[] = pharmacies.map((p) => {
        const pharmHistory = historyItems.filter((h) => h.pharmacy_id === p.id);
        const patientHashes = new Set(pharmHistory.map((h) => h.patient_hash));
        const prescriptionHashes = pharmHistory.map((h) => h.prescription_hash);
        const duplicateCount = prescriptionHashes.length - new Set(prescriptionHashes).size;

        patientHashes.forEach((h) => totalPatientSet.add(h));

        return {
          pharmacy_id: p.id,
          pharmacy_name: p.name,
          city: p.city,
          total_analyses: pharmHistory.length,
          unique_patients: patientHashes.size,
          total_interactions: pharmHistory.reduce((s, h) => s + (h.interactions_count || 0), 0),
          major_interactions: pharmHistory.filter((h) => h.has_major_interaction).length,
          avg_suggestions: pharmHistory.length > 0
            ? Math.round(pharmHistory.reduce((s, h) => s + (h.suggestions_count || 0), 0) / pharmHistory.length * 10) / 10
            : 0,
          duplicate_prescriptions: duplicateCount,
          last_analysis: pharmHistory[0]?.created_at || null,
        };
      });

      setKpis(pharmacyKPIs.sort((a, b) => b.total_analyses - a.total_analyses));

      // Cross-sell stats
      let crossSellRate = 0;
      let totalSales = 0;
      let medsInDB = 0;
      let uniqueMedsAnalyzed = 0;
      let unmatchedCount = 0;

      try {
        const { count: salesC } = await supabase
          .from("sales_transactions" as any)
          .select("id", { count: "exact", head: true });
        totalSales = salesC || 0;

        const csData = await fetchAll<{ was_sold: boolean }>(
          () =>
            supabase
              .from("cross_sell_tracking" as any)
              .select("was_sold"),
          1000,
          100_000
        );
        if (csData && csData.length > 0) {
          const sold = csData.filter((r) => r.was_sold).length;
          crossSellRate = Math.round((sold / csData.length) * 100);
        }
      } catch { /* tables may not exist yet */ }

      // Coverage ratio: meds in DB vs unique meds analyzed
      try {
        const { count: medsCount } = await supabase
          .from("medicaments")
          .select("id", { count: "exact", head: true });
        medsInDB = medsCount || 0;

        // Count unique medication names from analysis history
        const uniqueMedNames = new Set<string>();
        for (const h of historyItems) {
          const meds = h.medicaments as any[];
          if (Array.isArray(meds)) {
            for (const m of meds) {
              const name = (m.nom || m.nom_commercial || "").trim().toLowerCase()
                .replace(/\d+\s*(mg|g|ml|ui|µg|mcg|%)/gi, "")
                .replace(/\s+/g, " ").trim();
              if (name.length >= 3) uniqueMedNames.add(name);
            }
          }
        }
        uniqueMedsAnalyzed = uniqueMedNames.size;

        const { count: unmatchedC } = await supabase
          .from("unmatched_medicaments" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        unmatchedCount = unmatchedC || 0;

        // Load detailed unmatched list (top 50 by recency)
        const { data: unmatchedList } = await supabase
          .from("unmatched_medicaments" as any)
          .select("id, nom_saisi, nom_normalise, occurrence_count, last_seen_at, status")
          .eq("status", "pending")
          .order("last_seen_at", { ascending: false })
          .limit(50);
        setUnmatched((unmatchedList as any[] as UnmatchedMed[]) || []);
      } catch { /* table may not exist yet */ }

      setGlobalStats({
        totalAnalyses: historyItems.length,
        totalPharmacies: pharmacies.length,
        totalPatients: totalPatientSet.size,
        majorInteractions: historyItems.filter((h) => h.has_major_interaction).length,
        crossSellRate,
        totalSales,
        medsInDB,
        uniqueMedsAnalyzed,
        unmatchedCount,
      });
    } catch (err) {
      console.error("KPI load error:", err);
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

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Analyses totales</span>
            </div>
            <p className="text-2xl font-bold">{globalStats.totalAnalyses}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Patients uniques</span>
            </div>
            <p className="text-2xl font-bold">{globalStats.totalPatients}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Pharmacies actives</span>
            </div>
            <p className="text-2xl font-bold">{globalStats.totalPharmacies}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Interactions majeures</span>
            </div>
            <p className="text-2xl font-bold">{globalStats.majorInteractions}</p>
          </CardContent>
        </Card>
        {globalStats.totalSales > 0 && (
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Cross-sell</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold">{globalStats.crossSellRate}%</p>
                <span className="text-xs text-muted-foreground">{globalStats.totalSales} ventes tracées</span>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-border col-span-2 md:col-span-2">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Couverture médicaments</span>
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-2xl font-bold">
                {globalStats.uniqueMedsAnalyzed > 0 
                  ? Math.round(((globalStats.uniqueMedsAnalyzed - globalStats.unmatchedCount) / globalStats.uniqueMedsAnalyzed) * 100)
                  : 100}%
              </p>
              <span className="text-xs text-muted-foreground">
                {globalStats.medsInDB} en base · {globalStats.uniqueMedsAnalyzed} analysés
                {globalStats.unmatchedCount > 0 && (
                  <span className="text-destructive font-medium"> · {globalStats.unmatchedCount} manquants</span>
                )}
              </span>
            </div>
            <Progress 
              value={globalStats.uniqueMedsAnalyzed > 0 
                ? ((globalStats.uniqueMedsAnalyzed - globalStats.unmatchedCount) / globalStats.uniqueMedsAnalyzed) * 100
                : 100} 
              className="h-1.5"
            />
          </CardContent>
        </Card>
      </div>

      {/* Unmatched medications list */}
      {unmatched.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm font-semibold">
                  Médicaments analysés mais manquants en base
                </CardTitle>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                {unmatched.length} à enrichir
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Détectés dans des ordonnances mais introuvables dans la base clinique. À ajouter en priorité.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="max-h-[280px] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Nom détecté</th>
                    <th className="text-left px-3 py-2 font-semibold">Forme normalisée</th>
                    <th className="text-right px-3 py-2 font-semibold">Occurrences</th>
                    <th className="text-right px-3 py-2 font-semibold">Dernière analyse</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-secondary/50">
                      <td className="px-3 py-2 font-medium">{m.nom_saisi}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{m.nom_normalise}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="secondary" className="text-[10px]">{m.occurrence_count}×</Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {new Date(m.last_seen_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRM / Patient History */}
      <PatientCRM />

      {/* Per-pharmacy KPIs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Par pharmacie</h3>
        {kpis.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
        ) : (
          kpis.map((kpi) => (
            <Card key={kpi.pharmacy_id} className="border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{kpi.pharmacy_name}</CardTitle>
                    {kpi.city && <p className="text-xs text-muted-foreground">{kpi.city}</p>}
                  </div>
                  {kpi.last_analysis && (
                    <span className="text-[10px] text-muted-foreground">
                      Dernière: {new Date(kpi.last_analysis).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div className="text-center p-2 rounded-md bg-secondary">
                    <p className="text-lg font-bold">{kpi.total_analyses}</p>
                    <p className="text-[10px] text-muted-foreground">Analyses</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary">
                    <p className="text-lg font-bold">{kpi.unique_patients}</p>
                    <p className="text-[10px] text-muted-foreground">Patients</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary">
                    <p className="text-lg font-bold">{kpi.total_interactions}</p>
                    <p className="text-[10px] text-muted-foreground">Interactions</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary">
                    <p className="text-lg font-bold">{kpi.avg_suggestions}</p>
                    <p className="text-[10px] text-muted-foreground">Moy. sugg.</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary">
                    <p className="text-lg font-bold">{kpi.duplicate_prescriptions}</p>
                    <p className="text-[10px] text-muted-foreground">Doublons</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary">
                    {kpi.major_interactions > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">{kpi.major_interactions}</Badge>
                    ) : (
                      <p className="text-lg font-bold text-primary">0</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Majeures</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default PharmacyKPIs;
