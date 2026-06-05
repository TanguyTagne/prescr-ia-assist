import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

const AtcAuditTab = () => {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState({ total: 0, mismatches: 0 });

  const load = async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("medicament_atc_audit" as any)
      .select("*", { count: "exact" })
      .eq("mismatch", true)
      .eq("reviewed", false)
      .order("confidence", { ascending: false })
      .limit(200);
    setFindings((data as any[]) || []);
    const { count: mismatchCount } = await supabase
      .from("medicament_atc_audit" as any)
      .select("*", { count: "exact", head: true })
      .eq("mismatch", true);
    const { count: totalCount } = await supabase
      .from("medicament_atc_audit" as any)
      .select("*", { count: "exact", head: true });
    setStats({ total: totalCount || 0, mismatches: mismatchCount || 0 });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBatch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-medicament-atc", {
        body: { batch_size: 200, offset, only_missing: true },
      });
      if (error) throw error;
      toast.success(`Lot : ${data.processed} méd., ${data.mismatches} anomalies${data.stopped_early ? " (time budget)" : ""}`);
      setOffset(data.next_offset || offset + 200);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setRunning(false);
    }
  };


  const applyFix = async (f: any) => {
    if (!f.suggested_atc) return toast.error("Pas de code ATC suggéré");
    if (!confirm(`Remplacer ${f.current_atc} → ${f.suggested_atc} pour ${f.nom_commercial} ?`)) return;
    const { error } = await supabase
      .from("medicaments")
      .update({ atc_code: f.suggested_atc })
      .eq("id", f.medicament_id);
    if (error) return toast.error(error.message);
    await supabase.from("medicament_atc_audit" as any).update({ reviewed: true, reviewed_at: new Date().toISOString() }).eq("id", f.id);
    toast.success("Corrigé");
    load();
  };

  const markReviewed = async (id: string) => {
    await supabase.from("medicament_atc_audit" as any).update({ reviewed: true, reviewed_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const applyAllFixes = async () => {
    const fixable = findings.filter((f) => f.suggested_atc && f.confidence === "high");
    if (fixable.length === 0) return toast.error("Aucune correction high-confidence applicable");
    if (!confirm(`Appliquer ${fixable.length} corrections ATC (high confidence uniquement) ?`)) return;
    setLoading(true);
    let ok = 0, fail = 0;
    for (const f of fixable) {
      const { error } = await supabase
        .from("medicaments")
        .update({ atc_code: f.suggested_atc })
        .eq("id", f.medicament_id);
      if (error) { fail++; continue; }
      await supabase.from("medicament_atc_audit" as any)
        .update({ reviewed: true, reviewed_at: new Date().toISOString() })
        .eq("id", f.id);
      ok++;
    }
    toast.success(`${ok} corrigés${fail ? `, ${fail} échecs` : ""}`);
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Audit ATC ↔ Médicament</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Audités : {stats.total}</Badge>
              <Badge variant="destructive">Anomalies : {stats.mismatches}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button onClick={runBatch} disabled={running} size="sm" className="gap-1.5">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Lancer un lot (500 méd, offset {offset})
          </Button>
          <Button onClick={() => { setOffset(0); load(); }} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3 w-3" />Recommencer du début
          </Button>
          <Button onClick={load} variant="ghost" size="sm">Rafraîchir</Button>
          <Button onClick={applyAllFixes} size="sm" variant="default" className="gap-1.5 ml-auto bg-emerald-600 hover:bg-emerald-700">
            <Check className="h-3 w-3" />
            Appliquer corrections high confidence ({findings.filter((f) => f.suggested_atc && f.confidence === "high").length})
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Anomalies à valider ({findings.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Médicament</TableHead>
                <TableHead>ATC actuel</TableHead>
                <TableHead>ATC suggéré</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {findings.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nom_commercial}</TableCell>
                    <TableCell><Badge variant="destructive">{f.current_atc}</Badge><div className="text-xs text-muted-foreground">{f.current_class_name}</div></TableCell>
                    <TableCell>{f.suggested_atc ? <Badge>{f.suggested_atc}</Badge> : <span className="text-muted-foreground text-xs">—</span>}<div className="text-xs text-muted-foreground">{f.suggested_class_name}</div></TableCell>
                    <TableCell><Badge variant={f.confidence === "high" ? "default" : f.confidence === "medium" ? "secondary" : "outline"}>{f.confidence}</Badge></TableCell>
                    <TableCell className="text-xs max-w-md">{f.reasoning}</TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      {f.suggested_atc && <Button size="sm" onClick={() => applyFix(f)} className="h-7 text-xs">Appliquer</Button>}
                      <Button size="icon" variant="ghost" onClick={() => markReviewed(f.id)} className="h-7 w-7" title="Ignorer"><Check className="h-3 w-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {findings.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-4">Aucune anomalie en attente. Lance un lot pour analyser plus de médicaments.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AtcAuditTab;
