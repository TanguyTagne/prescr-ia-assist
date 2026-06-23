import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ShortcutAction =
  | "reset"
  | "analyze"
  | "focus"
  | "modeText"
  | "modePhoto"
  | "modeQuick"
  | "help";

export type ShortcutMap = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  reset: "Escape",
  analyze: "Enter",
  focus: "Ctrl+K",
  modeText: "Ctrl+1",
  modePhoto: "Ctrl+2",
  modeQuick: "Ctrl+3",
  help: "?",
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  reset: "Réinitialiser / Nouvelle ordonnance",
  analyze: "Analyser",
  focus: "Focus saisie rapide",
  modeText: "Mode Texte",
  modePhoto: "Mode Photo",
  modeQuick: "Mode Saisie",
  help: "Ouvrir l'aide",
};

/** Build a normalized combo string from a KeyboardEvent. */
export const eventToCombo = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && e.key.length > 1) parts.push("Shift");
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
};

/** Compare an event to a stored combo. */
export const matchesCombo = (e: KeyboardEvent, combo: string): boolean => {
  return eventToCombo(e) === combo;
};

export function useShortcuts() {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setShortcuts(DEFAULT_SHORTCUTS);
      setLoaded(true);
      return;
    }
    supabase
      .from("user_shortcuts")
      .select("shortcuts")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.shortcuts && typeof data.shortcuts === "object") {
          setShortcuts({ ...DEFAULT_SHORTCUTS, ...(data.shortcuts as Partial<ShortcutMap>) });
        }
        setLoaded(true);
      });
  }, [user]);

  const save = useCallback(
    async (next: ShortcutMap) => {
      setShortcuts(next);
      if (!user) return;
      await supabase
        .from("user_shortcuts")
        .upsert({ user_id: user.id, shortcuts: next as any }, { onConflict: "user_id" });
    },
    [user],
  );

  const reset = useCallback(() => save(DEFAULT_SHORTCUTS), [save]);

  return { shortcuts, save, reset, loaded };
}
