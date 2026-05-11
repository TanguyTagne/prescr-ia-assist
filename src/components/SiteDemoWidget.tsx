import { useState } from "react";
import { X } from "lucide-react";
import WidgetDemo from "@/components/WidgetDemo";
import { useI18n } from "@/i18n/I18nProvider";

const SiteDemoWidget = () => {
  const [open, setOpen] = useState(true);
  const { t } = useI18n();

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? t("demo.closeAria") : t("demo.openAria")}
        className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full pharmacy-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="h-5 w-5 text-primary-foreground" /> : <span className="text-xs font-bold text-primary-foreground">A</span>}
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
            <WidgetDemo />
          </div>
        </div>
      )}
    </>
  );
};

export default SiteDemoWidget;
