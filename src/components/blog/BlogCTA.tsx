import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const BlogCTA = ({ variant = "inline" }: { variant?: "inline" | "banner" }) => {
  const { lp } = useI18n();
  const isBanner = variant === "banner";
  return (
    <div className={
      isBanner
        ? "my-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/5 p-6 text-center"
        : "my-8 rounded-xl border border-border bg-muted/30 p-5"
    }>
      <p className={isBanner ? "text-base font-semibold mb-3" : "text-sm font-medium mb-2"}>
        Découvrez comment Asclion automatise le conseil associé
      </p>
      <Link
        to={lp("/fonctionnalites")}
        className="inline-flex items-center gap-1.5 text-primary font-medium text-sm hover:underline"
      >
        Voir les fonctionnalités <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
};

export default BlogCTA;
