import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Radio, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Detection = WwksDetectResult | null;

const METHOD_LABEL: Record<string, string> = {
  ip: "adresse IP locale",
  config: "fichier de configuration Léo",
  log: "log KeepAliveRequest",
};

/**
 * Settings panel for WWKS2 multi-till routing.
 *
 * - "Détecter ma caisse" one-clic wizard (IP / Leo cfg / log).
 * - Manual override.
 * - "Utiliser ce PC comme Asclion principal" toggle (turns on the log watcher
 *   on leo00 so robot dispenses are routed to the right tills).
 * - "Tester" listens 60s on scan_queue and shows incoming wwks2_source_id.
 */
export default function WwksSourceWizard() {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  const [loaded, setLoaded] = useState(false);
  const [savedSourceId, setSavedSourceId] = useState<number | null>(null);
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [detection, setDetection] = useState<Detection>(null);
  const [detecting, setDetecting] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEvents, setTestEvents] = useState<Array<{ id: string; ean: string | null; sourceId: number | null; match: boolean }>>([]);

  const reloadConfig = useCallback(async () => {
    if (!api?.config?.get) { setLoaded(true); return; }
    const cfg = await api.config.get();
    setSavedSourceId(typeof cfg?.wwks2SourceId === "number" ? cfg.wwks2SourceId : null);
    setIsPrincipal(cfg?.isAsclionPrincipal === true);
    setManualValue(
      typeof cfg?.wwks2SourceId === "number" ? String(cfg.wwks2SourceId) : ""
    );
    setLoaded(true);
  }, [api]);

  useEffect(() => { void reloadConfig(); }, [reloadConfig]);

  const runDetect = async () => {
    if (!api?.leo?.detectSource) {
      toast.error("Détection indisponible (mode web)");
      return;
    }
    setDetecting(true);
    try {
      const r = await api.leo.detectSource();
      setDetection(r);
      if (r.sourceId != null && !manualValue) setManualValue(String(r.sourceId));
    } catch (e: any) {
      toast.error("Échec détection", { description: e?.message });
    } finally {
      setDetecting(false);
    }
  };

  const save = async () => {
    if (!api?.config?.set) return;
    const n = Number(manualValue);
    if (!Number.isFinite(n) || n < 0 || n > 255) {
      toast.error("Identifiant invalide", { description: "Entrez un entier entre 0 et 255." });
      return;
    }
    setSaving(true);
    try {
      const r = await api.config.set({ wwks2SourceId: n });
      if (r?.ok) {
        toast.success("✅ Caisse enregistrée", {
          description: `Cette caisse recevra uniquement les suggestions pour ses propres délivrances robot (source ${n}).`,
        });
        await reloadConfig();
      } else {
        toast.error("Échec enregistrement", { description: r?.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const togglePrincipal = async (v: boolean) => {
    if (!api?.config?.set) return;
    setIsPrincipal(v);
    const r = await api.config.set({ isAsclionPrincipal: v });
    if (r?.ok) {
      toast.success(
        v
          ? "Ce PC est désormais Asclion principal (watcher Léo activé)"
          : "Mode Asclion principal désactivé",
      );
    } else {
      setIsPrincipal(!v);
      toast.error("Échec", { description: r?.error });
    }
  };

  // Listen 60s to scan_queue and show wwks2_source_id matches.
  const runTest = async () => {
    if (testing) return;
    setTestEvents([]);
    setTesting(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) { toast.error("Non authentifié"); setTesting(false); return; }
    const { data: prof } = await supabase
      .from("profiles").select("pharmacy_id").eq("id", userId).maybeSingle();
    const pharmacyId = prof?.pharmacy_id;
    if (!pharmacyId) { toast.error("Pharmacie inconnue"); setTesting(false); return; }

    const channel = supabase
      .channel(`scan_queue_${pharmacyId}_test_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_queue", filter: `pharmacy_id=eq.${pharmacyId}` },
        (payload) => {
          const s: any = payload.new;
          const sourceId = typeof s?.wwks2_source_id === "number" ? s.wwks2_source_id : null;
          const match = savedSourceId == null || sourceId == null || sourceId === savedSourceId;
          setTestEvents((prev) => [
            { id: s.id, ean: s.ean_code ?? s.input_data?.cip ?? null, sourceId, match },
            ...prev,
          ].slice(0, 20));
        },
      )
      .subscribe();

    setTimeout(() => {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
      setTesting(false);
    }, 60_000);
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
      </div>
    );
  }

  if (!api?.config) {
    return (
      <p className="text-xs text-muted-foreground">
        Configuration WWKS2 disponible uniquement dans l'application desktop.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* État actuel */}
      <div className="text-xs">
        {savedSourceId != null ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Caisse enregistrée : <strong>source {savedSourceId}</strong>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Aucune caisse configurée (cette PC reçoit tous les événements).
          </span>
        )}
      </div>

      {/* Détection 1-clic */}
      <Button
        variant="outline"
        size="sm"
        onClick={runDetect}
        disabled={detecting}
        className="w-full gap-2"
      >
        {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Détecter ma caisse
      </Button>

      {detection && (
        <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
          {detection.sourceId != null ? (
            <>
              <div>
                Identifiant détecté : <strong>{detection.sourceId}</strong>{" "}
                <span className="text-muted-foreground">
                  ({METHOD_LABEL[detection.method ?? ""] ?? "—"}, confiance {detection.confidence})
                </span>
              </div>
              {detection.candidates.ip && (
                <div className="text-muted-foreground">
                  IP locale : {detection.candidates.ip.ip} → {detection.candidates.ip.sourceId}
                </div>
              )}
              {detection.candidates.config && (
                <div className="text-muted-foreground">
                  Config Léo : {detection.candidates.config.sourceId}
                </div>
              )}
              {detection.candidates.log && (
                <div className="text-muted-foreground">
                  KeepAlive log : {detection.candidates.log.sourceId}
                </div>
              )}
            </>
          ) : (
            <div className="text-amber-700">
              Aucune détection automatique. Entrez les derniers chiffres de l'IP
              de cette caisse (ex : pour <code>172.31.231.21</code>, entrez{" "}
              <strong>21</strong>).
            </div>
          )}
        </div>
      )}

      {/* Saisie + enregistrer */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Identifiant caisse (Source WWKS2)</Label>
          <Input
            type="number"
            min={0}
            max={255}
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="ex : 21"
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={save} disabled={saving || !manualValue}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>

      {/* Asclion principal */}
      <div className="flex items-center justify-between rounded border bg-muted/30 p-2">
        <div className="flex items-start gap-2">
          <Server className="h-4 w-4 mt-0.5 text-primary" />
          <div>
            <div className="text-xs font-medium">Utiliser ce PC comme Asclion principal</div>
            <div className="text-[11px] text-muted-foreground">
              Active le watcher du log Léo (leo00). À cocher uniquement sur le
              serveur Léo qui possède <code>LeoAutomateCommunicationLog.txt</code>.
            </div>
          </div>
        </div>
        <Switch checked={isPrincipal} onCheckedChange={togglePrincipal} />
      </div>

      {/* Test */}
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" /> Tester la réception (60 s)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <Button variant="outline" size="sm" onClick={runTest} disabled={testing} className="w-full">
            {testing ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Écoute en cours…</> : "Démarrer le test"}
          </Button>
          {testEvents.length > 0 && (
            <ul className="text-[11px] space-y-1 max-h-32 overflow-auto">
              {testEvents.map((e) => (
                <li
                  key={e.id}
                  className={
                    e.match
                      ? "text-emerald-700"
                      : "text-muted-foreground line-through"
                  }
                >
                  CIP {e.ean ?? "—"} • source {e.sourceId ?? "null (broadcast)"} {e.match ? "✓" : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
