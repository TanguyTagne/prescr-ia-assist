import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/notifyAnalysisDone";

interface SoundToggleProps {
  /** Tailwind classes for the icon button color (default: white-ish for gradient headers) */
  className?: string;
}

const SoundToggle = ({ className }: SoundToggleProps) => {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setEnabled(detail);
    };
    window.addEventListener("asclion:sound-changed", handler);
    return () => window.removeEventListener("asclion:sound-changed", handler);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? "Désactiver le son des notifications" : "Activer le son des notifications"}
      aria-label={enabled ? "Désactiver le son" : "Activer le son"}
      className={
        className ??
        "text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
      }
    >
      {enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  );
};

export default SoundToggle;
