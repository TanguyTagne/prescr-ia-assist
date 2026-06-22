import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Activity, Loader2, AlertTriangle, CheckCircle2, Radio, Cable, Network, Webhook, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAll } from "@/lib/supabaseFetchAll";

/**
 * Diag Capture LGO/Robot — vue admin support.
 *
 * Agrège les 7 derniers jours de `scan_queue` par pharmacie × canal de capture
 * (`source`) pour identifier en un coup d'œil :
 *  - quel(s) canal/canaux sont actifs par pharmacie (hid, lgo_webhook:*,
 *    windivert, tcp-listen, com, …)
 *  - les pharmacies sans aucune capture récente (à appeler)
 *  - les pharmacies sur fallback fragile (tcp-listen au lieu de windivert)
 *
 * Lecture seule. Aucune action côté pharmacie depuis cette vue.
 */

type ScanRow = {
  pharmacy_id: string;
  source: string;
  created_at: string;
  status: string;
};

type Pharmacy = { id: string; name: string; city: string | null };

type ChannelKind = "hid" | "windivert" | "lgo_webhook" | "tcp-listen" | "com" | "npcap" | "other";

function classifySource(source: string): ChannelKind {
  const s = (source || "").toLowerCase();
  if (s.startsWith("lgo_webhook")) return "lgo_webhook";
  if (s.includes("windivert")) return "windivert";
  if (s.includes("npcap")) return "npcap";
  if (s.includes("tcp-listen") || s.includes("tcp_listen")) return "tcp-listen";
  if (s.startsWith("com") || s.includes("serial")) return "com";
  if (s.includes("hid") || s.includes("scanner") || s.includes("barcode")) return "hid";
  return "other";
}

const CHANNEL_META: Record<ChannelKind, { label: string; icon: any; tone: string }> = {
  hid:           { label: "HID (douchette)",  icon: ScanLine,  tone: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  windivert:     { label: "WinDivert",        icon: Radio,     tone: "bg-green-500/10 text-green-700 border-green-500/30" },
  npcap:         { label: "Npcap",            icon: Radio,     tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  "tcp-listen":  { label: "TCP-relay",        icon: Network,   tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  com:           { label: "COM/Série",        icon: Cable,     tone: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  lgo_webhook:   { label: "LGO webhook",      icon: Webhook,   tone: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30" },
  other:         { label: "Autre",            icon: Activity,  tone: "bg-secondary text-secondary-foreground border-border" },
};

type AggRow = {
  pharmacy: Pharmacy;
  total: number;
  lastAt: string | null;
  channels: Map<ChannelKind, { count: number; lastAt: string; sources: Set<string> }>;
};

export default function LgoCaptureDiagTab() {
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [pharmRes, scanRes] = await Promise.all([
        supabase.from("pharmacies").select("id, name, city").order("name"),
        fetchAll<ScanRow>(
          () =>
            supabase
              .from("scan_queue")
              .select("pharmacy_id, source, created_at, status")
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: false }),
          1000,
          100_000
        ),
      ]);
      if (pharmRes.error) throw pharmRes.error;
      setPharmacies((pharmRes.data as Pharmacy[]) || []);
      setScans(scanRes);
    } catch (e: any) {
      toast.error("Chargement diag impossible: " + (e?.message || "erreur"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows: AggRow[] = useMemo(() => {
    const byPharm = new Map<string, AggRow>();
    for (const p of pharmacies) {
      byPharm.set(p.id, { pharmacy: p, total: 0, lastAt: null, channels: new Map() });
    }
    for (const s of scans) {
      const row = byPharm.get(s.pharmacy_id);
      if (!row) continue;
      row.total++;
      if (!row.lastAt || s.created_at > row.lastAt) row.lastAt = s.created_at;
      const kind = classifySource(s.source);
      const ch = row.channels.get(kind);
      if (ch) {
        ch.count++;
        if (s.created_at > ch.lastAt) ch.lastAt = s.created_at;
        ch.sources.add(s.source);
      } else {
        row.channels.set(kind, { count: 1, lastAt: s.created_at, sources: new Set([s.source]) });
      }
    }
    const q = search.trim().toLowerCase();
    return Array.from(byPharm.values())
      .filter((r) => !q || r.pharmacy.name.toLowerCase().includes(q) || (r.pharmacy.city || "").toLowerCase().includes(q))
      .sort((a, b) => {
        // Pharmacies actives en premier, puis par dernier scan desc
        if ((b.total > 0 ? 1 : 0) !== (a.total > 0 ? 1 : 0)) return (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0);
        return (b.lastAt || "").localeCompare(a.lastAt || "");
      });
  }, [pharmacies, scans, search]);

  const summary = useMemo(() => {
    const totalPh = rows.length;
    const active = rows.filter((r) => r.total > 0).length;
    const stale = rows.filter((r) => r.total === 0).length;
    const onTcpRelay = rows.filter((r) => r.channels.has("tcp-listen") && !r.channels.has("windivert") && !r.channels.has("lgo_webhook")).length;
    return { totalPh, active, stale, onTcpRelay };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Diag capture LGO / Robot (7 derniers jours)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Voie de capture active par pharmacie, agrégée depuis <code>scan_queue.source</code>.
                Aucune action côté pharmacien — lecture seule support.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filtrer (nom, ville)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56"
              />
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Rafraîchir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Kpi label="Pharmacies" value={summary.totalPh} />
            <Kpi label="Actives (≥1 capture)" value={summary.active} tone="success" />
            <Kpi label="Sans capture 7j" value={summary.stale} tone={summary.stale ? "danger" : undefined} />
            <Kpi label="Sur relais TCP fragile" value={summary.onTcpRelay} tone={summary.onTcpRelay ? "warning" : undefined} />
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucune pharmacie trouvée.</div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <PharmacyRow key={r.pharmacy.id} row={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const toneCls =
    tone === "success" ? "border-green-500/30 bg-green-500/5" :
    tone === "warning" ? "border-amber-500/30 bg-amber-500/5" :
    tone === "danger"  ? "border-red-500/30 bg-red-500/5" :
    "border-border bg-secondary/30";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneCls}`}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PharmacyRow({ row }: { row: AggRow }) {
  const channels = Array.from(row.channels.entries()).sort((a, b) => b[1].count - a[1].count);
  const lastAt = row.lastAt ? new Date(row.lastAt) : null;
  const now = Date.now();
  const isStale = !lastAt || (now - lastAt.getTime()) > 24 * 3600 * 1000;
  const noCapture = row.total === 0;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/30 transition-colors">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{row.pharmacy.name}</span>
            {row.pharmacy.city && <span className="text-xs text-muted-foreground">· {row.pharmacy.city}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {noCapture ? (
              <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-700 border-red-500/30">
                <AlertTriangle className="h-3 w-3" /> Aucune capture 7j
              </Badge>
            ) : (
              channels.map(([kind, info]) => {
                const meta = CHANNEL_META[kind];
                const Icon = meta.icon;
                return (
                  <Badge key={kind} variant="outline" className={`gap-1 ${meta.tone}`} title={Array.from(info.sources).join(", ")}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                    <span className="ml-1 tabular-nums opacity-70">{info.count}</span>
                  </Badge>
                );
              })
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Dernier scan</div>
          <div className={`text-sm tabular-nums flex items-center gap-1 justify-end ${isStale ? "text-amber-700" : "text-foreground"}`}>
            {!isStale && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
            {lastAt ? formatRelative(lastAt) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `il y a ${day} j`;
  return d.toLocaleDateString("fr-FR");
}
