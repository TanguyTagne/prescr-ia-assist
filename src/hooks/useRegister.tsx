import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Register {
  id: string;
  label: string;
  active: boolean;
}

interface RegisterContextType {
  registers: Register[];
  selectedRegister: Register | null;
  setSelectedRegisterId: (id: string) => void;
  loading: boolean;
}

const RegisterContext = createContext<RegisterContextType>({
  registers: [],
  selectedRegister: null,
  setSelectedRegisterId: () => {},
  loading: true,
});

export const useRegister = () => useContext(RegisterContext);

const STORAGE_KEY = "asclion_register_id";

export const RegisterProvider = ({ children }: { children: ReactNode }) => {
  const { user, pharmacyId } = useAuth();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);
  // Avoid stale-closure on selectedId inside the load() effect
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!user) {
      setRegisters([]);
      setLoading(false);
      return;
    }
    if (!pharmacyId) {
      // Auth still resolving the pharmacy_id — wait
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("pharmacy_registers")
        .select("id, label, active")
        .eq("pharmacy_id", pharmacyId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      const regs = (data || []) as Register[];
      setRegisters(regs);

      // Auto-select first if none selected or selection invalid (uses ref → never stale)
      const current = selectedIdRef.current;
      if (regs.length > 0 && (!current || !regs.some((r) => r.id === current))) {
        const first = regs[0].id;
        setSelectedId(first);
        localStorage.setItem(STORAGE_KEY, first);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, pharmacyId]);

  const setSelectedRegisterId = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedRegister = registers.find((r) => r.id === selectedId) || null;

  return (
    <RegisterContext.Provider value={{ registers, selectedRegister, setSelectedRegisterId, loading }}>
      {children}
    </RegisterContext.Provider>
  );
};
