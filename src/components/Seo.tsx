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
  /**
   * Content exists only in French (e.g. blog articles). Canonical always points
   * to the FR URL, the /en alternate is dropped, and the /en variant is noindexed
   * so Google never indexes French content under an English path.
   */
  frenchOnly?: boolean;
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

/** Breadcrumb derived from the (language-neutral) path segments. */
function buildBreadcrumb(path: string, title: string, lang: "fr" | "en") {
  const prefix = lang === "en" ? "/en" : "";
  const segments = path.split("/").filter(Boolean);
  const items: Record<string, unknown>[] = [
    { "@type": "ListItem", position: 1, name: lang === "en" ? "Home" : "Accueil", item: `${SITE}${prefix || "/"}` },
  ];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    const last = i === segments.length - 1;
    items.push({
      "@type": "ListItem",
      position: i + 2,
      name: last ? title.split(" | ")[0] : seg.replace(/-/g, " "),
      item: `${SITE}${prefix}${acc}`,
    });
  });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

const Seo = ({
  title,
  description,
  path,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  frenchOnly = false,
  jsonLd,
}: SeoProps) => {
  const { lang, lp } = useI18n();
  const localized = lp(path);
  const altFr = `${SITE}${path === "/" ? "" : path}`;
  const altEn = `${SITE}${path === "/" ? "/en" : "/en" + path}`;
  const url = frenchOnly ? altFr : `${SITE}${localized === "/" ? "" : localized}`;
  const locale = lang === "en" && !frenchOnly ? "en_US" : "fr_FR";
  const isNoindex = noindex || (frenchOnly && lang === "en");
  const userLd = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const hasBreadcrumb = userLd.some((ld) => ld?.["@type"] === "BreadcrumbList");
  const lds = [
    ORGANIZATION_LD,
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Asclion",
      url: lang === "en" ? `${SITE}/en` : SITE,
      inLanguage: lang === "en" ? "en" : "fr-FR",
    },
    ...(hasBreadcrumb ? [] : [buildBreadcrumb(path, title, lang)]),
    ...userLd,
  ];
  return (
    <Helmet>
      <html lang={frenchOnly ? "fr" : lang === "en" ? "en" : "fr"} />
      <title>{title}</title>
      <meta name="description" content={description} />
      {isNoindex ? (
        <meta name="robots" content="noindex,follow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="fr-FR" href={altFr} />
      {!frenchOnly && <link rel="alternate" hrefLang="en" href={altEn} />}
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
