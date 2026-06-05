import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Play, RefreshCw, Check, Download, Search } from "lucide-react";
import { toast } from "sonner";

const AtcAuditTab = () => {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [rerunOffset, setRerunOffset] = useState(0);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState({ total: 0, mismatches: 0, highFixable: 0, uncertain: 0 });

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
    const { count: highCount } = await supabase
      .from("medicament_atc_audit" as any)
      .select("*", { count: "exact", head: true })
      .eq("mismatch", true)
      .eq("reviewed", false)
      .eq("confidence", "high")
      .not("suggested_atc", "is", null);
    const { count: uncertainCount } = await supabase
      .from("medicament_atc_audit" as any)
      .select("*", { count: "exact", head: true })
      .in("confidence", ["low", "medium"])
      .eq("reviewed", false);
    setStats({ total: totalCount || 0, mismatches: mismatchCount || 0, highFixable: highCount || 0, uncertain: uncertainCount || 0 });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBatch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-medicament-atc", {
        body: { batch_size: 100, offset, only_missing: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const processed = Number(data?.processed ?? data?.processed_count ?? 0);
      const mismatchCount = Number(data?.mismatches ?? data?.anomalies ?? 0);
      const nextOffset = Number.isFinite(Number(data?.next_offset)) ? Number(data.next_offset) : offset + 100;
      if (processed === 0) {
        toast.info(data?.done ? "Audit terminé : aucun nouveau médicament à analyser" : `Plage déjà auditée, passage à l'offset ${nextOffset}`);
      } else {
        toast.success(`Lot : ${processed} méd., ${mismatchCount} anomalies${data?.stopped_early ? " (time budget)" : ""}`);
      }
      setOffset(nextOffset);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setRunning(false);
    }
  };

  const rerunUncertain = async () => {
    setRerunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-medicament-atc", {
        body: { mode: "rerun_uncertain", batch_size: 8, offset: rerunOffset, model: "google/gemini-2.5-pro", confidences: ["low", "medium"] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const processed = Number(data?.processed ?? 0);
      const mm = Number(data?.mismatches ?? 0);
      const nextOff = Number.isFinite(Number(data?.next_offset)) ? Number(data.next_offset) : rerunOffset + 8;
      if (processed === 0) {
        toast.info("Plus de low/medium à ré-auditer");
        setRerunOffset(0);
      } else {
        toast.success(`Ré-audit Pro : ${processed} méd., ${mm} anomalies${data?.stopped_early ? " (time budget)" : ""}`);
        setRerunOffset(nextOff);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erreur ré-audit");
    } finally {
      setRerunning(false);
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
    // Fetch ALL high-confidence fixable anomalies, not just the 200 loaded in the table
    const { data: allFixable, error: fetchErr } = await supabase
      .from("medicament_atc_audit" as any)
      .select("id, medicament_id, suggested_atc, suggested_class_name, current_atc")
      .eq("mismatch", true)
      .eq("reviewed", false)
      .eq("confidence", "high")
      .not("suggested_atc", "is", null)
      .limit(10000);
    if (fetchErr) return toast.error(fetchErr.message);
    const fixable = (allFixable as any[]) || [];
    if (fixable.length === 0) return toast.error("Aucune correction high-confidence applicable");
    if (!confirm(`Appliquer ${fixable.length} corrections ATC (high confidence uniquement) ?`)) return;
    setLoading(true);

    // Pre-ensure all suggested_atc codes exist in classe_atc (FK constraint)
    const uniqueCodes = Array.from(new Set(fixable.map((f) => f.suggested_atc).filter(Boolean)));
    const { data: existing } = await supabase
      .from("classe_atc")
      .select("atc_code")
      .in("atc_code", uniqueCodes);
    const existingSet = new Set((existing || []).map((e: any) => e.atc_code));
    const missing = fixable
      .filter((f) => !existingSet.has(f.suggested_atc))
      .reduce((acc: any[], f) => {
        if (!acc.find((a) => a.atc_code === f.suggested_atc)) {
          acc.push({ atc_code: f.suggested_atc, nom_classe: f.suggested_class_name || f.suggested_atc });
        }
        return acc;
      }, []);
    if (missing.length > 0) {
      const { error: insErr } = await supabase.from("classe_atc").upsert(missing, { onConflict: "atc_code" });
      if (insErr) console.error("classe_atc upsert", insErr);
    }

    let ok = 0, fail = 0;
    const failures: string[] = [];
    // Batch in parallel waves of 20
    const WAVE = 20;
    for (let i = 0; i < fixable.length; i += WAVE) {
      const wave = fixable.slice(i, i + WAVE);
      await Promise.all(wave.map(async (f) => {
        const { error } = await supabase
          .from("medicaments")
          .update({ atc_code: f.suggested_atc })
          .eq("id", f.medicament_id);
        if (error) { fail++; failures.push(`${f.suggested_atc}: ${error.message}`); return; }
        await supabase.from("medicament_atc_audit" as any)
          .update({ reviewed: true, reviewed_at: new Date().toISOString() })
          .eq("id", f.id);
        ok++;
      }));
    }
    if (failures.length > 0) console.error("Apply failures sample:", failures.slice(0, 5));
    toast.success(`${ok} corrigés${fail ? `, ${fail} échecs` : ""}`);
    await load();
  };

  const exportCsv = async () => {
    const { data } = await supabase
      .from("medicament_atc_audit" as any)
      .select("nom_commercial,current_atc,current_class_name,suggested_atc,suggested_class_name,confidence,reasoning,reviewed,created_at")
      .eq("mismatch", true)
      .order("confidence", { ascending: false })
      .limit(10000);
    const rows = (data as any[]) || [];
    if (rows.length === 0) return toast.error("Aucune anomalie à exporter");
    const headers = ["Médicament","ATC actuel","Classe actuelle","ATC suggéré","Classe suggérée","Confiance","Raison","Révisé","Date"];
    const csv = [headers, ...rows.map(r => [r.nom_commercial,r.current_atc,r.current_class_name,r.suggested_atc,r.suggested_class_name,r.confidence,r.reasoning,r.reviewed?"oui":"non",r.created_at])]
      .map(r => r.map((c: any) => `"${String(c ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-atc-anomalies-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} anomalies exportées`);
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
            Lancer un lot (100 méd, offset {offset})
          </Button>
          <Button onClick={() => { setOffset(0); load(); }} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3 w-3" />Recommencer du début
          </Button>
          <Button onClick={load} variant="ghost" size="sm">Rafraîchir</Button>
          <Button onClick={exportCsv} variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3 w-3" />Exporter CSV
          </Button>
          <Button onClick={rerunUncertain} disabled={rerunning} size="sm" variant="secondary" className="gap-1.5" title="Ré-audite les low/medium avec Gemini 2.5 Pro">
            {rerunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Ré-auditer low/medium avec Pro ({stats.uncertain}) — offset {rerunOffset}
          </Button>
          <Button onClick={applyAllFixes} size="sm" variant="default" className="gap-1.5 ml-auto bg-emerald-600 hover:bg-emerald-700">
            <Check className="h-3 w-3" />
            Appliquer corrections high confidence ({stats.highFixable})

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
