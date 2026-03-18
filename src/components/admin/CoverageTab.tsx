import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, AlertTriangle, CheckCircle2, XCircle, Search, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CoverageStats {
  total: number;
  present: number;
  missing: number;
  incomplete: number;
  coverage_rate: number;
  completeness_avg: number;
}

interface AuditEntry {
  id: string;
  status: string;
  completeness_score: number;
  has_classe: boolean;
  has_pathologie_link: boolean;
  has_protocole: boolean;
  reference: {
    atc5_code: string;
    molecule: string;
    nom_commercial_ref: string;
    classe_therapeutique: string;
    rang: number;
  };
}

const CoverageTab = () => {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "missing" | "incomplete" | "present">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { loadAuditData(); }, []);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const { data: audits } = await supabase
        .from("medication_coverage_audit")
        .select("id, status, completeness_score, has_classe, has_pathologie_link, has_protocole, reference:reference_top_300(atc5_code, molecule, nom_commercial_ref, classe_therapeutique, rang)")
        .order("reference(rang)") as any;

      if (audits && audits.length > 0) {
        setEntries(audits);
        const present = audits.filter((a: any) => a.status === "present").length;
        const missing = audits.filter((a: any) => a.status === "missing").length;
        const incomplete = audits.filter((a: any) => a.status === "incomplete").length;
        setStats({
          total: audits.length,
          present,
          missing,
          incomplete,
          coverage_rate: Math.round((present / audits.length) * 100 * 10) / 10,
          completeness_avg: Math.round(audits.reduce((s: number, a: any) => s + a.completeness_score, 0) / audits.length),
        });
      } else {
        setStats(null);
        setEntries([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string) => {
    setRunning(action);
    try {
      const labels: Record<string, string> = {
        seed: "Chargement du référentiel Top 300...",
        audit: "Audit de couverture en cours...",
        enrich: "Enrichissement automatique..."
      };
      toast.info(labels[action] || "En cours...");

      const { data, error } = await supabase.functions.invoke("audit-coverage", {
        body: { action },
      });

      if (error) throw error;
      
      if (action === "seed") toast.success(`Référentiel chargé : ${data.seeded} entrées`);
      else if (action === "audit") {
        toast.success(`Audit terminé — Couverture : ${data.stats.coverage_rate}%`);
        setStats(data.stats);
      } else if (action === "enrich") {
        toast.success(`Enrichi : ${data.enriched} médicaments — ${data.remaining} restants`);
        // If there are remaining, auto-continue
        if (data.remaining > 0) {
          toast.info(`Enrichissement en cours... ${data.remaining} restants. Relance automatique.`);
          await loadAuditData();
          // Re-run audit to refresh statuses, then continue enriching
          await supabase.functions.invoke("audit-coverage", { body: { action: "audit" } });
          await loadAuditData();
          setRunning(null);
          // Trigger next batch
          setTimeout(() => runAction("enrich"), 500);
          return;
        }
      }

      await loadAuditData();
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setRunning(null);
    }
  };

  const filteredEntries = entries.filter(e => {
    if (filter !== "all" && e.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.reference?.molecule?.toLowerCase().includes(q) ||
        e.reference?.nom_commercial_ref?.toLowerCase().includes(q) ||
        e.reference?.atc5_code?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Présent</Badge>;
      case "missing": return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Manquant</Badge>;
      case "incomplete": return <Badge className="bg-amber-500 text-white gap-1"><AlertTriangle className="h-3 w-3" />Incomplet</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => runAction("seed")} disabled={!!running} className="gap-1.5">
          {running === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          1. Charger référentiel
        </Button>
        <Button size="sm" onClick={() => runAction("audit")} disabled={!!running} className="gap-1.5">
          {running === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          2. Lancer l'audit
        </Button>
        <Button size="sm" onClick={() => runAction("enrich")} disabled={!!running} variant="secondary" className="gap-1.5">
          {running === "enrich" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          3. Enrichir automatiquement
        </Button>
        <Button size="sm" variant="ghost" onClick={loadAuditData} disabled={!!running} className="ml-auto">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">Taux de couverture</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-2xl font-bold ${stats.coverage_rate === 100 ? "text-green-600" : stats.coverage_rate >= 80 ? "text-amber-500" : "text-destructive"}`}>
                  {stats.coverage_rate}%
                </p>
                <Progress value={stats.coverage_rate} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">Présents</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                <p className="text-xs text-muted-foreground">/ {stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">Manquants</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-destructive">{stats.missing}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">Score moyen</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{stats.completeness_avg}/100</p>
              </CardContent>
            </Card>
          </div>

          {/* Alert */}
          {(stats.coverage_rate < 100 || stats.completeness_avg < 70) && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="text-sm">
                  {stats.coverage_rate < 100 && (
                    <p><strong>Couverture incomplète :</strong> {stats.missing} médicaments du Top 300 sont absents de la base PrescrIA.</p>
                  )}
                  {stats.completeness_avg < 70 && (
                    <p><strong>Complétude faible :</strong> score moyen {stats.completeness_avg}/100. Lancez l'enrichissement automatique.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!stats && entries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Aucun audit effectué. Cliquez sur <strong>"1. Charger référentiel"</strong> puis <strong>"2. Lancer l'audit"</strong>.</p>
          </CardContent>
        </Card>
      )}

      {/* Filter & search */}
      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(["all", "missing", "incomplete", "present"] as const).map(f => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs h-7">
                  {f === "all" ? "Tous" : f === "missing" ? `Manquants (${stats?.missing || 0})` : f === "incomplete" ? `Incomplets (${stats?.incomplete || 0})` : `Présents (${stats?.present || 0})`}
                </Button>
              ))}
            </div>
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 w-48 text-xs ml-auto" />
          </div>

          {/* Table */}
          <Card>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>ATC5</TableHead>
                    <TableHead>Molécule</TableHead>
                    <TableHead>Spécialité</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground">{entry.reference?.rang}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.reference?.atc5_code}</TableCell>
                      <TableCell className="text-sm font-medium">{entry.reference?.molecule}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.reference?.nom_commercial_ref}</TableCell>
                      <TableCell className="text-xs">{entry.reference?.classe_therapeutique}</TableCell>
                      <TableCell>{statusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold ${entry.completeness_score >= 70 ? "text-green-600" : entry.completeness_score >= 30 ? "text-amber-500" : "text-destructive"}`}>
                          {entry.completeness_score}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default CoverageTab;
