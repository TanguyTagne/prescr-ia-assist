import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

const HEARTBEAT_INTERVAL_MS = 60_000;
const INSTANCE_KEY = "asclion_instance_id";

function getInstanceId(): string {
  try {
    let id = sessionStorage.getItem(INSTANCE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(INSTANCE_KEY, id);
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
  const { user, pharmacyId } = useAuth();
  const instanceId = useRef<string>(getInstanceId());

  useEffect(() => {
    if (!user || !pharmacyId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const platform = isAsclionDesktopRuntime() ? "desktop" : "web";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null;
    const appVersion = (import.meta as any).env?.VITE_APP_VERSION || null;

    const sendBeat = async () => {
      if (cancelled) return;
      try {
        await supabase
          .from("pharmacy_instance_heartbeats")
          .upsert(
            {
              pharmacy_id: pharmacyId,
              user_id: user.id,
              instance_id: instanceId.current,
              platform,
              user_agent: userAgent,
              app_version: appVersion,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "pharmacy_id,user_id,instance_id" }
          );
      } catch (e) {
        // Silent: heartbeat is best-effort
        console.warn("heartbeat failed", e);
      }
    };

    sendBeat();
    timer = setInterval(sendBeat, HEARTBEAT_INTERVAL_MS);

    const cleanup = async () => {
      try {
        await supabase
          .from("pharmacy_instance_heartbeats")
          .delete()
          .eq("user_id", user.id)
          .eq("instance_id", instanceId.current);
      } catch { /* ignore */ }
    };

    const onBeforeUnload = () => { void cleanup(); };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void cleanup();
    };
  }, [user, pharmacyId]);
}
