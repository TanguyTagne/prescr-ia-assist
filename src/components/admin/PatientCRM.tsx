import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, AlertTriangle, CalendarClock, MessageSquare, Repeat, Send, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PharmacyCRMStats {
  pharmacyId: string;
  pharmacyName: string;
  city: string | null;
  totalPatients: number;
  recurringPatients: number;
  recurringRate: number;
  contraIndicationRate: number;
  avgVisitFrequencyDays: number;
  patientsWithContraIndications: number;
  scheduledReminders: number;
  sentReminders: number;
  totalAnalyses: number;
  totalInteractions: number;
  majorInteractions: number;
  avgSuggestions: number;
  lastAnalysis: string | null;
}

interface GlobalCRMStats {
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
  const [globalStats, setGlobalStats] = useState<GlobalCRMStats | null>(null);
  const [pharmacyStats, setPharmacyStats] = useState<PharmacyCRMStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPharmacy, setExpandedPharmacy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadCRMStats();
  }, []);

  const loadCRMStats = async () => {
    setLoading(true);
    try {
      const [historyRes, remindersRes, pharmaciesRes] = await Promise.all([
        supabase
          .from("analysis_history")
          .select("patient_hash, has_major_interaction, created_at, pharmacy_id, interactions_count, suggestions_count")
          .order("created_at", { ascending: true }),
        supabase.from("patient_reminders").select("status, pharmacy_id"),
        supabase.from("pharmacies").select("id, name, city"),
      ]);

      const items = (historyRes.data as any[]) || [];
      const reminderItems = (remindersRes.data as any[]) || [];
      const pharmacies = pharmaciesRes.data || [];

      // Global stats
      const globalPatientMap = new Map<string, { visits: string[]; hasMajor: boolean }>();
      for (const h of items) {
        const existing = globalPatientMap.get(h.patient_hash) || { visits: [], hasMajor: false };
        existing.visits.push(h.created_at);
        if (h.has_major_interaction) existing.hasMajor = true;
        globalPatientMap.set(h.patient_hash, existing);
      }

      const gStats = computeStats(globalPatientMap);
      setGlobalStats({
        ...gStats,
        scheduledReminders: reminderItems.filter(r => r.status === "scheduled").length,
        sentReminders: reminderItems.filter(r => r.status === "sent").length,
      });

      // Per-pharmacy stats
      const perPharmacy: PharmacyCRMStats[] = pharmacies.map(p => {
        const pharmHistory = items.filter(h => h.pharmacy_id === p.id);
        const pharmReminders = reminderItems.filter(r => r.pharmacy_id === p.id);

        const patientMap = new Map<string, { visits: string[]; hasMajor: boolean }>();
        for (const h of pharmHistory) {
          const existing = patientMap.get(h.patient_hash) || { visits: [], hasMajor: false };
          existing.visits.push(h.created_at);
          if (h.has_major_interaction) existing.hasMajor = true;
          patientMap.set(h.patient_hash, existing);
        }

        const stats = computeStats(patientMap);

        return {
          pharmacyId: p.id,
          pharmacyName: p.name,
          city: p.city,
          ...stats,
          scheduledReminders: pharmReminders.filter(r => r.status === "scheduled").length,
          sentReminders: pharmReminders.filter(r => r.status === "sent").length,
          totalAnalyses: pharmHistory.length,
          totalInteractions: pharmHistory.reduce((s: number, h: any) => s + (h.interactions_count || 0), 0),
          majorInteractions: pharmHistory.filter((h: any) => h.has_major_interaction).length,
          avgSuggestions: pharmHistory.length > 0
            ? Math.round(pharmHistory.reduce((s: number, h: any) => s + (h.suggestions_count || 0), 0) / pharmHistory.length * 10) / 10
            : 0,
          lastAnalysis: pharmHistory.length > 0 ? pharmHistory[pharmHistory.length - 1]?.created_at : null,
        };
      });

      setPharmacyStats(perPharmacy.sort((a, b) => b.totalAnalyses - a.totalAnalyses));
    } catch (err) {
      console.error("CRM stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (patientMap: Map<string, { visits: string[]; hasMajor: boolean }>) => {
    const totalPatients = patientMap.size;
    let recurringPatients = 0;
    let patientsWithContra = 0;
    let totalFrequencyDays = 0;
    let patientsWithMultipleVisits = 0;

    for (const [, data] of patientMap) {
      if (data.visits.length > 1) {
        recurringPatients++;
        const sorted = data.visits.map(d => new Date(d).getTime()).sort();
        const totalDays = (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24);
        const avgDays = totalDays / (sorted.length - 1);
        totalFrequencyDays += avgDays;
        patientsWithMultipleVisits++;
      }
      if (data.hasMajor) patientsWithContra++;
    }

    return {
      totalPatients,
      recurringPatients,
      recurringRate: totalPatients > 0 ? Math.round((recurringPatients / totalPatients) * 100) : 0,
      contraIndicationRate: totalPatients > 0 ? Math.round((patientsWithContra / totalPatients) * 100) : 0,
      avgVisitFrequencyDays: patientsWithMultipleVisits > 0
        ? Math.round(totalFrequencyDays / patientsWithMultipleVisits)
        : 0,
      patientsWithContraIndications: patientsWithContra,
    };
  };

  const generatePharmacyReport = (p: PharmacyCRMStats) => {
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return `📊 Rapport KPI — ${p.pharmacyName}${p.city ? ` (${p.city})` : ""}
${date}

━━━ Activité ━━━
• Analyses réalisées : ${p.totalAnalyses}
• Patients uniques : ${p.totalPatients}
• Interactions détectées : ${p.totalInteractions}
• Interactions majeures : ${p.majorInteractions}
• Moy. suggestions/analyse : ${p.avgSuggestions}

━━━ CRM Patient ━━━
• Taux de fidélité : ${p.recurringRate}% (${p.recurringPatients} récurrents)
• Contre-indications : ${p.contraIndicationRate}% (${p.patientsWithContraIndications} patients)
• Fréquence visite moy. : ${p.avgVisitFrequencyDays > 0 ? `${p.avgVisitFrequencyDays} jours` : "—"}

━━━ Rappels SMS ━━━
• Programmés : ${p.scheduledReminders}
• Envoyés : ${p.sentReminders}
${p.lastAnalysis ? `\nDernière analyse : ${new Date(p.lastAnalysis).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}

— Généré par Asclion`;
  };

  const handleCopyReport = (p: PharmacyCRMStats) => {
    const report = generatePharmacyReport(p);
    navigator.clipboard.writeText(report);
    setCopiedId(p.pharmacyId);
    toast.success(`Rapport ${p.pharmacyName} copié !`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!globalStats) return null;

  return (
    <div className="space-y-6">
      {/* Global CRM summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          CRM / Historique patient (global)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<Users className="h-4 w-4 text-primary" />} label="Patients uniques" value={globalStats.totalPatients} />
          <StatCard icon={<Repeat className="h-4 w-4 text-primary" />} label="Fidélité" value={`${globalStats.recurringRate}%`} sub={`${globalStats.recurringPatients} récurrents`} />
          <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Contre-indications" value={`${globalStats.contraIndicationRate}%`} badge={globalStats.patientsWithContraIndications > 0 ? globalStats.patientsWithContraIndications : undefined} />
          <StatCard icon={<CalendarClock className="h-4 w-4 text-primary" />} label="Fréq. visite moy." value={globalStats.avgVisitFrequencyDays > 0 ? `${globalStats.avgVisitFrequencyDays}j` : "—"} />
          <StatCard icon={<MessageSquare className="h-4 w-4 text-primary" />} label="Rappels programmés" value={globalStats.scheduledReminders} />
          <StatCard icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />} label="Rappels envoyés" value={globalStats.sentReminders} />
        </div>
      </div>

      {/* Per-pharmacy CRM */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          CRM par pharmacie
        </h3>
        {pharmacyStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
        ) : (
          pharmacyStats.map(p => {
            const isExpanded = expandedPharmacy === p.pharmacyId;
            return (
              <Card key={p.pharmacyId} className="border-border overflow-hidden">
                <CardHeader
                  className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedPharmacy(isExpanded ? null : p.pharmacyId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-sm font-semibold">{p.pharmacyName}</CardTitle>
                        {p.city && <p className="text-xs text-muted-foreground">{p.city}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{p.totalAnalyses} analyses</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.totalPatients} patients</Badge>
                        {p.majorInteractions > 0 && (
                          <Badge variant="destructive" className="text-[10px]">{p.majorInteractions} CI</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyReport(p);
                        }}
                      >
                        {copiedId === p.pharmacyId ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copiedId === p.pharmacyId ? "Copié" : "Copier rapport"}
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 space-y-4">
                    {/* Activity KPIs */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      <MiniStat label="Analyses" value={p.totalAnalyses} />
                      <MiniStat label="Interactions" value={p.totalInteractions} />
                      <MiniStat label="Majeures" value={p.majorInteractions} destructive={p.majorInteractions > 0} />
                      <MiniStat label="Moy. sugg." value={p.avgSuggestions} />
                      <MiniStat label="Dernière" value={p.lastAnalysis ? new Date(p.lastAnalysis).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"} />
                    </div>

                    {/* CRM KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <MiniStat label="Patients" value={p.totalPatients} />
                      <MiniStat label="Fidélité" value={`${p.recurringRate}%`} sub={`${p.recurringPatients} réc.`} />
                      <MiniStat label="Contre-ind." value={`${p.contraIndicationRate}%`} destructive={p.contraIndicationRate > 20} />
                      <MiniStat label="Fréq. visite" value={p.avgVisitFrequencyDays > 0 ? `${p.avgVisitFrequencyDays}j` : "—"} />
                    </div>

                    {/* Reminders */}
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="Rappels programmés" value={p.scheduledReminders} />
                      <MiniStat label="Rappels envoyés" value={p.sentReminders} />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, sub, badge }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  badge?: number;
}) => (
  <Card className="border-border">
    <CardContent className="pt-4 pb-3 px-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {badge !== undefined && (
          <Badge variant="destructive" className="text-[10px]">{badge}</Badge>
        )}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </CardContent>
  </Card>
);

const MiniStat = ({ label, value, sub, destructive }: {
  label: string;
  value: string | number;
  sub?: string;
  destructive?: boolean;
}) => (
  <div className="text-center p-2 rounded-md bg-secondary">
    <p className={`text-lg font-bold ${destructive ? "text-destructive" : ""}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

export default PatientCRM;
