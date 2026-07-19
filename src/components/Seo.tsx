import { Helmet } from "react-helmet-async";
import { useI18n } from "@/i18n/I18nProvider";

interface SeoProps {
  title: string;
  description: string;
  /** Path WITHOUT language prefix (e.g. "/aide"). The component will prefix /en automatically. */
  path: string;
  ogType?: "website" | "article";
  /** Absolute URL to a social share image. Defaults to the sitewide og-image. */
  ogImage?: string;
  /** When true, injects <meta name="robots" content="noindex,follow" />. */
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const SITE = "https://www.asclion.com";
const DEFAULT_OG_IMAGE = "https://www.asclion.com/og-image.png";

// Organization JSON-LD is injected on every page for consistent brand data.
const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Asclion",
  url: SITE,
  logo: `${SITE}/icon-512.png`,
  email: "tanguytagne12@gmail.com",
  sameAs: ["https://www.linkedin.com/company/asclion/"],
};

const Seo = ({
  title,
  description,
  path,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  jsonLd,
}: SeoProps) => {
  const { lang, lp } = useI18n();
  const localized = lp(path);
  const url = `${SITE}${localized === "/" ? "" : localized}`;
  const locale = lang === "en" ? "en_US" : "fr_FR";
  const altFr = `${SITE}${path === "/" ? "" : path}`;
  const altEn = `${SITE}${path === "/" ? "/en" : "/en" + path}`;
  const userLd = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const lds = [ORGANIZATION_LD, ...userLd];
  return (
    <Helmet>
      <html lang={lang === "en" ? "en" : "fr"} />
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? (
        <meta name="robots" content="noindex,follow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="fr-FR" href={altFr} />
      <link rel="alternate" hrefLang="en" href={altEn} />
      <link rel="alternate" hrefLang="x-default" href={altFr} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={locale} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={ogImage} />
      {lds.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default Seo;
