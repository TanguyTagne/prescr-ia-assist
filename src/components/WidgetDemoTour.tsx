import { useEffect, useState } from "react";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "asclion_demo_tour_seen_v1";

const STEPS = [
  {
    title: "Bienvenue 👋",
    body: "Asclion est votre copilote au comptoir. Découvrez en 30 secondes comment il transforme chaque ordonnance en opportunité de conseil.",
    cta: "Démarrer la visite",
  },
  {
    title: "1. Choisissez une ordonnance type",
    body: "Le widget en bas à droite est l'interface réelle. Sélectionnez une ordonnance de démonstration (Médecine générale, Soins infirmiers ou Cardiologie) pour voir Asclion en action.",
    cta: "Suivant",
  },
  {
    title: "2. Lancez l'analyse IA",
    body: "Cliquez sur « Analyser cette ordonnance ». L'IA détecte les médicaments, les pathologies associées et les besoins du patient en moins de 3 secondes.",
    cta: "Suivant",
  },
  {
    title: "3. Découvrez les recommandations",
    body: "Asclion propose les produits complémentaires les plus pertinents avec une phrase conseil prête à être dite au patient. C'est cela qui augmente votre panier moyen de +6 %.",
    cta: "Terminer la visite",
  },
] as const;

interface WidgetDemoTourProps {
  enabled: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

const WidgetDemoTour = ({ enabled }: WidgetDemoTourProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [enabled]);

  // Track widget rect across resizes / content changes
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>('[data-tour-target="widget"]');
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };
    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const showSpotlight = !isFirst && rect !== null;

  // Backdrop opacity reduced for less contrast
  const backdropClass = "absolute bg-foreground/40 backdrop-blur-[2px] pointer-events-none";

  return (
    <div className="fixed inset-0 z-[10000] animate-in fade-in duration-300 pointer-events-none">
      {showSpotlight ? (
        <>
          {/* 4-piece backdrop creating an exact rectangular spotlight on the widget */}
          <div
            className={backdropClass}
            style={{ top: 0, left: 0, right: 0, height: rect!.top }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{
              top: rect!.top + rect!.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{
              top: rect!.top,
              left: 0,
              width: rect!.left,
              height: rect!.height,
            }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{
              top: rect!.top,
              left: rect!.left + rect!.width,
              right: 0,
              height: rect!.height,
            }}
            aria-hidden="true"
          />
          {/* Highlight ring around the widget (purely decorative) */}
          <div
            className="absolute pointer-events-none rounded-2xl ring-2 ring-primary/70 shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
            style={{
              top: rect!.top,
              left: rect!.left,
              width: rect!.width,
              height: rect!.height,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className={`${backdropClass} inset-0`} aria-hidden="true" />
      )}

      {/* Caption card — pointer events re-enabled here */}
      <div
        className={`absolute z-10 max-w-sm w-[calc(100vw-2rem)] sm:w-auto rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-5 pointer-events-auto animate-in slide-in-from-bottom-4 duration-300 ${
          isFirst
            ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            : "left-4 sm:left-8 top-1/2 -translate-y-1/2"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg pharmacy-gradient flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold leading-tight">{current.title}</h3>
              <button
                onClick={close}
                aria-label="Fermer la visite guidée"
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 -mr-1 -mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{current.body}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-border"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
            >
              Passer
            </button>
            <Button
              size="sm"
              onClick={next}
              className="h-8 px-3 text-xs font-semibold pharmacy-gradient border-0 gap-1.5"
            >
              {current.cta}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetDemoTour;
