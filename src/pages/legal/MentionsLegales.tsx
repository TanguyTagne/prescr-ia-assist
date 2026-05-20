import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import Seo from "@/components/Seo";

const MentionsLegales = () => {
  const { t, lp, lang } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Seo title={t("seo.legal.mentions.title")} description={t("seo.legal.mentions.desc")} path="/mentions-legales" />
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <Link to={lp("/")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("legal.back")}
        </Link>
        <h1 className="text-3xl font-bold mb-2">{t("legal.mentions.title")}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("legal.lastUpdate")} : {new Date().toLocaleDateString(lang === "en" ? "en-US" : "fr-FR")}
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">{t("legal.mentions.editor")}</h2>
            <p>{t("legal.mentions.editorIntro")}</p>
            <ul>
              <li>{lang === "en" ? "Company name" : "Raison sociale"} : <strong>[TBD]</strong></li>
              <li>{lang === "en" ? "Legal form" : "Forme juridique"} : [TBD]</li>
              <li>{lang === "en" ? "Share capital" : "Capital social"} : [TBD]</li>
              <li>SIREN / SIRET : [TBD]</li>
              <li>{lang === "en" ? "Registered office" : "Siège social"} : [TBD]</li>
              <li>{lang === "en" ? "EU VAT number" : "Numéro de TVA intracommunautaire"} : [TBD]</li>
              <li>{lang === "en" ? "Publication director" : "Directeur de la publication"} : [TBD]</li>
              <li>{lang === "en" ? "Contact email" : "Email de contact"} : <a href="mailto:contact@asclion.com" className="text-primary underline">contact@asclion.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">{t("legal.mentions.hosting")}</h2>
            <p>{t("legal.mentions.hostingText")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">{t("legal.mentions.ip")}</h2>
            <p>{t("legal.mentions.ipText")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">{t("legal.mentions.liability")}</h2>
            <p>{t("legal.mentions.liabilityText")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">{t("legal.mentions.links")}</h2>
            <ul>
              <li><Link to={lp("/confidentialite")} className="text-primary underline">{t("footer.privacy")}</Link></li>
              <li><Link to={lp("/cookies")} className="text-primary underline">{t("footer.cookies")}</Link></li>
              <li><Link to={lp("/cgu")} className="text-primary underline">{t("footer.terms")}</Link></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MentionsLegales;
