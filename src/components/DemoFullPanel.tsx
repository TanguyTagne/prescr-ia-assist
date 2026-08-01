import { Sparkles } from "lucide-react";
import WidgetDemo from "@/components/WidgetDemo";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * In-page, full-width version of the demo. Same logic as the floating widget,
 * larger layout — this is the single primary CTA target of the landing page.
 */
const DemoFullPanel = () => {
  const { t } = useI18n();

  return (
    <section id="demo" className="py-16 px-4 scroll-mt-16">
      <div className="container max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            {t("landing.demo.badge")}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t("landing.demo.title")}
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("landing.demo.desc")}
          </p>
        </div>

        <div className="pharmacy-gradient rounded-2xl p-[1px]">
          <div className="rounded-2xl bg-card overflow-hidden">
            <WidgetDemo size="full" />
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {t("landing.demo.footnote")}
        </p>
      </div>
    </section>
  );
};

export default DemoFullPanel;
