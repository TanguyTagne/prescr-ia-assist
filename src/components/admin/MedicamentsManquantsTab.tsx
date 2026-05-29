import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PackageSearch, RefreshCw, Download, Loader2,
  ExternalLink, AlertTriangle, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEnsureTables } from "@/hooks/useEnsureTables";

// ── Types ───────────────────────────────────────────────────────────────────

type RawScanEvent = {
  ean_code: string;
  created_at: string;
  pharmacies: { name: string; city: string | null } | null;
};

type MissingMed = {
  ean: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  pharmacies: string[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
};

// Aggregate raw scan_events rows by EAN code (client-side)
function groupByEan(data: RawScanEvent[]): MissingMed[] {
  const map = new Map<
    string,
    { count: number; first: string; last: string; pharmacies: Set<string> }
  >();

  for (const e of data) {
    const existing = map.get(e.ean_code);
    const pharmaName = e.pharmacies?.name ?? null;
    if (existing) {
      existing.count++;
      if (e.created_at < existing.first) existing.first = e.created_at;
      if (e.created_at > existing.last) existing.last = e.created_at;
      if (pharmaName) existing.pharmacies.add(pharmaName);
    } else {
      const s = new Set<string>();
      if (pharmaName) s.add(pharmaName);
      map.set(e.ean_code, {
        count: 1,
        first: e.created_at,
        last: e.created_at,
        pharmacies: s,
      });
    }
  }

  return Array.from(map.entries())
    .map(([ean, v]) => ({
      ean,
      count: v.count,
      firstSeen: v.first,
      lastSeen: v.last,
      pharmacies: Array.from(v.pharmacies),
    }))
    .sort((a, b) => b.count - a.count); // les plus scannés en premier
}

// ── Component ────────────────────────────────────────────────────────────────

const MedicamentsManquantsTab = () => {
  // Crée les tables manquantes au premier chargement
  useEnsureTables();
  const [rows, setRows] = useState<MissingMed[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState<{ sans_cip_total?: number; mappes?: number; mis_a_jour?: number } | null>(null);

  const recoverCips = useCallback(async () => {
    setRecovering(true);
    setRecoverResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("recover-cip-codes");
      if (error) {
        toast.error("Erreur : " + error.message);
        return;
      }
      setRecoverResult(data);
      toast.success(`Récupération terminée : ${data?.mis_a_jour ?? 0} CIP mis à jour`);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message ?? String(e)));
    } finally {
      setRecovering(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("scan_events")
        .select("ean_code, created_at, pharmacies(name, city)")
        .eq("status", "no_match")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) {
        toast.error("Erreur de chargement : " + error.message);
        return;
      }

      setRows(groupByEan(data as RawScanEvent[]));
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalScans = useMemo(
    () => rows.reduce((s, r) => s + r.count, 0),
    [rows],
  );

  const exportCsv = () => {
    const header = "EAN;Nb scans;Premier scan;Dernier scan;Pharmacies\n";
    const body = rows
      .map(
        (r) =>
          `${r.ean};${r.count};${r.firstSeen};${r.lastSeen};"${r.pharmacies.join(", ")}"`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicaments-manquants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Médicaments manquants</h2>
          <p className="text-xs text-muted-foreground">
            Codes EAN scannés sans correspondance dans le référentiel — à ajouter en priorité
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
          <div className="text-xs text-muted-foreground">EAN uniques non reconnus</div>
          <div className="text-3xl font-bold tabular-nums text-orange-700">{rows.length}</div>
          <div className="text-xs text-muted-foreground mt-1">produits absents de la DB</div>
        </div>
        <div className="rounded-lg bg-secondary p-4">
          <div className="text-xs text-muted-foreground">Total tentatives de scan</div>
          <div className="text-3xl font-bold tabular-nums">{totalScans}</div>
          <div className="text-xs text-muted-foreground mt-1">scans sans résultat</div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageSearch className="h-5 w-5 text-primary" />
            Liste des EAN manquants
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                Mis à jour {formatDate(lastRefresh.toISOString())}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun médicament manquant</p>
              <p className="text-xs mt-1">
                Tous les EAN scannés sont référencés, ou aucun scan n'a encore eu lieu.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">EAN / CIP</th>
                      <th className="text-right px-3 py-2 font-semibold">Scans</th>
                      <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                        Premier vu
                      </th>
                      <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                        Dernier vu
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">Pharmacies</th>
                      <th className="text-left px-3 py-2 font-semibold">Fiche BDPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.ean}
                        className="border-t border-border/50 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-3 py-2 font-mono font-semibold tracking-wide">
                          {r.ean}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge
                            variant={
                              r.count >= 5
                                ? "destructive"
                                : r.count >= 2
                                ? "default"
                                : "secondary"
                            }
                            className="tabular-nums"
                          >
                            {r.count}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDate(r.firstSeen)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDate(r.lastSeen)}
                        </td>
                        <td className="px-3 py-2 max-w-[180px]">
                          {r.pharmacies.length > 0 ? (
                            <span
                              className="truncate block"
                              title={r.pharmacies.join(", ")}
                            >
                              {r.pharmacies.join(", ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={`https://base-donnees-publique.medicaments.gouv.fr/index.php?specid=${r.ean}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            BDPM
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-3 rounded-lg bg-orange-500/5 border border-orange-500/20 p-3 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
              <div className="text-muted-foreground">
                Les EAN avec le plus de scans sont à intégrer en priorité dans la table{" "}
                <code className="bg-secondary px-1 rounded font-mono">medicaments</code>.
                Cliquez sur <strong>BDPM</strong> pour consulter la fiche officielle et
                récupérer le nom commercial, la classe ATC et la molécule.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicamentsManquantsTab;
