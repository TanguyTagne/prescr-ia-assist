import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, AlertTriangle, CalendarClock, MessageSquare, Repeat } from "lucide-react";

interface CRMStats {
  totalPatients: number;
  recurringPatients: number;
  recurringRate: number;
  contraIndicationRate: number;
  avgVisitFrequencyDays: number;
  patientsWithContraIndications: number;
  scheduledReminders: number;
  sentReminders: number;
}

const PatientCRM = () => {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCRMStats();
  }, []);

  const loadCRMStats = async () => {
    setLoading(true);
    try {
      const { data: history } = await supabase
        .from("analysis_history")
        .select("patient_hash, has_major_interaction, created_at")
        .order("created_at", { ascending: true });

      const { data: reminders } = await supabase
        .from("patient_reminders")
        .select("status");

      const items = (history as any[]) || [];
      const reminderItems = (reminders as any[]) || [];

      // Group by patient
      const patientMap = new Map<string, { visits: string[]; hasMajor: boolean }>();
      for (const h of items) {
        const existing = patientMap.get(h.patient_hash) || { visits: [], hasMajor: false };
        existing.visits.push(h.created_at);
        if (h.has_major_interaction) existing.hasMajor = true;
        patientMap.set(h.patient_hash, existing);
      }

      const totalPatients = patientMap.size;
      let recurringPatients = 0;
      let patientsWithContra = 0;
      let totalFrequencyDays = 0;
      let patientsWithMultipleVisits = 0;

      for (const [, data] of patientMap) {
        if (data.visits.length > 1) {
          recurringPatients++;
          // Avg days between visits
          const sorted = data.visits.map(d => new Date(d).getTime()).sort();
          const totalDays = (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24);
          const avgDays = totalDays / (sorted.length - 1);
          totalFrequencyDays += avgDays;
          patientsWithMultipleVisits++;
        }
        if (data.hasMajor) patientsWithContra++;
      }

      setStats({
        totalPatients,
        recurringPatients,
        recurringRate: totalPatients > 0 ? Math.round((recurringPatients / totalPatients) * 100) : 0,
        contraIndicationRate: totalPatients > 0 ? Math.round((patientsWithContra / totalPatients) * 100) : 0,
        avgVisitFrequencyDays: patientsWithMultipleVisits > 0
          ? Math.round(totalFrequencyDays / patientsWithMultipleVisits)
          : 0,
        patientsWithContraIndications: patientsWithContra,
        scheduledReminders: reminderItems.filter(r => r.status === "scheduled").length,
        sentReminders: reminderItems.filter(r => r.status === "sent").length,
      });
    } catch (err) {
      console.error("CRM stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        CRM / Historique patient
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground">Patients uniques</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalPatients}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground">Fidélité</span>
            </div>
            <p className="text-2xl font-bold">{stats.recurringRate}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.recurringPatients} récurrents</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-[10px] text-muted-foreground">Contre-indications</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{stats.contraIndicationRate}%</p>
              {stats.patientsWithContraIndications > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {stats.patientsWithContraIndications}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground">Fréq. visite moy.</span>
            </div>
            <p className="text-2xl font-bold">
              {stats.avgVisitFrequencyDays > 0 ? `${stats.avgVisitFrequencyDays}j` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground">Rappels programmés</span>
            </div>
            <p className="text-2xl font-bold">{stats.scheduledReminders}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Rappels envoyés</span>
            </div>
            <p className="text-2xl font-bold">{stats.sentReminders}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientCRM;
