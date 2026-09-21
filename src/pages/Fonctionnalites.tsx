import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BarChart3, Check, Monitor, Package, ScanLine, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Seo from "@/components/Seo";
import SiteFooter from "@/components/SiteFooter";
import { useI18n } from "@/i18n/I18nProvider";

interface Feature { icon: LucideIcon; title: string; description: string; details: string[] }

const COPY = {
  fr: {
    seoTitle: "Logiciel de conseil associé pour pharmacie | Asclion",
    seoDescription: "Asclion complète votre LGO : au scan du CIP d'un médicament, l'application affiche un produit complémentaire pertinent et une phrase conseil. Base de 30 000+ médicaments.",
    heading: "Fonctionnement d'Asclion", subheading: "Le conseil associé déclenché par le scan d'un médicament",
    summaryTitle: "Asclion, en une phrase",
    summary: "Une application Windows qui détecte le CIP scanné au comptoir et affiche un produit complémentaire pertinent avec une phrase conseil — sans remplacer ni modifier votre LGO.",
    sections: [
      { title: "Au comptoir", features: [
        { icon: ScanLine, title: "Scan CIP automatique", description: "Asclion reconnaît le médicament à partir du code-barres déjà scanné au comptoir.", details: ["Compatible avec les douchettes HID USB ou Bluetooth", "Aucune ressaisie du nom du médicament", "Détection même lorsque l'application n'a pas le focus"] },
        { icon: Package, title: "Produit complémentaire recommandé", description: "L'application affiche un produit complémentaire associé au médicament reconnu.", details: ["Base de 30 000+ médicaments référencés", "Suggestions curatées et présentées comme une aide", "Le pharmacien choisit de proposer ou d'ignorer"] },
        { icon: Zap, title: "Phrase conseil courte", description: "Chaque suggestion est accompagnée d'une formulation concise, prête à adapter au patient.", details: ["Visible directement avec le produit", "Pensée pour le rythme du comptoir", "Ne remplace jamais le jugement professionnel"] },
      ]},
      { title: "Adaptation à l'officine", features: [
        { icon: Package, title: "Références de votre stock", description: "L'offre Premium permet de remplacer une catégorie générique par une référence choisie par l'officine.", details: ["Association avec les références disponibles", "Priorité aux choix propres à la pharmacie", "Mise à jour selon la configuration retenue"] },
        { icon: Users, title: "Apprentissage des choix", description: "Les retours de l'équipe permettent d'affiner les suggestions utiles à l'officine.", details: ["Acceptation enregistrée par pharmacie", "Choix manuel ou reconnaissance CIP distingués", "Pas d'automatisation de la décision professionnelle"] },
        { icon: BarChart3, title: "Suivi de l'utilisation", description: "Les responsables suivent les médicaments analysés et les produits complémentaires acceptés.", details: ["Périodes mois, trimestre et année", "Analyses comptées par médicament, réussies ou non", "Suivi des acceptations par l'équipe"] },
      ]},
      { title: "Installation", features: [
        { icon: Monitor, title: "Application Windows", description: "Asclion fonctionne à côté du LGO et reste discret pendant la délivrance.", details: ["Installation accompagnée", "Compatibilité validée selon l'environnement", "Caisses illimitées par officine selon l'offre"] },
      ]},
    ],
    cta: "Voir les offres", contact: "Une question sur votre configuration ?",
  },
  en: {
    seoTitle: "Associated-advice software for pharmacies | Asclion",
    seoDescription: "Asclion works alongside pharmacy software: when a medication barcode is scanned, it displays a relevant complementary product and an advice phrase. 30,000+ medications covered.",
    heading: "How Asclion works", subheading: "Associated advice triggered by a medication scan",
    summaryTitle: "Asclion in one sentence",
    summary: "A Windows application that detects the product code scanned at the counter and displays a relevant complementary product with an advice phrase — without replacing or modifying your pharmacy software.",
    sections: [
      { title: "At the counter", features: [
        { icon: ScanLine, title: "Automatic product-code scan", description: "Asclion recognises the medication from the barcode already scanned at the counter.", details: ["Works with standard USB or Bluetooth HID scanners", "No need to re-enter the medication name", "Detection works even when the application is not focused"] },
        { icon: Package, title: "Recommended complementary product", description: "The application shows a complementary product associated with the recognised medication.", details: ["Database covering 30,000+ medications", "Curated suggestions presented as decision support", "The pharmacist chooses whether to suggest or ignore"] },
        { icon: Zap, title: "Short advice phrase", description: "Each suggestion includes concise wording that can be adapted for the patient.", details: ["Shown directly with the product", "Designed for the pace of the counter", "Never replaces professional judgement"] },
      ]},
      { title: "Adapted to your pharmacy", features: [
        { icon: Package, title: "Products from your stock", description: "The Premium plan lets the pharmacy replace a generic category with one of its chosen products.", details: ["Linked to available references", "The pharmacy's own choices take priority", "Updated according to the selected configuration"] },
        { icon: Users, title: "Learning from team choices", description: "Team feedback helps refine suggestions that are useful for the pharmacy.", details: ["Acceptance tracked by pharmacy", "Manual choices and product-code recognition are distinguished", "Professional decisions are never automated"] },
        { icon: BarChart3, title: "Usage tracking", description: "Managers can follow medications analysed and complementary products accepted.", details: ["Monthly, quarterly and annual periods", "Each medication counts whether analysis succeeds or not", "Acceptance tracking across the team"] },
      ]},
      { title: "Installation", features: [
        { icon: Monitor, title: "Windows application", description: "Asclion works alongside pharmacy software and stays discreet during dispensing.", details: ["Guided installation", "Compatibility confirmed for each environment", "Unlimited tills per pharmacy according to plan"] },
      ]},
    ],
    cta: "View plans", contact: "A question about your setup?",
  },
};

const Fonctionnalites = () => {
  const { lang, lp } = useI18n();
  const c = COPY[lang];
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo title={c.seoTitle} description={c.seoDescription} path="/fonctionnalites" jsonLd={{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Asclion", applicationCategory: "BusinessApplication", operatingSystem: "Windows", url: lang === "en" ? "https://www.asclion.com/en/fonctionnalites" : "https://www.asclion.com/fonctionnalites", description: c.seoDescription, offers: { "@type": "Offer", price: "99", priceCurrency: "EUR", availability: "https://schema.org/InStock" }, audience: { "@type": "Audience", audienceType: "Pharmacists" }, inLanguage: lang === "en" ? "en" : "fr-FR" }} />
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10" aria-label={lang === "en" ? "Back to home" : "Retour à l'accueil"}><Link to={lp("/")}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div><h1 className="text-xl font-bold text-primary-foreground tracking-tight">{c.heading}</h1><p className="text-xs text-primary-foreground/80">{c.subheading}</p></div>
        </div>
      </header>
      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-10 flex-1">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 flex items-start gap-3"><Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div className="space-y-1"><p className="text-sm font-semibold">{c.summaryTitle}</p><p className="text-sm text-foreground/80 leading-relaxed">{c.summary}</p></div></div>
        {c.sections.map((section) => <section key={section.title} className="space-y-4"><h2 className="text-lg font-bold tracking-tight border-b border-border pb-2">{section.title}</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{section.features.map((feature: Feature) => <Card key={feature.title}><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><feature.icon className="h-4 w-4 text-primary shrink-0" />{feature.title}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-foreground/80 leading-relaxed">{feature.description}</p><ul className="space-y-1.5">{feature.details.map((detail) => <li key={detail} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span>{detail}</span></li>)}</ul></CardContent></Card>)}</div></section>)}
        <div className="border-t border-border pt-8 text-center space-y-4"><Button asChild><Link to={lp("/tarifs")}>{c.cta}</Link></Button><p className="text-sm text-muted-foreground">{c.contact} <a href="mailto:tanguytubert@gmail.com" className="text-primary hover:underline">tanguytubert@gmail.com</a></p></div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Fonctionnalites;
