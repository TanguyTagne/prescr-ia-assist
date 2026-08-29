import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import WidgetDemo from "@/components/WidgetDemo";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";

const SiteDemoWidget = () => {
  const [open, setOpen] = useState(() => typeof document === "undefined" || !document.getElementById("demo"));
  const [hasOpened, setHasOpened] = useState(false);
  const [demoTested, setDemoTested] = useState(() => {
    if (typeof window === "undefined") return false;
    return Number(localStorage.getItem("asclion_demo_uses") || "0") > 0;
  });
  const { t } = useI18n();

  useEffect(() => {
    const check = () => setDemoTested(Number(localStorage.getItem("asclion_demo_uses") || "0") > 0);
    const markTested = () => setDemoTested(true);
    window.addEventListener("asclion:demo-tested", markTested);
    window.addEventListener("storage", check);
    check();
    return () => {
      window.removeEventListener("asclion:demo-tested", markTested);
      window.removeEventListener("storage", check);
    };
  }, []);

  const handleToggle = () => {
    // On the landing page the in-page demo panel is the primary surface —
    // the floating launcher scrolls there instead of opening the small popup.
    const inPage = typeof document !== "undefined" && document.getElementById("demo");
    if (inPage && !open) {
      try {
        trackEvent("demo_widget_opened", { source: "launcher_scroll" });
      } catch {}
      inPage.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const next = !open;
    setOpen(next);
    if (next && !hasOpened) {
      setHasOpened(true);
      try {
        trackEvent("demo_widget_opened", { source: "launcher" });
      } catch {}
    }
  };

  return (
    <>
      {/* Launcher — pill button with label + soft pulse so it reads as "démo" and not "support chat" */}
      <button
        onClick={handleToggle}
        aria-label={open ? t("demo.closeAria") : t("demo.openAria")}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-[9999] group"
      >
        <span className="relative flex items-center">
          <span
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full pharmacy-gradient shadow-lg text-primary-foreground font-semibold hover:scale-[1.03] transition-transform",
              open ? "h-12 w-12 justify-center" : "h-12 pl-3.5 pr-4 text-sm",
              !open && !demoTested && "cta-pulse"
            )}
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span className="whitespace-nowrap">Tester le copilote</span>
              </>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div
          data-tour-target="widget"
          className="fixed bottom-[4.5rem] right-4 z-[9998] w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border bg-background shadow-2xl animate-in fade-in duration-300 overflow-hidden"
        >
          <div className="pharmacy-gradient px-3 py-1.5 flex items-center gap-2 sticky top-0 z-10">
            <span className="text-[11px] font-bold text-primary-foreground tracking-tight">Asclion</span>
            <span className="text-[10px] font-medium text-primary-foreground/80 uppercase tracking-wider">{t("demo.headerTag")}</span>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-6rem)]">
            <WidgetDemo onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default SiteDemoWidget;
