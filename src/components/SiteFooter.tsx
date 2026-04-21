import { Link } from "react-router-dom";

const SiteFooter = () => (
  <footer className="border-t border-border py-6 px-4 bg-background">
    <div className="container max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>© {new Date().getFullYear()} Asclion — Outil d'aide, ne remplace pas le jugement professionnel</span>
      <nav className="flex items-center gap-4 flex-wrap justify-center">
        <Link to="/mentions-legales" className="hover:text-foreground transition-colors">Mentions légales</Link>
        <Link to="/confidentialite" className="hover:text-foreground transition-colors">Confidentialité</Link>
        <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
        <Link to="/cgu" className="hover:text-foreground transition-colors">CGU</Link>
      </nav>
    </div>
  </footer>
);

export default SiteFooter;
