import { Info } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const LegalDisclaimer = () => {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted/50">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>{t("disclaimer.text")}</span>
    </div>
  );
};

export default LegalDisclaimer;
