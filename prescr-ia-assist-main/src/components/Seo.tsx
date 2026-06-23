import { Helmet } from "react-helmet-async";
import { useI18n } from "@/i18n/I18nProvider";

interface SeoProps {
  title: string;
  description: string;
  /** Path WITHOUT language prefix (e.g. "/aide"). The component will prefix /en automatically. */
  path: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const SITE = "https://www.asclion.com";

const Seo = ({ title, description, path, ogType = "website", jsonLd }: SeoProps) => {
  const { lang, lp } = useI18n();
  const localized = lp(path);
  const url = `${SITE}${localized === "/" ? "" : localized}`;
  const locale = lang === "en" ? "en_US" : "fr_FR";
  const altFr = `${SITE}${path === "/" ? "" : path}`;
  const altEn = `${SITE}${path === "/" ? "/en" : "/en" + path}`;
  const lds = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <html lang={lang === "en" ? "en" : "fr"} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="fr-FR" href={altFr} />
      <link rel="alternate" hrefLang="en" href={altEn} />
      <link rel="alternate" hrefLang="x-default" href={altFr} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={locale} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {lds.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default Seo;
