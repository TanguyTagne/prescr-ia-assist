import { DEMO_PRESCRIPTIONS } from "@/lib/demoPrescriptions";
import { Sparkles } from "lucide-react";

interface DemoPrescriptionCardsProps {
  onSelect: (id: string) => void;
  compact?: boolean;
}

const DemoPrescriptionCards = ({ onSelect, compact = false }: DemoPrescriptionCardsProps) => {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-foreground/70 font-medium uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5 text-primary" />
          Démo :
        </span>
        {DEMO_PRESCRIPTIONS.map((demo) => {
          const Icon = demo.icon;
          return (
            <button
              key={demo.id}
              onClick={() => onSelect(demo.id)}
              title={demo.description}
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Icon className="h-2.5 w-2.5 text-primary" />
              {demo.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[10px] text-foreground/70 font-medium uppercase tracking-wider">
          Essayer une démo
        </span>
      </div>
      <div className="grid gap-1.5">
        {DEMO_PRESCRIPTIONS.map((demo) => {
          const Icon = demo.icon;
          return (
            <button
              key={demo.id}
              onClick={() => onSelect(demo.id)}
              className="group flex items-start gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="h-7 w-7 rounded-md bg-accent group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-tight">{demo.label}</div>
                <div className="text-[10px] text-muted-foreground leading-snug mt-0.5 truncate">
                  {demo.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DemoPrescriptionCards;
