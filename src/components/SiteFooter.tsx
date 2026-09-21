import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageToggle from "@/i18n/LanguageToggle";

const SiteFooter = () => {
  const { lang, t, lp } = useI18n();
  return (
    <footer className="border-t border-border py-6 px-4 bg-background">
      <div className="container max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} {t("footer.disclaimer")}</span>
        <nav className="flex items-center gap-4 flex-wrap justify-center">
          <Link to={lp("/fonctionnalites")} className="hover:text-foreground transition-colors">{lang === "en" ? "How it works" : "Fonctionnement"}</Link>
          <Link to={lp("/tarifs")} className="hover:text-foreground transition-colors">{lang === "en" ? "Pricing" : "Tarifs"}</Link>
          {lang === "fr" && <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>}
          {lang === "fr" && <Link to="/a-propos" className="hover:text-foreground transition-colors">À propos</Link>}
          <Link to={lp("/aide")} className="hover:text-foreground transition-colors">{t("footer.help")}</Link>
          <Link to={lp("/mentions-legales")} className="hover:text-foreground transition-colors">{t("footer.legal")}</Link>
          <Link to={lp("/confidentialite")} className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
          <Link to={lp("/cookies")} className="hover:text-foreground transition-colors">{t("footer.cookies")}</Link>
          <Link to={lp("/cgu")} className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
          <Link to={lp("/cgv")} className="hover:text-foreground transition-colors">{lang === "en" ? "Terms of sale" : "CGV"}</Link>
          <LanguageToggle />
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooter;
