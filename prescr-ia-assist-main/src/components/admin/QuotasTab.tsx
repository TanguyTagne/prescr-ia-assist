import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";

interface QuotaRow {
  pharmacy_id: string;
  pharmacy_name: string;
  daily_analyses_limit: number;
  monthly_ai_calls_limit: number;
  max_upload_size_mb: number;
  current_daily_analyses: number;
  current_monthly_ai_calls: number;
  over_limit_count: number;
  last_reset_daily: string;
  last_reset_monthly: string;
}

const QuotasTab = () => {
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<QuotaRow>>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: pharmacies } = await supabase.from("pharmacies").select("id, name");
    const { data: quotas } = await supabase.from("pharmacy_quotas" as any).select("*");

    const merged: QuotaRow[] = (pharmacies || []).map((p: any) => {
      const q = (quotas as any[])?.find((x) => x.pharmacy_id === p.id) || {};
      return {
        pharmacy_id: p.id,
        pharmacy_name: p.name,
        daily_analyses_limit: q.daily_analyses_limit ?? 500,
        monthly_ai_calls_limit: q.monthly_ai_calls_limit ?? 15000,
        max_upload_size_mb: q.max_upload_size_mb ?? 10,
        current_daily_analyses: q.current_daily_analyses ?? 0,
        current_monthly_ai_calls: q.current_monthly_ai_calls ?? 0,
        over_limit_count: q.over_limit_count ?? 0,
        last_reset_daily: q.last_reset_daily ?? "—",
        last_reset_monthly: q.last_reset_monthly ?? "—",
      };
    });
    setRows(merged.sort((a, b) => b.over_limit_count - a.over_limit_count));
    setLoading(false);
  };

  const handleEdit = (id: string, field: keyof QuotaRow, value: number) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (pharmacyId: string) => {
    const changes = editing[pharmacyId];
    if (!changes) return;
    const { error } = await supabase
      .from("pharmacy_quotas" as any)
      .upsert({ pharmacy_id: pharmacyId, ...changes });
    if (error) {
      toast.error("Échec de la sauvegarde");
    } else {
      toast.success("Quotas mis à jour");
      setEditing((prev) => {
        const next = { ...prev };
        delete next[pharmacyId];
        return next;
      });
      load();
    }
  };

  const handleResetCounters = async (pharmacyId: string) => {
    const { error } = await supabase
      .from("pharmacy_quotas" as any)
      .update({
        current_daily_analyses: 0,
        current_monthly_ai_calls: 0,
        over_limit_count: 0,
      })
      .eq("pharmacy_id", pharmacyId);
    if (error) toast.error("Échec");
    else {
      toast.success("Compteurs réinitialisés");
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalOverLimit = rows.reduce((s, r) => s + r.over_limit_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Quotas par pharmacie</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Limites applicatives pour protéger le budget IA et détecter les abus. Reset
          automatique quotidien (analyses) et mensuel (appels IA).
        </p>
      </div>

      {totalOverLimit > 0 && (
        <Card className="p-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm">
              {totalOverLimit} dépassement{totalOverLimit > 1 ? "s" : ""} de quota détecté{totalOverLimit > 1 ? "s" : ""} (toutes pharmacies confondues)
            </span>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const e = editing[r.pharmacy_id] || {};
          const dailyPct = Math.round((r.current_daily_analyses / r.daily_analyses_limit) * 100);
          const monthlyPct = Math.round((r.current_monthly_ai_calls / r.monthly_ai_calls_limit) * 100);
          const isModified = !!editing[r.pharmacy_id];

          return (
            <Card key={r.pharmacy_id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-medium">{r.pharmacy_name}</h3>
                  <p className="text-xs text-muted-foreground">{r.pharmacy_id.slice(0, 8)}…</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.over_limit_count > 0 && (
                    <Badge variant="destructive">{r.over_limit_count} dépassements</Badge>
                  )}
                  {isModified && (
                    <Button size="sm" onClick={() => handleSave(r.pharmacy_id)}>
                      <Save className="h-3 w-3 mr-1" />
                      Sauver
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleResetCounters(r.pharmacy_id)}>
                    Reset compteurs
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuotaField
                  label="Analyses / jour"
                  current={r.current_daily_analyses}
                  limit={e.daily_analyses_limit ?? r.daily_analyses_limit}
                  pct={dailyPct}
                  onLimitChange={(v) => handleEdit(r.pharmacy_id, "daily_analyses_limit", v)}
                />
                <QuotaField
                  label="Appels IA / mois"
                  current={r.current_monthly_ai_calls}
                  limit={e.monthly_ai_calls_limit ?? r.monthly_ai_calls_limit}
                  pct={monthlyPct}
                  onLimitChange={(v) => handleEdit(r.pharmacy_id, "monthly_ai_calls_limit", v)}
                />
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Upload max (Mo)
                  </div>
                  <Input
                    type="number"
                    value={e.max_upload_size_mb ?? r.max_upload_size_mb}
                    onChange={(ev) =>
                      handleEdit(r.pharmacy_id, "max_upload_size_mb", parseInt(ev.target.value) || 0)
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const QuotaField = ({
  label,
  current,
  limit,
  pct,
  onLimitChange,
}: {
  label: string;
  current: number;
  limit: number;
  pct: number;
  onLimitChange: (v: number) => void;
}) => {
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase mb-1">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-mono">{current}</span>
        <span className="text-xs text-muted-foreground">/</span>
        <Input
          type="number"
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value) || 0)}
          className="h-7 w-24 text-sm"
        />
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
};

export default QuotasTab;
