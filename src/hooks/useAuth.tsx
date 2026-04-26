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
  const [pharmacyStatus, setPharmacyStatus] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const fetchPharmacyStatus = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();

    setOnboardingCompleted((profile as any)?.onboarding_completed ?? true);

    if (profile?.pharmacy_id) {
      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("status")
        .eq("id", profile.pharmacy_id)
        .maybeSingle();
      setPharmacyStatus((pharmacy as any)?.status || "active");
    } else {
      setPharmacyStatus(null);
    }
  };

  const refreshOnboarding = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    setOnboardingCompleted((data as any)?.onboarding_completed ?? true);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        fetchPharmacyStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setPharmacyStatus(null);
        setOnboardingCompleted(true);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        fetchPharmacyStatus(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, pharmacyStatus, onboardingCompleted, refreshOnboarding, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
