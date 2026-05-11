import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./I18nProvider";

interface Props {
  variant?: "ghost" | "outline";
  className?: string;
}

const LanguageToggle = ({ variant = "ghost", className }: Props) => {
  const { lang, switchLang, t } = useI18n();
  const target = lang === "fr" ? "en" : "fr";
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => switchLang(target)}
      className={`gap-1.5 text-xs ${className ?? ""}`}
      aria-label={t("lang.switch")}
      title={t("lang.switch")}
    >
      <Globe className="h-3.5 w-3.5" />
      {target.toUpperCase()}
    </Button>
  );
};

export default LanguageToggle;
