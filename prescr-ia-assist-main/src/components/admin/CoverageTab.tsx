import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, AlertTriangle, CheckCircle2, XCircle, Search, Zap, Database, Pill, Layers, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MedStats {
  total_rows: number;
  with_cip: number;
  without_cip: number;
  unique_nom: number;
  unique_presentations: number;
  dup_groups: number;
  dup_extra_rows: number;
  meds_with_pc: number;
  meds_without_pc: number;
  pc_coverage_rate: number;
  avg_pc_per_med: number;
  max_pc_per_med: number;
}

interface AuditStats {
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

const Stat = ({
  label, value, sub, accent = "default", icon: Icon,
}: { label: string; value: string | number; sub?: string; accent?: "default" | "success" | "warning" | "danger"; icon?: any }) => {
  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-amber-500",
    danger: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
        <p className={`text-2xl font-bold ${colors[accent]}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
};

const CoverageTab = () => {
  const [medStats, setMedStats] = useState<MedStats | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "missing" | "incomplete" | "present">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadMedStats = async () => {
    const { data, error } = await supabase.rpc("get_medicaments_coverage_stats" as any);
    if (error) { console.error(error); return; }
    setMedStats(data as unknown as MedStats);
  };

  const loadAuditData = async () => {
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
        setAuditStats({
          total: audits.length,
          present,
          missing,
          incomplete,
          coverage_rate: Math.round((present / audits.length) * 100 * 10) / 10,
          completeness_avg: Math.round(audits.reduce((s: number, a: any) => s + a.completeness_score, 0) / audits.length),
        });
      } else {
        setAuditStats(null);
        setEntries([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMedStats(), loadAuditData()]);
    setLoading(false);
  };

  const runAction = async (action: string) => {
    setRunning(action);
    try {
      const labels: Record<string, string> = {
        seed: "Chargement du référentiel Top 300...",
        audit: "Audit de couverture en cours...",
        enrich: "Enrichissement automatique...",
        "fill-products": "Remplissage produits complémentaires...",
      };
      toast.info(labels[action] || "En cours...");
      const { data, error } = await supabase.functions.invoke("audit-coverage", { body: { action } });
      if (error) throw error;

      if (action === "seed") toast.success(`Référentiel chargé : ${data.seeded} entrées`);
      else if (action === "audit") {
        toast.success(`Audit terminé — Couverture : ${data.stats.coverage_rate}%`);
        setAuditStats(data.stats);
      } else if (action === "enrich") {
        toast.success(`Enrichi : ${data.enriched} médicaments — ${data.remaining} restants`);
        if (data.remaining > 0) {
          await loadAuditData();
          await supabase.functions.invoke("audit-coverage", { body: { action: "audit" } });
          await loadAuditData();
          setRunning(null);
          setTimeout(() => runAction("enrich"), 500);
          return;
        }
      } else if (action === "fill-products") {
        toast.success(`${data.filled} pathologies enrichies — ${data.produits_created} produits créés`);
        if (data.remaining > 0) {
          setRunning(null);
          setTimeout(() => runAction("fill-products"), 500);
          return;
        }
      }
      await loadAll();
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

  const cipRate = medStats && medStats.total_rows > 0
    ? Math.round((medStats.with_cip / medStats.total_rows) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Base médicaments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" /> Base médicaments
          </h2>
          <Button size="sm" variant="ghost" onClick={loadAll} className="h-7">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {medStats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Database} label="Présentations CIP" value={medStats.total_rows.toLocaleString("fr-FR")}
                sub="1 ligne = 1 code-barres scannable" />
              <Stat icon={Pill} label="Médicaments uniques" value={medStats.unique_presentations.toLocaleString("fr-FR")}
                sub={`${medStats.unique_nom.toLocaleString("fr-FR")} noms commerciaux distincts`} />
              <Stat icon={CheckCircle2} label="Avec code CIP" value={medStats.with_cip.toLocaleString("fr-FR")}
                sub={`${cipRate}% de couverture`} accent="success" />
              <Stat icon={XCircle} label="Sans code CIP"
                value={medStats.without_cip.toLocaleString("fr-FR")}
                accent={medStats.without_cip === 0 ? "success" : "warning"}
                sub="Non scannables par douchette" />
            </div>

            {medStats.dup_extra_rows > 0 && (
              <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
                <CardContent className="py-3 px-4 flex items-start gap-3 text-sm">
                  <Copy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>
                      <strong>{medStats.dup_extra_rows.toLocaleString("fr-FR")}</strong> lignes partagent le même nom+dosage+forme qu'une autre présentation
                      ({medStats.dup_groups.toLocaleString("fr-FR")} groupes).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Comportement attendu : chaque présentation commerciale (boîte 30, 60, 90…) possède son propre CIP.
                      Les conseils sont partagés via le nom de base.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      {/* SECTION 2 — Couverture conseils (PC) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" /> Produits Conseils (PC) associés
        </h2>

        {medStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Médicaments avec PC" value={medStats.meds_with_pc.toLocaleString("fr-FR")}
              sub={`/ ${medStats.unique_nom.toLocaleString("fr-FR")} noms uniques`}
              accent="success" />
            <Stat label="Sans PC" value={medStats.meds_without_pc.toLocaleString("fr-FR")}
              accent={medStats.meds_without_pc === 0 ? "success" : "warning"} />
            <Stat label="Taux de couverture PC" value={`${medStats.pc_coverage_rate}%`}
              accent={medStats.pc_coverage_rate >= 95 ? "success" : medStats.pc_coverage_rate >= 70 ? "warning" : "danger"} />
            <Stat label="PC moyens / médicament" value={medStats.avg_pc_per_med}
              sub={`max ${medStats.max_pc_per_med}`} />
          </div>
        )}

        {medStats && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Couverture PC</span>
                <span>{medStats.pc_coverage_rate}%</span>
              </div>
              <Progress value={medStats.pc_coverage_rate} className="h-2" />
            </CardContent>
          </Card>
        )}
      </section>

      {/* SECTION 3 — Audit Top 300 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Search className="h-4 w-4" /> Audit référentiel Top 300
        </h2>

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
          <Button size="sm" onClick={() => runAction("fill-products")} disabled={!!running} variant="secondary" className="gap-1.5">
            {running === "fill-products" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            4. Remplir produits complémentaires
          </Button>
        </div>

        {auditStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Taux de couverture" value={`${auditStats.coverage_rate}%`}
              accent={auditStats.coverage_rate === 100 ? "success" : auditStats.coverage_rate >= 80 ? "warning" : "danger"} />
            <Stat label="Présents" value={auditStats.present} sub={`/ ${auditStats.total}`} accent="success" />
            <Stat label="Manquants" value={auditStats.missing} accent={auditStats.missing === 0 ? "success" : "danger"} />
            <Stat label="Score moyen" value={`${auditStats.completeness_avg}/100`} />
          </div>
        )}

        {!auditStats && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun audit effectué. Cliquez sur <strong>"1. Charger référentiel"</strong> puis <strong>"2. Lancer l'audit"</strong>.
            </CardContent>
          </Card>
        )}

        {entries.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {(["all", "missing", "incomplete", "present"] as const).map(f => (
                  <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs h-7">
                    {f === "all" ? "Tous" : f === "missing" ? `Manquants (${auditStats?.missing || 0})` : f === "incomplete" ? `Incomplets (${auditStats?.incomplete || 0})` : `Présents (${auditStats?.present || 0})`}
                  </Button>
                ))}
              </div>
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 w-48 text-xs ml-auto" />
            </div>

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
      </section>
    </div>
  );
};

export default CoverageTab;
