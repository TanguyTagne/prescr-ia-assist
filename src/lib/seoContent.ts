import conseilsRaw from "@/data/conseils-associes.json";
import lgoRaw from "@/data/compatibilite-lgo.json";

export interface FaqItem {
  question: string;
  reponse: string;
}

export interface ConseilFiche {
  slug: string;
  medicament_nom: string;
  classe_atc: string;
  meta_title: string;
  meta_description: string;
  produit_complementaire_nom: string;
  phrase_conseil_asclion: string;
  rationnel_clinique: string;
  impact_panier: {
    prix_moyen_conseille_ttc: string;
    marge_estimee: string;
    frequence_acceptation_estimee: string;
  };
  faq: FaqItem[];
}

export interface LgoFiche {
  slug: string;
  nom_lgo: string;
  editeur: string;
  meta_title: string;
  meta_description: string;
  mode_fonctionnement: string;
  avantages_officine: string[];
  faq: FaqItem[];
}

export const CONSEILS = conseilsRaw as ConseilFiche[];
export const LGOS = lgoRaw as LgoFiche[];

export const getConseil = (slug: string) => CONSEILS.find((c) => c.slug === slug);
export const getLgo = (slug: string) => LGOS.find((l) => l.slug === slug);

/** Simple FAQPage JSON-LD builder shared by both page templates. */
export const faqLd = (faq: FaqItem[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.reponse },
  })),
});
