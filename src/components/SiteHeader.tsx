import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings, Download } from "lucide-react";
import { DOWNLOAD_URL } from "@/lib/downloadUrl";
import LanguageToggle from "@/i18n/LanguageToggle";

interface SiteHeaderProps {
  /** "full" : navigation marketing complète. "checkout" : logo + réassurance uniquement. */
  variant?: "full" | "checkout";
}

const SiteHeader = ({ variant = "full" }: SiteHeaderProps) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { lp } = useI18n();

  if (variant === "checkout") {
    return (
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={lp("/")} className="font-bold text-lg tracking-tight">
            Asclion
          </Link>
          <p className="text-xs text-muted-foreground">
            Paiement sécurisé · Activation sous 24–48 h
          </p>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to={lp("/")} className="font-bold text-lg tracking-tight shrink-0">
          Asclion
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link to={lp("/fonctionnalites")} className="text-muted-foreground hover:text-foreground transition-colors">
            Fonctionnement
          </Link>
          <Link to={lp("/") + "#preuve"} className="text-muted-foreground hover:text-foreground transition-colors">
            Résultats
          </Link>
          <Link to={lp("/tarifs")} className="text-muted-foreground hover:text-foreground transition-colors">
            Tarifs
          </Link>
          <Link to={lp("/blog")} className="text-muted-foreground hover:text-foreground transition-colors">
            Blog
          </Link>
          <Link to={lp("/aide")} className="text-muted-foreground hover:text-foreground transition-colors">
            Aide
          </Link>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle />
          {user ? (
            <>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => navigate(lp("/admin"))} className="gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" /> Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate(lp("/dashboard"))} className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Tableau de bord
              </Button>
            </>
          ) : (
            <Link
              to={lp("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Se connecter
            </Link>
          )}
          {user ? (
            <Button size="sm" asChild className="pharmacy-gradient border-0 font-semibold gap-1.5">
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" /> Télécharger
              </a>
            </Button>
          ) : (
            <Button size="sm" asChild className="pharmacy-gradient border-0 font-semibold">
              <Link to={lp("/tarifs")}>Choisir mon offre</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
