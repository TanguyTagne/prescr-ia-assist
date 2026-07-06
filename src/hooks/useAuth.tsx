import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isGroupManager: boolean;
  managedGroupementId: string | null;
  pharmacyStatus: string | null;
  onboardingCompleted: boolean;
  refreshOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isGroupManager: false,
  managedGroupementId: null,
  pharmacyStatus: null,
  onboardingCompleted: true,
  refreshOnboarding: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGroupManager, setIsGroupManager] = useState(false);
  const [managedGroupementId, setManagedGroupementId] = useState<string | null>(null);
  const [pharmacyStatus, setPharmacyStatus] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles ?? []).map((r) => r.role);
    setIsAdmin(roleList.includes("admin"));
    setIsGroupManager(roleList.includes("group_manager"));
  };

  const fetchPharmacyStatus = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id, onboarding_completed, managed_groupement_id")
      .eq("id", userId)
      .maybeSingle();

    setOnboardingCompleted(profile?.onboarding_completed ?? true);
    setManagedGroupementId(profile?.managed_groupement_id ?? null);

    if (profile?.pharmacy_id) {
      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("status")
        .eq("id", profile.pharmacy_id)
        .maybeSingle();
      setPharmacyStatus(pharmacy?.status || "active");
    } else {
      setPharmacyStatus(null);
    }
  };

  const refreshOnboarding = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
    setOnboardingCompleted(data?.onboarding_completed ?? true);
  };

  useEffect(() => {
    let statusChannel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const cleanupWatchers = () => {
      if (statusChannel) {
        supabase.removeChannel(statusChannel);
        statusChannel = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const watchPharmacyStatus = async (userId: string) => {
      cleanupWatchers();
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", userId)
        .maybeSingle();
      const pharmacyId = profile?.pharmacy_id;
      if (!pharmacyId) return;

      // Realtime: react instantly when admin toggles status
      statusChannel = supabase
        .channel(`pharmacy-status-${pharmacyId}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "pharmacies", filter: `id=eq.${pharmacyId}` },
          (payload) => {
            const newStatus = (payload.new as any)?.status || "active";
            setPharmacyStatus(newStatus);
            if (newStatus !== "active") {
              // Hard sign-out so token can't be reused on any tab / route
              supabase.auth.signOut({ scope: "global" }).catch(() => {});
            }
          },
        )
        .subscribe();

      // Safety net: re-check every 60s (in case realtime drops)
      pollTimer = setInterval(async () => {
        const { data: pharm } = await supabase
          .from("pharmacies")
          .select("status")
          .eq("id", pharmacyId)
          .maybeSingle();
        const s = pharm?.status || "active";
        setPharmacyStatus(s);
        if (s !== "active") {
          supabase.auth.signOut({ scope: "global" }).catch(() => {});
        }
      }, 60_000);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid deadlock inside the auth callback, then await role load
        setTimeout(async () => {
          await Promise.all([fetchRole(session.user.id), fetchPharmacyStatus(session.user.id)]);
          watchPharmacyStatus(session.user.id);
          setLoading(false);
        }, 0);
      } else {
        cleanupWatchers();
        setIsAdmin(false);
        setIsGroupManager(false);
        setManagedGroupementId(null);
        setPharmacyStatus(null);
        setOnboardingCompleted(true);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([fetchRole(session.user.id), fetchPharmacyStatus(session.user.id)]);
        watchPharmacyStatus(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      cleanupWatchers();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        isGroupManager,
        managedGroupementId,
        pharmacyStatus,
        onboardingCompleted,
        refreshOnboarding,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
