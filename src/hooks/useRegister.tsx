import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  const { user } = useAuth();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRegisters([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single();

      if (!profile?.pharmacy_id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("pharmacy_registers")
        .select("id, label, active")
        .eq("pharmacy_id", profile.pharmacy_id)
        .eq("active", true)
        .order("created_at", { ascending: true });

      const regs = (data || []) as Register[];
      setRegisters(regs);

      // Auto-select first if none selected or selection invalid
      if (regs.length > 0 && (!selectedId || !regs.find(r => r.id === selectedId))) {
        const first = regs[0].id;
        setSelectedId(first);
        localStorage.setItem(STORAGE_KEY, first);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const setSelectedRegisterId = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const selectedRegister = registers.find(r => r.id === selectedId) || null;

  return (
    <RegisterContext.Provider value={{ registers, selectedRegister, setSelectedRegisterId, loading }}>
      {children}
    </RegisterContext.Provider>
  );
};
