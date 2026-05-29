import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Activity, Users, AlertTriangle, ScanLine, Keyboard, Camera, Globe, ShoppingCart, FileText } from "lucide-react";

interface Props {
  pharmacyId: string | null;
  pharmacyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface KPI {
  total_analyses: number;
  unique_patients: number;
  major_interactions: number;
  avg_suggestions: number;
  total_scans: number;
  total_accepted: number;
}

interface ScanRow {
  id: string;
  created_at: string;
  scan_type: string;
  source: string;
  status: string;
  device_id: string | null;
  input_data: any;
  result: any;
}

interface AcceptedRow {
  id: string;
  created_at: string;
  pc_accepte: string;
  pc_categorie: string | null;
  medicament_source: string | null;
  medicaments_analyses: string[];
  pcs_proposes: string[];
}

interface AnalysisRow {
  id: string;
  created_at: string;
  medicaments: any;
  suggestions_count: number;
  interactions_count: number;
  has_major_interaction: boolean;
}

const SOURCE_META: Record<string, { label: string; icon: any; cls: string }> = {
  barcode:  { label: "Pistolet scanner", icon: ScanLine, cls: "bg-emerald-100 text-emerald-700" },
  scanner:  { label: "Pistolet scanner", icon: ScanLine, cls: "bg-emerald-100 text-emerald-700" },
  hid:      { label: "Pistolet scanner (HID)", icon: ScanLine, cls: "bg-emerald-100 text-emerald-700" },
  manual:   { label: "Manuel", icon: Keyboard, cls: "bg-blue-100 text-blue-700" },
  keyboard: { label: "Manuel", icon: Keyboard, cls: "bg-blue-100 text-blue-700" },
  photo:    { label: "Photo", icon: Camera, cls: "bg-purple-100 text-purple-700" },
  image:    { label: "Photo", icon: Camera, cls: "bg-purple-100 text-purple-700" },
  upload:   { label: "Photo / upload", icon: Camera, cls: "bg-purple-100 text-purple-700" },
  pdf:      { label: "PDF", icon: Camera, cls: "bg-purple-100 text-purple-700" },
  api:      { label: "API", icon: Globe, cls: "bg-slate-100 text-slate-700" },
};

const sourceBadge = (src: string) => {
  const meta = SOURCE_META[src?.toLowerCase()] || { label: src || "—", icon: Globe, cls: "bg-slate-100 text-slate-700" };
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${meta.cls} border-transparent`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
};

const extractMedName = (row: ScanRow): string => {
  if (row.scan_type === "prescription") {
    const meds = row.result?.medicaments || row.input_data?.medicaments;
    if (Array.isArray(meds) && meds.length) {
      return meds.slice(0, 3).map((m: any) => m.nom || m.nom_commercial || "?").join(", ") + (meds.length > 3 ? "…" : "");
    }
    return "Ordonnance";
  }
  const name = row.result?.product_name || row.result?.nom_commercial;
  if (name) return name;
  const cips = row.input_data?.cip_codes;
  if (Array.isArray(cips) && cips.length) return `CIP ${cips.join(", ")}`;
  return "—";
};

const PharmacyDetailDialog = ({ pharmacyId, pharmacyName, open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [accepted, setAccepted] = useState<AcceptedRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);

  useEffect(() => {
    if (!open || !pharmacyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [histRes, recentHistRes, scanRes, accRes] = await Promise.all([
          supabase.from("analysis_history" as any).select("patient_hash, has_major_interaction, suggestions_count").eq("pharmacy_id", pharmacyId),
          supabase.from("analysis_history" as any).select("id, created_at, medicaments, suggestions_count, interactions_count, has_major_interaction").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(20),
          supabase.from("scan_queue" as any).select("id, created_at, scan_type, source, status, device_id, input_data, result").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(100),
          supabase.from("accepted_combinations" as any).select("id, created_at, pc_accepte, pc_categorie, medicament_source, medicaments_analyses, pcs_proposes").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(100),
        ]);
        if (cancelled) return;
        const hist = (histRes.data as any[]) || [];
        const sc = (scanRes.data as any[]) || [];
        const ac = (accRes.data as any[]) || [];
        setKpi({
          total_analyses: hist.length,
          unique_patients: new Set(hist.map((h) => h.patient_hash)).size,
          major_interactions: hist.filter((h) => h.has_major_interaction).length,
          avg_suggestions: hist.length ? Math.round((hist.reduce((s, h) => s + (h.suggestions_count || 0), 0) / hist.length) * 10) / 10 : 0,
          total_scans: sc.length,
          total_accepted: ac.length,
        });
        setScans(sc as ScanRow[]);
        setAccepted(ac as AcceptedRow[]);
        setAnalyses(((recentHistRes.data as any[]) || []) as AnalysisRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pharmacyId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{pharmacyName}</DialogTitle>
        </DialogHeader>

        {loading || !kpi ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {[
                { label: "Analyses", value: kpi.total_analyses, icon: Activity },
                { label: "Patients", value: kpi.unique_patients, icon: Users },
                { label: "Interactions maj.", value: kpi.major_interactions, icon: AlertTriangle },
                { label: "Moy. sugg.", value: kpi.avg_suggestions, icon: Activity },
                { label: "Scans", value: kpi.total_scans, icon: ScanLine },
                { label: "PC acceptés", value: kpi.total_accepted, icon: ShoppingCart },
              ].map((s) => (
                <Card key={s.label} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Analyses récentes */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                20 dernières analyses
              </h3>
              {analyses.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucune analyse</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-2 py-1.5">Date</th>
                        <th className="text-left px-2 py-1.5">Médicaments</th>
                        <th className="text-right px-2 py-1.5">Sugg.</th>
                        <th className="text-right px-2 py-1.5">Inter.</th>
                        <th className="text-right px-2 py-1.5">Majeure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.map((a) => {
                        const meds = Array.isArray(a.medicaments) ? a.medicaments : [];
                        const names = meds.map((m: any) => m.nom || m.nom_commercial || "?");
                        const display = names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4}` : "");
                        return (
                          <tr key={a.id} className="border-t hover:bg-secondary/50">
                            <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                              {new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-2 py-1.5 font-medium max-w-[420px] truncate" title={names.join(", ")}>
                              {display || "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right">{a.suggestions_count || 0}</td>
                            <td className="px-2 py-1.5 text-right">{a.interactions_count || 0}</td>
                            <td className="px-2 py-1.5 text-right">
                              {a.has_major_interaction ? <Badge variant="destructive" className="text-[10px]">⚠</Badge> : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Scans */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Derniers scans ({scans.length})</h3>
              {scans.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucun scan</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-2 py-1.5">Date</th>
                        <th className="text-left px-2 py-1.5">Type</th>
                        <th className="text-left px-2 py-1.5">Méthode</th>
                        <th className="text-left px-2 py-1.5">Produit / Médicaments</th>
                        <th className="text-left px-2 py-1.5">Statut</th>
                        <th className="text-left px-2 py-1.5">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((s) => (
                        <tr key={s.id} className="border-t hover:bg-secondary/50">
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline" className="text-[10px]">{s.scan_type}</Badge>
                          </td>
                          <td className="px-2 py-1.5">{sourceBadge(s.source)}</td>
                          <td className="px-2 py-1.5 font-medium max-w-[260px] truncate" title={extractMedName(s)}>{extractMedName(s)}</td>
                          <td className="px-2 py-1.5">
                            <Badge variant={s.status === "completed" ? "secondary" : s.status === "error" ? "destructive" : "outline"} className="text-[10px]">{s.status}</Badge>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground font-mono text-[10px]">{s.device_id || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Accepted PCs */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">PC acceptés ({accepted.length})</h3>
              {accepted.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucun PC accepté</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-2 py-1.5">Date</th>
                        <th className="text-left px-2 py-1.5">Médicament source</th>
                        <th className="text-left px-2 py-1.5">PC accepté</th>
                        <th className="text-left px-2 py-1.5">Catégorie</th>
                        <th className="text-left px-2 py-1.5">PCs proposés</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accepted.map((a) => (
                        <tr key={a.id} className="border-t hover:bg-secondary/50">
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                            {new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-2 py-1.5">{a.medicament_source || (a.medicaments_analyses || []).join(", ") || "—"}</td>
                          <td className="px-2 py-1.5 font-medium">{a.pc_accepte}</td>
                          <td className="px-2 py-1.5">{a.pc_categorie ? <Badge variant="outline" className="text-[10px]">{a.pc_categorie}</Badge> : "—"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[240px] truncate" title={(a.pcs_proposes || []).join(", ")}>
                            {(a.pcs_proposes || []).length} proposé(s)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PharmacyDetailDialog;
