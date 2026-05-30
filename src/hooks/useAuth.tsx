import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { setCachedPharmacyId, clearAuthCache } from "@/lib/authCache";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isGroupManager: boolean;
  managedGroupementId: string | null;
  pharmacyId: string | null;
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
  pharmacyId: null,
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
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
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
    setPharmacyId(profile?.pharmacy_id ?? null);
    setCachedPharmacyId(userId, profile?.pharmacy_id ?? null);

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid deadlock inside the auth callback, then await role load
        setTimeout(async () => {
          await Promise.all([fetchRole(session.user.id), fetchPharmacyStatus(session.user.id)]);
          setLoading(false);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsGroupManager(false);
        setManagedGroupementId(null);
        setPharmacyId(null);
        setPharmacyStatus(null);
        setOnboardingCompleted(true);
        clearAuthCache();
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([fetchRole(session.user.id), fetchPharmacyStatus(session.user.id)]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
        pharmacyId,
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
