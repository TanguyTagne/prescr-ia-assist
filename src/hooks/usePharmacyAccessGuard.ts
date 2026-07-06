import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Full-screen kill switch. Watches the caller's pharmacy status in real time
 * (realtime channel + 60s poll) and if the pharmacy is paused / disabled:
 *   - deletes the caller's own heartbeats
 *   - signs out
 *   - renders a blocking screen "Accès Asclion suspendu — contactez Asclion"
 *
 * Also treats PostgREST 403/permission errors as a suspension signal.
 */
const INSTANCE_KEY = "asclion_instance_id";

export function usePharmacyAccessGuard() {
  const { user, isAdmin } = useAuth();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) {
      setBlocked(false);
      return;
    }

    let cancelled = false;
    let statusChannel: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let pharmacyId: string | null = null;

    const triggerBlock = async () => {
      if (cancelled) return;
      setBlocked(true);
      // Best-effort cleanup — the RLS may already refuse the delete when
      // suspended; that's fine, we still sign out.
      try {
        const instanceId = localStorage.getItem(INSTANCE_KEY);
        if (instanceId) {
          await supabase
            .from("pharmacy_instance_heartbeats")
            .delete()
            .eq("user_id", user.id)
            .eq("instance_id", instanceId);
        }
      } catch { /* ignore */ }
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch { /* ignore */ }
    };

    const evalStatus = (status: string | null | undefined) => {
      if (status === "paused" || status === "disabled") {
        void triggerBlock();
      }
    };

    const bootstrap = async () => {
      // 1. Read the user's pharmacy
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .maybeSingle();

      // A 403 / permission error on our own profile => treat as suspended
      if (profErr && /permission|denied|403/i.test(profErr.message || "")) {
        void triggerBlock();
        return;
      }
      if (!profile?.pharmacy_id) return; // no pharmacy → nothing to guard

      pharmacyId = profile.pharmacy_id;

      // 2. Initial status check
      const { data: pharm } = await supabase
        .from("pharmacies")
        .select("status")
        .eq("id", pharmacyId)
        .maybeSingle();
      evalStatus(pharm?.status);

      if (cancelled) return;

      // 3. Realtime subscription on the pharmacy row
      statusChannel = supabase
        .channel(`ph-guard-${pharmacyId}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "pharmacies", filter: `id=eq.${pharmacyId}` },
          (payload) => {
            evalStatus((payload.new as any)?.status);
          },
        )
        .subscribe();

      // 4. Safety net poll
      poll = setInterval(async () => {
        const { data: p, error: e } = await supabase
          .from("pharmacies")
          .select("status")
          .eq("id", pharmacyId!)
          .maybeSingle();
        if (e && /permission|denied|403/i.test(e.message || "")) {
          void triggerBlock();
          return;
        }
        evalStatus(p?.status);
      }, 60_000);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (statusChannel) supabase.removeChannel(statusChannel);
      if (poll) clearInterval(poll);
    };
  }, [user, isAdmin]);

  return { blocked };
}
