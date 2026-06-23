import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Download, ShieldCheck, Database, Search, History } from "lucide-react";
import { toast } from "sonner";

interface ClinicalSource {
  id: string;
  code: string;
  nom_complet: string;
  type_source: string;
  licence: string;
  url_officielle: string | null;
  derniere_synchro: string | null;
  version_donnees: string | null;
}

interface LineageRow {
  rule_type: string;
  rule_id: string;
  rule_label: string;
  source_code: string | null;
  source_nom: string | null;
  source_licence: string | null;
  source_derniere_synchro: string | null;
  source_reference: string | null;
  validated_by: string | null;
  validated_at: string | null;
  rule_version: number;
  created_at: string;
}

interface AuditRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  changed_by: string | null;
  source_code: string | null;
  source_reference: string | null;
  rule_version: number | null;
  created_at: string;
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
};

const toCsv = (rows: any[], headers: string[]) => {
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const head = headers.join(",");
  const body = rows
    .map((r) => headers.map((h) => escape(r[h])).join(","))
    .join("\n");
  return `${head}\n${body}`;
};

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const TracabiliteTab = () => {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<ClinicalSource[]>([]);
  const [lineage, setLineage] = useState<LineageRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, lRes, aRes] = await Promise.all([
        supabase
          .from("clinical_sources")
          .select("*")
          .order("type_source", { ascending: true })
          .order("code", { ascending: true }),
        supabase
          .from("v_clinical_lineage" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("lineage_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5000),
      ]);
      setSources((sRes.data as any[]) || []);
      setLineage((lRes.data as any[]) || []);
      setAudit((aRes.data as any[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Impossible de charger la traçabilité");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredLineage = useMemo(() => {
    if (!search) return lineage;
    const q = search.toLowerCase();
    return lineage.filter(
      (r) =>
        r.rule_label?.toLowerCase().includes(q) ||
        r.source_code?.toLowerCase().includes(q) ||
        r.source_nom?.toLowerCase().includes(q) ||
        r.source_reference?.toLowerCase().includes(q) ||
        r.rule_type?.toLowerCase().includes(q)
    );
  }, [lineage, search]);

  const stats = useMemo(() => {
    const total = lineage.length;
    const withSource = lineage.filter((l) => !!l.source_code).length;
    const validated = lineage.filter((l) => !!l.validated_at).length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      withSource,
      validated,
      withSourcePct: pct(withSource),
      validatedPct: pct(validated),
    };
  }, [lineage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              Sources officielles
            </div>
            <div className="text-2xl font-bold mt-1">{sources.length}</div>
            <div className="text-[11px] text-muted-foreground">
              référencées avec licence et synchro
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Règles avec source
            </div>
            <div className="text-2xl font-bold mt-1">
              {stats.withSource}{" "}
              <span className="text-sm text-muted-foreground font-normal">
                / {stats.total} ({stats.withSourcePct}%)
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              rattachées à une source officielle
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Règles validées
            </div>
            <div className="text-2xl font-bold mt-1">
              {stats.validated}{" "}
              <span className="text-sm text-muted-foreground font-normal">
                / {stats.total} ({stats.validatedPct}%)
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              avec date de validation pharmacien
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="lineage" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Lineage règles
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Journal d'audit
          </TabsTrigger>
        </TabsList>

        {/* SOURCES */}
        <TabsContent value="sources" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">
                Sources cliniques officielles
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  downloadCsv(
                    `asclion-sources-${new Date()
                      .toISOString()
                      .slice(0, 10)}.csv`,
                    toCsv(sources, [
                      "code",
                      "nom_complet",
                      "type_source",
                      "licence",
                      "url_officielle",
                      "version_donnees",
                      "derniere_synchro",
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Licence</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Synchro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Badge variant="outline">{s.code}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {s.url_officielle ? (
                            <a
                              href={s.url_officielle}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {s.nom_complet}
                            </a>
                          ) : (
                            s.nom_complet
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.type_source}
                        </TableCell>
                        <TableCell className="text-xs">{s.licence}</TableCell>
                        <TableCell className="text-xs">
                          {s.version_donnees || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(s.derniere_synchro)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LINEAGE */}
        <TabsContent value="lineage" className="space-y-3">
          <Card>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  Traçabilité des règles cliniques
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    downloadCsv(
                      `asclion-lineage-${new Date()
                        .toISOString()
                        .slice(0, 10)}.csv`,
                      toCsv(filteredLineage, [
                        "rule_type",
                        "rule_id",
                        "rule_label",
                        "source_code",
                        "source_nom",
                        "source_licence",
                        "source_reference",
                        "validated_at",
                        "rule_version",
                        "source_derniere_synchro",
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV ({filteredLineage.length})
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par produit, source, type de règle…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-9 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Règle</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Validée le</TableHead>
                      <TableHead className="text-right">Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLineage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                          Aucune règle trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLineage.map((l) => (
                        <TableRow key={`${l.rule_type}-${l.rule_id}`}>
                          <TableCell className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {l.rule_type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={l.rule_label}>
                            {l.rule_label || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {l.source_code ? (
                              <Badge variant="outline" title={l.source_nom || ""}>
                                {l.source_code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground italic">non renseignée</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {l.source_reference || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {l.validated_at ? (
                              formatDate(l.validated_at)
                            ) : (
                              <span className="text-muted-foreground italic">à valider</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">v{l.rule_version}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT LOG */}
        <TabsContent value="audit" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">
                Journal d'audit (200 dernières opérations)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  downloadCsv(
                    `asclion-audit-${new Date()
                      .toISOString()
                      .slice(0, 10)}.csv`,
                    toCsv(audit, [
                      "created_at",
                      "table_name",
                      "operation",
                      "record_id",
                      "changed_by",
                      "source_code",
                      "source_reference",
                      "rule_version",
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Opération</TableHead>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                          Aucune opération enregistrée pour le moment
                        </TableCell>
                      </TableRow>
                    ) : (
                      audit.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-[11px] whitespace-nowrap">
                            {new Date(a.created_at).toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-xs">{a.table_name}</TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant={
                                a.operation === "DELETE"
                                  ? "destructive"
                                  : a.operation === "INSERT"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {a.operation}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground font-mono">
                            {a.record_id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.source_code ? (
                              <Badge variant="outline">{a.source_code}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {a.rule_version != null ? `v${a.rule_version}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TracabiliteTab;
