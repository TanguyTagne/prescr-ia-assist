import { useState } from "react";
import { useShortcuts, DEFAULT_SHORTCUTS, SHORTCUT_LABELS, eventToCombo, type ShortcutAction, type ShortcutMap } from "@/hooks/useShortcuts";
import { Button } from "@/components/ui/button";
import { Keyboard, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ShortcutsSettings = () => {
  const { shortcuts, save, reset, loaded } = useShortcuts();
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);

  const handleCapture = (action: ShortcutAction) => {
    setCapturing(action);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Ignore pure modifier presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const combo = eventToCombo(e);
      const next: ShortcutMap = { ...shortcuts, [action]: combo };

      // Anti-conflict
      const conflict = (Object.entries(shortcuts) as [ShortcutAction, string][])
        .find(([a, c]) => a !== action && c === combo);
      if (conflict) {
        toast.error(`Conflit avec « ${SHORTCUT_LABELS[conflict[0]]} »`);
      } else {
        save(next);
        toast.success("Raccourci enregistré");
      }
      setCapturing(null);
      window.removeEventListener("keydown", handler, true);
    };
    window.addEventListener("keydown", handler, true);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Cliquez sur un raccourci pour le modifier, puis appuyez sur la combinaison souhaitée.
      </p>
      <div className="space-y-2">
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((action) => (
          <div
            key={action}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border border-border bg-secondary/40"
          >
            <span className="text-sm text-foreground">{SHORTCUT_LABELS[action]}</span>
            <Button
              variant={capturing === action ? "default" : "outline"}
              size="sm"
              onClick={() => handleCapture(action)}
              className="min-w-[110px] font-mono text-xs"
              aria-label={`Modifier le raccourci pour ${SHORTCUT_LABELS[action]}`}
            >
              {capturing === action ? "Appuyez…" : shortcuts[action]}
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          reset();
          toast.success("Raccourcis réinitialisés");
        }}
        className="gap-1.5"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Réinitialiser par défaut
      </Button>
    </div>
  );
};

export default ShortcutsSettings;
