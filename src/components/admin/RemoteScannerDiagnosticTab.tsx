import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wrench,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Activity,
  Clock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Diagnostic distant — vue admin de quel chemin de capture est actif sur
 * CHAQUE PC pharmacien connecté. Les instances Electron poussent leur
 * `getScannerStatus()` toutes les 60 sec dans pharmacy_instance_heartbeats.
 *
 * Permet d'identifier d'un coup d'œil :
 *  - Les pharmacies où aucune voie ne marche → intervention nécessaire
 *  - Les pharmacies où seul le fallback PowerShell tourne → l'addon N-API
 *    n'a pas compilé sur leur poste
 *  - Les pharmacies où aucun scan n'a été détecté depuis X heures → enquêter
 */

type ScannerStatus = {
  mode?: "hid-direct" | "uiohook" | "none";
  hidLoaded?: boolean;
  hidLoadError?: string | null;
  uiohookLoaded?: boolean;
  uiohookLoadError?: string | null;
  uiohookStarted?: boolean;
  bound?: { vendorId?: number; productId?: number; product?: string | null } | null;
  lastReportAt?: number | null;
  lastEnterAt?: number | null;
  lastError?: string | null;
  rawInputStarted?: boolean;
  rawInputError?: string | null;
  nativeRawInputLoaded?: boolean;
  nativeRawInputLoadError?: string | null;
  nativeRawInputStarted?: boolean;
  serialLoaded?: boolean;
  serialStarted?: boolean;
  serialOpenPorts?: Array<{ path: string; manufacturer?: string | null; baudRate?: number }>;
  serialLastError?: string | null;
  clipboardEnabled?: boolean;
  webHidEnabled?: boolean;
};

type HeartbeatRow = {
  id: string;
  pharmacy_id: string;
  user_id: string;
  instance_id: string;
  platform: string;
  user_agent: string | null;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_scan_at: string | null;
  scanner_status: ScannerStatus | null;
  pharmacy?: { name: string | null; city: string | null } | null;
};

type PathStatus = "active" | "loaded" | "error" | "absent";

interface PathInfo {
  key: string;
  label: string;
  shortLabel: string;
  status: PathStatus;
  detail?: string | null;
}

function computePaths(s: ScannerStatus | null): PathInfo[] {
  if (!s) {
    return [
      { key: "native", label: "Raw Input N-API (natif)", shortLabel: "N-API", status: "absent" },
      { key: "rawinput", label: "Raw Input PowerShell (fallback)", shortLabel: "PowerShell", status: "absent" },
      { key: "hid", label: "node-hid (HID direct)", shortLabel: "HID", status: "absent" },
      { key: "uiohook", label: "uiohook-napi (global keyboard hook)", shortLabel: "uiohook", status: "absent" },
      { key: "serial", label: "SerialPort (USB-CDC)", shortLabel: "Serial", status: "absent" },
      { key: "webhid", label: "WebHID (navigator.hid)", shortLabel: "WebHID", status: "absent" },
    ];
  }
  return [
    {
      key: "native",
      label: "Raw Input N-API (natif, préféré)",
      shortLabel: "N-API",
      status: s.nativeRawInputStarted
        ? "active"
        : s.nativeRawInputLoaded
          ? "loaded"
          : s.nativeRawInputLoadError
            ? "error"
            : "absent",
      detail: s.nativeRawInputLoadError || null,
    },
    {
      key: "rawinput",
      label: "Raw Input PowerShell (fallback)",
      shortLabel: "PowerShell",
      status: s.rawInputStarted ? "active" : s.rawInputError ? "error" : "absent",
      detail: s.rawInputError || null,
    },
    {
      key: "hid",
      label: "node-hid (HID direct)",
      shortLabel: "HID",
      status:
        s.mode === "hid-direct"
          ? "active"
          : s.hidLoaded
            ? "loaded"
            : s.hidLoadError
              ? "error"
              : "absent",
      detail: s.hidLoadError || (s.bound ? `Bound : ${s.bound.product ?? "—"}` : null),
    },
    {
      key: "uiohook",
      label: "uiohook-napi (hook global)",
      shortLabel: "uiohook",
      status: s.uiohookStarted
        ? "active"
        : s.uiohookLoaded
          ? "loaded"
          : s.uiohookLoadError
            ? "error"
            : "absent",
      detail: s.uiohookLoadError || null,
    },
    {
      key: "serial",
      label: "SerialPort (USB-CDC)",
      shortLabel: "Serial",
      status:
        s.serialStarted && (s.serialOpenPorts?.length ?? 0) > 0
          ? "active"
          : s.serialLoaded
            ? "loaded"
            : "absent",
      detail:
        s.serialLastError ||
        (s.serialOpenPorts && s.serialOpenPorts.length > 0
          ? s.serialOpenPorts.map((p) => p.path).join(", ")
          : null),
    },
    {
      key: "webhid",
      label: "WebHID (navigator.hid)",
      shortLabel: "WebHID",
      status: s.webHidEnabled ? "loaded" : "absent",
    },
  ];
}

const STATUS_COLOR: Record<PathStatus, string> = {
  active: "bg-emerald-500 text-white border-emerald-600",
  loaded: "bg-amber-100 text-amber-800 border-amber-300",
  error: "bg-rose-500 text-white border-rose-600",
  absent: "bg-slate-200 text-slate-600 border-slate-300",
};

const STATUS_LABEL: Record<PathStatus, string> = {
  active: "ACTIF",
  loaded: "chargé",
  error: "ERREUR",
  absent: "absent",
};

const STATUS_ICON: Record<PathStatus, typeof CheckCircle2> = {
  active: CheckCircle2,
  loaded: Activity,
  error: XCircle,
  absent: AlertCircle,
};

function relativeTime(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3600_000) return `il y a ${Math.round(diff / 60_000)} min`;
  if (diff < 86400_000) return `il y a ${Math.round(diff / 3600_000)} h`;
  return `il y a ${Math.round(diff / 86400_000)} j`;
}

function healthScore(paths: PathInfo[]): { score: number; tone: string; label: string } {
  const active = paths.filter((p) => p.status === "active").length;
  const errors = paths.filter((p) => p.status === "error").length;
  if (active >= 2) return { score: active, tone: "text-emerald-700", label: `${active} voies actives` };
  if (active === 1) return { score: 1, tone: "text-amber-700", label: "1 voie active" };
  if (errors > 0) return { score: 0, tone: "text-rose-700", label: `0 voie active, ${errors} erreur${errors > 1 ? "s" : ""}` };
  return { score: 0, tone: "text-slate-500", label: "Aucune voie active" };
}

const RemoteScannerDiagnosticTab = () => {
  const [rows, setRows] = useState<HeartbeatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "broken" | "stale" | "desktop">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("pharmacy_instance_heartbeats")
        .select(
          "id, pharmacy_id, user_id, instance_id, platform, user_agent, app_version, first_seen_at, last_seen_at, last_scan_at, scanner_status, pharmacy:pharmacies(name, city)"
        )
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as HeartbeatRow[]);
    } catch (e) {
      toast.error("Erreur de chargement", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 30 sec
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Search by pharmacy name or city
      if (q) {
        const haystack = `${r.pharmacy?.name ?? ""} ${r.pharmacy?.city ?? ""} ${r.user_agent ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Filter
      if (filter === "desktop" && r.platform !== "desktop") return false;
      if (filter === "broken") {
        const paths = computePaths(r.scanner_status);
        if (paths.some((p) => p.status === "active")) return false;
      }
      if (filter === "stale") {
        if (!r.last_scan_at) return true;
        const ageHours = (Date.now() - new Date(r.last_scan_at).getTime()) / 3600_000;
        if (ageHours < 24) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const desktop = rows.filter((r) => r.platform === "desktop").length;
    const noActiveCapture = rows.filter((r) => {
      const paths = computePaths(r.scanner_status);
      return paths.every((p) => p.status !== "active");
    }).length;
    const staleScan = rows.filter((r) => {
      if (!r.last_scan_at) return true;
      return Date.now() - new Date(r.last_scan_at).getTime() > 24 * 3600_000;
    }).length;
    return { total, desktop, noActiveCapture, staleScan };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Diagnostic distant — Voies de capture par pharmacie
            </span>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Instances connectées</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Postes desktop</p>
              <p className="text-2xl font-bold">{summary.desktop}</p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-rose-600">Aucune voie active</p>
              <p className="text-2xl font-bold text-rose-700">{summary.noActiveCapture}</p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-amber-600">Pas de scan &gt;24h</p>
              <p className="text-2xl font-bold text-amber-700">{summary.staleScan}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom pharmacie, ville, UA)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Tout
            </Button>
            <Button
              variant={filter === "desktop" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("desktop")}
            >
              Desktop seulement
            </Button>
            <Button
              variant={filter === "broken" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("broken")}
              className={filter === "broken" ? "" : "border-rose-300 text-rose-700 hover:bg-rose-50"}
            >
              Aucune voie active
            </Button>
            <Button
              variant={filter === "stale" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("stale")}
              className={filter === "stale" ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
            >
              Pas de scan &gt;24h
            </Button>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {loading && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucune instance ne correspond aux filtres.
              </p>
            ) : (
              filtered.map((r) => (
                <PharmacyDiagRow key={r.id} row={r} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const PharmacyDiagRow = ({ row }: { row: HeartbeatRow }) => {
  const paths = useMemo(() => computePaths(row.scanner_status), [row.scanner_status]);
  const health = useMemo(() => healthScore(paths), [paths]);
  const isDesktop = row.platform === "desktop";

  return (
    <div className="rounded-lg border bg-card px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {row.pharmacy?.name || <span className="text-muted-foreground italic">Pharmacie sans nom</span>}
              {row.pharmacy?.city && <span className="text-muted-foreground"> · {row.pharmacy.city}</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {isDesktop ? <Activity className="h-2.5 w-2.5" /> : null}
                {row.platform}
              </span>
              {row.app_version ? ` · v${row.app_version}` : ""}
              {" · "}
              <Clock className="h-2.5 w-2.5 inline" /> heartbeat {relativeTime(row.last_seen_at)}
              {" · "}
              dernier scan {relativeTime(row.last_scan_at)}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`${health.tone} border-current/30`}>
          {health.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
        {paths.map((p) => {
          const Icon = STATUS_ICON[p.status];
          return (
            <div
              key={p.key}
              className={`rounded border px-2 py-1.5 text-[10px] ${STATUS_COLOR[p.status]}`}
              title={p.detail ? `${p.label} — ${p.detail}` : p.label}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{p.shortLabel}</span>
                <Icon className="h-3 w-3 shrink-0" />
              </div>
              <p className="text-[9px] mt-0.5 uppercase tracking-wide opacity-80">
                {STATUS_LABEL[p.status]}
              </p>
            </div>
          );
        })}
      </div>

      {!isDesktop && (
        <p className="text-[10px] text-muted-foreground italic">
          Plateforme web — aucune capture native disponible (les 6 voies ne fonctionnent qu'en mode Asclion Desktop).
        </p>
      )}
    </div>
  );
};

export default RemoteScannerDiagnosticTab;
