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
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CURRENT_BUILD_ID, fetchExpectedVersion } from "@/lib/versionCheck";


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
  _meta?: string;
  _heartbeat_version?: number;
  _error?: string;
  _typeof?: string;
  _electron_keys?: string[];
  _scanner_keys?: string[];
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
  // Windows admin / High Integrity Level — true = Asclion bypass UIPI
  // → capture scan en background même quand le LGO a le focus
  elevated?: boolean | null;
  autolaunch?: {
    taskRegistered?: boolean;
    taskErrors?: string[];
    repairPrompt?: { attempted?: boolean; reason?: string; error?: string | null; method?: string | null; scriptPath?: string | null; launcherPath?: string | null; logPath?: string | null; at?: string } | null;
    activationScript?: { ok?: boolean; path?: string | null; error?: string | null } | null;
    updatedAt?: string | null;
  } | null;
  platform?: string;
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
      status: s.mode === "hid-direct" ? "active" : s.hidLoaded ? "loaded" : s.hidLoadError ? "error" : "absent",
      detail: s.hidLoadError || (s.bound ? `Bound : ${s.bound.product ?? "—"}` : null),
    },
    {
      key: "uiohook",
      label: "uiohook-napi (hook global)",
      shortLabel: "uiohook",
      status: s.uiohookStarted ? "active" : s.uiohookLoaded ? "loaded" : s.uiohookLoadError ? "error" : "absent",
      detail: s.uiohookLoadError || null,
    },
    {
      key: "serial",
      label: "SerialPort (USB-CDC)",
      shortLabel: "Serial",
      status: s.serialStarted && (s.serialOpenPorts?.length ?? 0) > 0 ? "active" : s.serialLoaded ? "loaded" : "absent",
      detail:
        s.serialLastError ||
        (s.serialOpenPorts && s.serialOpenPorts.length > 0 ? s.serialOpenPorts.map((p) => p.path).join(", ") : null),
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
  if (errors > 0)
    return { score: 0, tone: "text-rose-700", label: `0 voie active, ${errors} erreur${errors > 1 ? "s" : ""}` };
  return { score: 0, tone: "text-slate-500", label: "Aucune voie active" };
}

const RemoteScannerDiagnosticTab = () => {
  const [rows, setRows] = useState<HeartbeatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "broken" | "stale" | "desktop" | "outdated" | "notElevated">("all");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  // The "latest deployed" version is whatever /version.json currently serves.
  // We refresh it alongside the heartbeat table so admins always see truth.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const v = await fetchExpectedVersion();
      if (!cancelled) setLatestVersion(v);
    };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);


  const formatLoadError = (error: unknown): string => {
    if (!error) return "Erreur inconnue";
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (typeof error === "object") {
      const e = error as { message?: string; details?: string; hint?: string; code?: string };
      return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" · ") || JSON.stringify(error);
    }
    return String(error);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Purge stale heartbeats (>10 min sans signe de vie) AVANT de lire,
      // pour éviter d'accumuler des centaines de lignes fantômes par pharmacie.
      // Best-effort : on ignore une éventuelle erreur de delete.
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      try {
        await (supabase as any)
          .from("pharmacy_instance_heartbeats")
          .delete()
          .lt("last_seen_at", tenMinAgo);
      } catch (e) {
        console.warn("purge heartbeats failed", e);
      }

      // On ne montre que les instances "vivantes" (vues dans les 3 dernières
      // minutes) — cohérent avec get_pharmacy_connection_counts côté DB.
      const threeMinAgo = new Date(Date.now() - 3 * 60_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("pharmacy_instance_heartbeats")
        .select(
          "id, pharmacy_id, user_id, instance_id, platform, user_agent, app_version, first_seen_at, last_seen_at, last_scan_at, scanner_status",
        )
        .gte("last_seen_at", threeMinAgo)
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const heartbeatRows = (data || []) as HeartbeatRow[];
      const pharmacyIds = Array.from(new Set(heartbeatRows.map((row) => row.pharmacy_id).filter(Boolean)));
      let pharmaciesById = new Map<string, { name: string | null; city: string | null }>();

      if (pharmacyIds.length > 0) {
        const { data: pharmacies, error: pharmaciesError } = await (supabase as any)
          .from("pharmacies")
          .select("id, name, city")
          .in("id", pharmacyIds);

        if (pharmaciesError) {
          console.warn("Impossible de charger les libellés pharmacies", pharmaciesError);
        } else {
          pharmaciesById = new Map(
            (pharmacies || []).map((pharmacy: { id: string; name: string | null; city: string | null }) => [
              pharmacy.id,
              { name: pharmacy.name, city: pharmacy.city },
            ]),
          );
        }
      }

      setRows(
        heartbeatRows.map((row) => ({
          ...row,
          pharmacy: pharmaciesById.get(row.pharmacy_id) || null,
        })),
      );
    } catch (e) {
      toast.error("Erreur de chargement", { description: formatLoadError(e) });
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

  const isOutdated = (r: HeartbeatRow): boolean => {
    if (!latestVersion) return false;
    if (!r.app_version) return true;
    return r.app_version !== latestVersion;
  };

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
      if (filter === "outdated" && !isOutdated(r)) return false;
      if (filter === "notElevated") {
        // Filtre les postes desktop Windows qui ne tournent PAS en admin
        if (r.platform !== "desktop") return false;
        if (r.scanner_status?.elevated === true) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, filter, latestVersion]);

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
    const upToDate = latestVersion
      ? rows.filter((r) => r.app_version === latestVersion).length
      : 0;
    const outdated = latestVersion
      ? rows.filter((r) => !r.app_version || r.app_version !== latestVersion).length
      : 0;
    // Privilèges Windows — uniquement parmi les postes desktop
    const desktopRows = rows.filter((r) => r.platform === "desktop");
    const elevated = desktopRows.filter((r) => r.scanner_status?.elevated === true).length;
    const notElevated = desktopRows.filter((r) => r.scanner_status?.elevated === false).length;
    const elevationUnknown = desktopRows.filter(
      (r) => r.scanner_status?.elevated === undefined || r.scanner_status?.elevated === null,
    ).length;
    return { total, desktop, noActiveCapture, staleScan, upToDate, outdated, elevated, notElevated, elevationUnknown };
  }, [rows, latestVersion]);


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
          {/* Version banner */}
          <div className="rounded-lg border bg-muted/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                Version déployée
              </span>
              <code className="rounded bg-background border px-1.5 py-0.5 font-mono text-[11px]">
                {latestVersion ?? "—"}
              </code>
              <span className="text-muted-foreground">·</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cet onglet admin</span>
              <code className="rounded bg-background border px-1.5 py-0.5 font-mono text-[11px]">
                {CURRENT_BUILD_ID}
              </code>
            </div>
            {latestVersion && (
              <span className="text-[11px]">
                <span className="text-emerald-700 font-semibold">{summary.upToDate}</span>
                <span className="text-muted-foreground"> à jour · </span>
                <span className="text-amber-700 font-semibold">{summary.outdated}</span>
                <span className="text-muted-foreground"> ancienne version</span>
              </span>
            )}
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Instances connectées</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Postes desktop</p>
              <p className="text-2xl font-bold">{summary.desktop}</p>
            </div>
            <div
              className="rounded-lg border bg-card px-3 py-2"
              title="Postes desktop tournant en High Integrity Level (admin Windows). Garantit la capture des douchettes en background, même quand le LGO a le focus."
            >
              <p className="text-[10px] uppercase tracking-wide text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Admin Windows
              </p>
              <p className="text-2xl font-bold text-emerald-700">
                {summary.elevated}
                <span className="text-sm font-normal text-muted-foreground">
                  /{summary.desktop}
                </span>
              </p>
              {summary.notElevated > 0 && (
                <p className="text-[10px] text-amber-700 mt-0.5">{summary.notElevated} en mode user</p>
              )}
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">À jour</p>
              <p className="text-2xl font-bold text-emerald-700">
                {latestVersion ? summary.upToDate : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-rose-600">Aucune voie active</p>
              <p className="text-2xl font-bold text-rose-700">{summary.noActiveCapture}</p>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-amber-600">Pas de scan &gt;24h</p>
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
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
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
              variant={filter === "outdated" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("outdated")}
              disabled={!latestVersion}
              className={filter === "outdated" ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
            >
              Ancienne version
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
            <Button
              variant={filter === "notElevated" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("notElevated")}
              className={filter === "notElevated" ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
              title="Postes desktop qui ne tournent pas en admin Windows — capture scan fragile si le LGO est elevé"
            >
              <ShieldAlert className="h-3 w-3 mr-1" />
              Pas en admin
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
              filtered.map((r) => <PharmacyDiagRow key={r.id} row={r} latestVersion={latestVersion} />)
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

const PharmacyDiagRow = ({ row, latestVersion }: { row: HeartbeatRow; latestVersion: string | null }) => {
  const paths = useMemo(() => computePaths(row.scanner_status), [row.scanner_status]);
  const health = useMemo(() => healthScore(paths), [paths]);
  const isDesktop = row.platform === "desktop";
  const elevated = row.scanner_status?.elevated;
  const autolaunch = row.scanner_status?.autolaunch;

  const versionState: "up-to-date" | "outdated" | "unknown" = !latestVersion
    ? "unknown"
    : row.app_version === latestVersion
      ? "up-to-date"
      : "outdated";

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
              {row.app_version ? ` · v${row.app_version}` : " · v?"}
              {" · "}
              <Clock className="h-2.5 w-2.5 inline" /> heartbeat {relativeTime(row.last_seen_at)}
              {" · "}
              dernier scan {relativeTime(row.last_scan_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isDesktop && elevated === true && (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1"
              title="Asclion tourne en High Integrity Level (admin Windows) — capture scan garantie en background même si le LGO a le focus."
            >
              <ShieldCheck className="h-2.5 w-2.5" /> admin
            </Badge>
          )}
          {isDesktop && elevated === false && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
              title="Asclion tourne en Medium Integrity Level (user). La nouvelle version déclenche une réparation UAC puis relance Asclion via la tâche planifiée admin."
            >
              <ShieldAlert className="h-2.5 w-2.5" /> user
            </Badge>
          )}
          {isDesktop && (elevated === null || elevated === undefined) && (
            <Badge
              variant="outline"
              className="bg-slate-50 text-slate-600 border-slate-300 text-[10px]"
              title="Niveau de privilège pas encore détecté — heartbeat antérieur à la version qui expose le flag elevated."
            >
              priv ?
            </Badge>
          )}
          {versionState === "up-to-date" && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
              à jour
            </Badge>
          )}
          {versionState === "outdated" && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
              title={`Cette instance tourne sur ${row.app_version ?? "?"} alors que la dernière version déployée est ${latestVersion}`}
            >
              ancienne version
            </Badge>
          )}
          <Badge variant="outline" className={`${health.tone} border-current/30`}>
            {health.label}
          </Badge>
        </div>
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
              <p className="text-[9px] mt-0.5 uppercase tracking-wide opacity-80">{STATUS_LABEL[p.status]}</p>
            </div>
          );
        })}
      </div>

      {/* Bannière diagnostic — cas SANS scanner_status (ancien code heartbeat) */}
      {!row.scanner_status && (
        <div className="text-[10px] bg-rose-50 border border-rose-200 text-rose-900 rounded px-2 py-1.5">
          <span className="font-semibold">Heartbeat ancien :</span> scanner_status est NULL en base. L'instance pousse
          encore l'ancienne version du code heartbeat (sans le champ scanner_status). Soit le client n'a pas rechargé
          l'app depuis le push, soit Lovable n'a pas synchronisé{" "}
          <code className="font-mono">useInstanceHeartbeat.ts</code>. Vérifie le contenu du fichier en prod côté
          Lovable.
        </div>
      )}

      {/* Bannière diagnostic — cas avec scanner_status mais _meta sans données utiles */}
      {row.scanner_status?._meta && row.scanner_status._meta !== "ok" && (
        <div className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 rounded px-2 py-1.5">
          <span className="font-semibold">Diagnostic :</span>{" "}
          {row.scanner_status._meta === "no_electron" &&
            (isDesktop
              ? "Plateforme marquée desktop mais aucun electronAPI exposé. Faux positif de isAsclionDesktopRuntime() — vérifier les heuristiques."
              : "Pas d'electronAPI (session navigateur normale). Aucune capture native possible — c'est attendu en mode web.")}
          {row.scanner_status._meta === "no_scanner_api" && (
            <>
              electronAPI présent mais sans <code className="font-mono">.scanner</code> — l'EXE installé est trop ancien
              (préload.js antérieur à la version qui expose le scanner). Mettre à jour Asclion Desktop sur ce poste.
              {row.scanner_status._electron_keys && (
                <span className="block opacity-80 mt-1">
                  Clés disponibles : <code className="font-mono">{row.scanner_status._electron_keys.join(", ")}</code>
                </span>
              )}
            </>
          )}
          {row.scanner_status._meta === "no_status_function" &&
            "scanner API présent mais sans .status() — version intermédiaire d'Asclion Desktop. Mettre à jour."}
          {row.scanner_status._meta === "status_returned_falsy" &&
            `scanner.status() a renvoyé une valeur falsy (${row.scanner_status._typeof}). Bug Electron ou IPC interrompu.`}
          {row.scanner_status._meta === "status_call_threw" && (
            <>
              scanner.status() a levé une exception : <code className="font-mono">{row.scanner_status._error}</code>
            </>
          )}
          {row.scanner_status._meta === "init" &&
            "scanner_status non rempli — bug dans le code heartbeat (à signaler)."}
        </div>
      )}

      {isDesktop && elevated === false && autolaunch && (
        <div className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 rounded px-2 py-1.5">
          <span className="font-semibold">Auto-admin :</span>{" "}
          tâche planifiée {autolaunch.taskRegistered ? "créée" : "non créée"}
          {autolaunch.repairPrompt?.attempted ? ` · activation demandée${autolaunch.repairPrompt.method ? ` (${autolaunch.repairPrompt.method})` : ""}` : ""}
          {autolaunch.repairPrompt?.error ? ` · erreur UAC : ${autolaunch.repairPrompt.error}` : ""}
          {autolaunch.activationScript?.ok && autolaunch.activationScript.path && (
            <span className="block opacity-80 mt-1">
              Script disponible : <code className="font-mono">{autolaunch.activationScript.path}</code>
            </span>
          )}
          {autolaunch.taskErrors && autolaunch.taskErrors.length > 0 && (
            <span className="block opacity-80 mt-1">{autolaunch.taskErrors.join(" · ")}</span>
          )}
        </div>
      )}

      {/* Bannière diagnostic — scanner_status présent SANS _meta (ancien code v1) */}
      {row.scanner_status && !row.scanner_status._meta && (
        <div className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 rounded px-2 py-1.5">
          <span className="font-semibold">Heartbeat v1 :</span> Données scanner présentes mais sans marqueur{" "}
          <code className="font-mono">_meta</code>. Le client tourne sur la version intermédiaire du heartbeat (avant
          ajout des marqueurs diagnostic).
          {Object.keys(row.scanner_status).length === 0
            ? " Objet vide — vraisemblablement échec silencieux de scanner.status()."
            : ` Champs détectés : ${Object.keys(row.scanner_status).slice(0, 10).join(", ")}.`}
        </div>
      )}

      {!isDesktop && (
        <p className="text-[10px] text-muted-foreground italic">
          Plateforme web — aucune capture native disponible (les 6 voies ne fonctionnent qu'en mode Asclion Desktop).
        </p>
      )}
    </div>
  );
};

export default RemoteScannerDiagnosticTab;
