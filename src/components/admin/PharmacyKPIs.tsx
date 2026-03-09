import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, AlertTriangle, ShoppingBag, TrendingUp, Users } from "lucide-react";

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

const PharmacyKPIs = () => {
  const [kpis, setKpis] = useState<PharmacyKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({
    totalAnalyses: 0,
    totalPharmacies: 0,
    totalPatients: 0,
    majorInteractions: 0,
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

      // Get all analysis history
      const { data: history } = await supabase
        .from("analysis_history" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (!pharmacies || !history) {
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
      setGlobalStats({
        totalAnalyses: historyItems.length,
        totalPharmacies: pharmacies.length,
        totalPatients: totalPatientSet.size,
        majorInteractions: historyItems.filter((h) => h.has_major_interaction).length,
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
      </div>

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
