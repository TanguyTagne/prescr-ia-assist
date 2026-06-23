import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { translations, type Lang, type TranslationKey } from "./translations";

interface I18nContextValue {
  lang: Lang;
  t: (key: TranslationKey) => string;
  /** Prefix a path with the current language (e.g. "/aide" -> "/en/aide" if lang=en) */
  lp: (path: string) => string;
  switchLang: (target: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const detectLangFromPath = (pathname: string): Lang =>
  pathname === "/en" || pathname.startsWith("/en/") ? "en" : "fr";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const lang = detectLangFromPath(location.pathname);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TranslationKey) => {
      const entry = translations[key];
      if (!entry) {
        if (import.meta.env.DEV) console.warn("[i18n] missing key:", key);
        return key;
      }
      return entry[lang] ?? entry.fr;
    };
    const lp = (path: string) => {
      if (!path.startsWith("/")) path = "/" + path;
      if (lang === "en") {
        if (path === "/") return "/en";
        return "/en" + path;
      }
      return path;
    };
    const switchLang = (target: Lang) => {
      const current = location.pathname;
      let stripped = current;
      if (current === "/en") stripped = "/";
      else if (current.startsWith("/en/")) stripped = current.slice(3);
      const next =
        target === "en"
          ? stripped === "/"
            ? "/en"
            : "/en" + stripped
          : stripped;
      navigate(next + location.search + location.hash, { replace: false });
    };
    return { lang, t, lp, switchLang };
  }, [lang, location.pathname, location.search, location.hash, navigate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
