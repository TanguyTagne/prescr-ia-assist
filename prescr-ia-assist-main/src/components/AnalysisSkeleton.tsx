import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export const AnalysisSkeleton = () => {
  const { t } = useI18n();
  const STEPS = [t("skeleton.step1"), t("skeleton.step2"), t("skeleton.step3")];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 800);
    return () => clearInterval(id);
  }, [STEPS.length]);

  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-foreground/80">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        <span className="font-medium">{STEPS[step]}</span>
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-1/3" />
      </div>

      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-border p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-2.5 w-1/2" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisSkeleton;
