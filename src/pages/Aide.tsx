import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const Aide = () => {
  const { t, lp } = useI18n();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={t("seo.aide.title")}
        description={t("seo.aide.desc")}
        path="/aide"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: t("aide.faq.q1"), acceptedAnswer: { "@type": "Answer", text: t("aide.faq.a1") } },
            { "@type": "Question", name: t("aide.faq.q2"), acceptedAnswer: { "@type": "Answer", text: t("aide.faq.a2") } },
            { "@type": "Question", name: t("aide.faq.q3"), acceptedAnswer: { "@type": "Answer", text: t("aide.faq.a3") } },
          ],
        }}
      />

      <header className="border-b border-border">
        <div className="container max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to={lp("/")}>
            <Button variant="ghost" size="icon" aria-label={t("aide.back")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="font-semibold tracking-tight">Asclion</span>
          <span className="mono-label hidden sm:inline">/ aide</span>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-16 flex-1 space-y-10">
        <div className="space-y-3">
          <p className="mono-label">FAQ</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">{t("aide.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("aide.intro")}{" "}
            <a href="mailto:support@asclion.com" className="text-primary underline underline-offset-2">{t("aide.contact")}</a>.
          </p>
        </div>

        <Accordion type="single" collapsible className="border-t border-border">
          {[
            { v: "scanner", q: t("aide.q1"), body: <><p>{t("aide.a1.p1")}</p><p>{t("aide.a1.p2")}</p></> },
            { v: "lgo", q: t("aide.q2"), body: <><p>{t("aide.a2.p1")}</p><p>{t("aide.a2.p2")}</p></> },
            {
              v: "recommendations", q: t("aide.q3"), body: <>
                <p>{t("aide.a3.p1")}</p>
                <ul className="space-y-1 mt-2">
                  <li>— {t("aide.a3.li1")} <a href="mailto:support@asclion.com" className="text-primary underline underline-offset-2">support@asclion.com</a>.</li>
                  <li>— {t("aide.a3.li2")}</li>
                </ul>
              </>
            },
            {
              v: "performance", q: t("aide.q4"), body: <>
                <p>{t("aide.a4.p1")}</p>
                <ul className="space-y-1 mt-2">
                  <li>— {t("aide.a4.li1")}</li>
                  <li>— {t("aide.a4.li2")}</li>
                  <li>— {t("aide.a4.li3")}</li>
                </ul>
              </>
            },
            {
              v: "shortcuts", q: t("aide.q5"), body: <>
                <ul className="space-y-1 font-mono text-xs">
                  <li>{t("aide.a5.k1")}</li>
                  <li>{t("aide.a5.k2")}</li>
                  <li>{t("aide.a5.k3")}</li>
                  <li>{t("aide.a5.k4")}</li>
                  <li>{t("aide.a5.k5")}</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">{t("aide.a5.note")}</p>
              </>
            },
            {
              v: "privacy", q: t("aide.q6"), body: <>
                <p>{t("aide.a6.p1")}</p>
                <p className="mt-2">
                  {t("aide.a6.p2")}{" "}
                  <Link to={lp("/confidentialite")} className="text-primary underline underline-offset-2">{t("footer.privacy").toLowerCase()}</Link>.
                </p>
              </>
            },
          ].map((item) => (
            <AccordionItem key={item.v} value={item.v} className="border-b border-border">
              <AccordionTrigger className="text-left text-sm font-medium py-4 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 space-y-2">
                {item.body}
              </AccordionContent>
            </AccordionItem>
          ))}

          <AccordionItem value="contact" className="border-b border-border">
            <AccordionTrigger className="text-left text-sm font-medium py-4 hover:no-underline">{t("aide.q7")}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 space-y-3">
              <p>{t("aide.a7.p1")}</p>
              <a href="mailto:support@asclion.com">
                <Button size="sm" variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" />
                  support@asclion.com
                </Button>
              </a>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Aide;
