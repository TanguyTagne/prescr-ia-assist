import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, Mail } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import { useI18n } from "@/i18n/I18nProvider";

const Aide = () => {
  const { t, lp } = useI18n();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-3xl mx-auto flex items-center gap-3">
          <Link to={lp("/")}>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" aria-label={t("aide.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-foreground" />
            <h1 className="text-xl font-bold text-primary-foreground tracking-tight">{t("aide.title")}</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-8 flex-1">
        <p className="text-sm text-muted-foreground mb-6">
          {t("aide.intro")}
          <a href="mailto:support@asclion.com" className="text-primary hover:underline ml-1">{t("aide.contact")}</a>.
        </p>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="scanner" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q1")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>{t("aide.a1.p1")}</p>
              <p>{t("aide.a1.p2")}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="lgo" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q2")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>{t("aide.a2.p1")}</p>
              <p>{t("aide.a2.p2")}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recommendations" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q3")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>{t("aide.a3.p1")}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t("aide.a3.li1")} <a href="mailto:support@asclion.com" className="text-primary hover:underline">support@asclion.com</a>.</li>
                <li>{t("aide.a3.li2")}</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="performance" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q4")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>{t("aide.a4.p1")}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t("aide.a4.li1")}</li>
                <li>{t("aide.a4.li2")}</li>
                <li>{t("aide.a4.li3")}</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shortcuts" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q5")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <ul className="space-y-1">
                <li>{t("aide.a5.k1")}</li>
                <li>{t("aide.a5.k2")}</li>
                <li>{t("aide.a5.k3")}</li>
                <li>{t("aide.a5.k4")}</li>
                <li>{t("aide.a5.k5")}</li>
              </ul>
              <p className="text-xs text-muted-foreground">{t("aide.a5.note")}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="privacy" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q6")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-2">
              <p>{t("aide.a6.p1")}</p>
              <p>
                {t("aide.a6.p2")}{" "}
                <Link to={lp("/confidentialite")} className="text-primary hover:underline">{t("footer.privacy").toLowerCase()}</Link>.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contact" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("aide.q7")}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed space-y-3">
              <p>{t("aide.a7.p1")}</p>
              <a href="mailto:support@asclion.com">
                <Button className="gap-2 pharmacy-gradient border-0">
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
