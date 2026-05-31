import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAsclionDesktopRuntime } from "@/lib/runtime";
import { CURRENT_BUILD_ID, checkAppVersionAndMaybeReload } from "@/lib/versionCheck";


const HEARTBEAT_INTERVAL_MS = 60_000;
const INSTANCE_KEY = "asclion_instance_id";

function getInstanceId(): string {
  // Use localStorage so a given poste (machine + browser profile) keeps the
  // SAME instance_id across reloads, tab restarts and app restarts. Otherwise
  // every reopen creates a new heartbeat row and we end up with hundreds of
  // ghost rows per pharmacy in the admin diag view.
  try {
    let id = localStorage.getItem(INSTANCE_KEY);
    if (!id) {
      // Migrate any pre-existing sessionStorage id to keep continuity once.
      try {
        const legacy = sessionStorage.getItem(INSTANCE_KEY);
        if (legacy) id = legacy;
      } catch { /* ignore */ }
      if (!id) id = crypto.randomUUID();
      localStorage.setItem(INSTANCE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Pings the server every 60s so admins can see live connected instances per pharmacy.
 * Cleans up on unmount / tab close.
 */
export function useInstanceHeartbeat() {
  const { user } = useAuth();
  const instanceId = useRef<string>(getInstanceId());
  const pharmacyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const platform = isAsclionDesktopRuntime() ? "desktop" : "web";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null;
    const appVersion = CURRENT_BUILD_ID;


    const sendBeat = async () => {
      try {
        // Resolve pharmacy_id lazily (cached after first hit)
        if (!pharmacyIdRef.current) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("pharmacy_id")
            .eq("id", user.id)
            .maybeSingle();
          if (!profile?.pharmacy_id) return;
          pharmacyIdRef.current = profile.pharmacy_id;
        }
        if (cancelled) return;

        // Collect scanner diagnostic snapshot.
        // Toujours écrire un scanner_status, même si la capture n'est pas
        // disponible — on tag l'objet avec un champ `_meta` qui dit
        // POURQUOI il n'y a pas de données. Permet de débuguer un parc
        // entier depuis le dashboard admin.
        let scannerStatus: Record<string, unknown> = {
          _meta: "init",
          _heartbeat_version: 2,
        };
        let lastScanAt: string | null = null;
        const electronApi = (window as any).electronAPI;
        if (!electronApi) {
          scannerStatus = { _meta: "no_electron", _heartbeat_version: 2 };
        } else if (!electronApi.scanner) {
          scannerStatus = {
            _meta: "no_scanner_api",
            _heartbeat_version: 2,
            _electron_keys: Object.keys(electronApi).slice(0, 20),
          };
        } else if (typeof electronApi.scanner.status !== "function") {
          scannerStatus = {
            _meta: "no_status_function",
            _heartbeat_version: 2,
            _scanner_keys: Object.keys(electronApi.scanner).slice(0, 20),
          };
        } else {
          try {
            const s = await electronApi.scanner.status();
            if (s && typeof s === "object") {
              scannerStatus = { ...(s as Record<string, unknown>), _meta: "ok", _heartbeat_version: 2 };
              // Prefer lastGlobalScanAt (any path) — falls back to lastEnterAt (HID direct only)
              const lastScanTs = (s as any).lastGlobalScanAt || (s as any).lastEnterAt;
              if (typeof lastScanTs === "number" && lastScanTs > 0) {
                lastScanAt = new Date(lastScanTs).toISOString();
              }
            } else {
              scannerStatus = {
                _meta: "status_returned_falsy",
                _heartbeat_version: 2,
                _typeof: typeof s,
              };
            }
          } catch (err: any) {
            scannerStatus = {
              _meta: "status_call_threw",
              _heartbeat_version: 2,
              _error: String(err?.message || err).slice(0, 200),
            };
          }
        }

        // Cast as `any` because Supabase TypeGen hasn't picked up the new
        // scanner_status / last_scan_at columns yet (migration is fresh).
        await supabase.from("pharmacy_instance_heartbeats").upsert(
          {
            pharmacy_id: pharmacyIdRef.current,
            user_id: user.id,
            instance_id: instanceId.current,
            platform,
            user_agent: userAgent,
            app_version: appVersion,
            last_seen_at: new Date().toISOString(),
            scanner_status: scannerStatus,
            ...(lastScanAt ? { last_scan_at: lastScanAt } : {}),
          } as any,
          { onConflict: "pharmacy_id,user_id,instance_id" },
        );
      } catch (e) {
        // Silent: heartbeat is best-effort
        console.warn("heartbeat failed", e);
      }

      // Piggy-back the deploy version check on the heartbeat tick.
      // Fire-and-forget: never let it break the heartbeat loop.
      void checkAppVersionAndMaybeReload();
    };


    sendBeat();
    timer = setInterval(sendBeat, HEARTBEAT_INTERVAL_MS);

    const cleanup = async () => {
      if (!pharmacyIdRef.current) return;
      try {
        await supabase
          .from("pharmacy_instance_heartbeats")
          .delete()
          .eq("user_id", user.id)
          .eq("instance_id", instanceId.current);
      } catch {
        /* ignore */
      }
    };

    const onBeforeUnload = () => {
      void cleanup();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void cleanup();
    };
  }, [user]);
}
