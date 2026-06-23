/**
 * Auto-applies any missing DB tables by calling the `ensure-tables` edge function.
 * Runs once per browser session (deduped via sessionStorage).
 * Silent on success — only logs errors.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const SESSION_KEY = "asclion_ensure_tables_done";

export function useEnsureTables() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    supabase.functions
      .invoke("ensure-tables")
      .then(({ error }) => {
        if (error) {
          logger.error("[ensure-tables] failed:", error.message);
        } else {
          sessionStorage.setItem(SESSION_KEY, "1");
          logger.log("[ensure-tables] OK");
        }
      })
      .catch((e) => logger.error("[ensure-tables] exception:", e));
  }, []);
}
