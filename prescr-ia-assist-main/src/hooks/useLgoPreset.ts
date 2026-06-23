import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LGO_PRESETS, type LgoType, type LgoPreset } from "@/lib/lgoPresets";

interface UseLgoPresetResult {
  preset: LgoPreset;
  lgoType: LgoType;
  loading: boolean;
}

export const useLgoPreset = (): UseLgoPresetResult => {
  const { user } = useAuth();
  const [lgoType, setLgoType] = useState<LgoType>("autre");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLgo = async () => {
      if (!user) {
        setLgoType("autre");
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("pharmacy_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.pharmacy_id) {
          if (!cancelled) {
            setLgoType("autre");
            setLoading(false);
          }
          return;
        }

        const { data: config } = await supabase
          .from("pharmacy_lgo_config")
          .select("lgo_type")
          .eq("pharmacy_id", profile.pharmacy_id)
          .maybeSingle();

        if (cancelled) return;

        const raw = (config?.lgo_type || "").toLowerCase();
        const valid: LgoType[] = ["winpharma", "lgpi", "smart_rx", "leo", "pharmagest", "autre"];
        setLgoType((valid.includes(raw as LgoType) ? raw : "autre") as LgoType);
      } catch {
        if (!cancelled) setLgoType("autre");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLgo();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    preset: LGO_PRESETS[lgoType],
    lgoType,
    loading,
  };
};
