export type Lang = "fr" | "en";

export const translations = {
  // ===== NAV =====
  "nav.admin": { fr: "Admin", en: "Admin" },
  "nav.dashboard": { fr: "Dashboard", en: "Dashboard" },
  "nav.download": { fr: "Télécharger", en: "Download" },
  "nav.signin": { fr: "Se connecter", en: "Sign in" },
  "nav.signout": { fr: "Déconnexion", en: "Sign out" },

  // ===== LANDING =====
  "landing.badge": { fr: "Copilote IA — Plus de ventes associées, meilleur conseil", en: "AI copilot — More cross-sells, better advice" },
  "landing.title.line1": { fr: "Augmentez votre panier moyen,", en: "Grow your average basket," },
  "landing.title.line2": { fr: "sans sacrifier le conseil", en: "without compromising on advice" },
  "landing.subtitle": {
    fr: "Asclion transforme chaque médicament scanné en opportunité de vente associée pertinente. Plus de produits complémentaires délivrés, un panier moyen qui décolle, et un patient mieux accompagné, sans effort supplémentaire pour l'équipe.",
    en: "Asclion turns every scanned drug into a relevant cross-sell opportunity. More complementary products delivered, a higher average basket, and better patient care — with zero extra effort for your team.",
  },
  "landing.cta.access": { fr: "Booster mon chiffre — Demander une Demo", en: "Boost my revenue — Request a Demo" },
  "landing.cta.vsLgo": { fr: "Asclion vs LGO", en: "Asclion vs LGO" },

  "landing.how.title": { fr: "Comment Asclion fait grimper votre panier moyen", en: "How Asclion grows your average basket" },
  "landing.how.step1.title": { fr: "Scannez ", en: "Scan " },
  "landing.how.step1.desc": {
    fr: "Scannez simplement votre produit comme d'habitude, l'IA s'occupe du reste. Chaque délivrance devient une opportunité commerciale identifiée en quelques secondes.",
    en: "Simply scan your product as usual, the AI handles the rest. Every dispensation becomes a sales opportunity identified in seconds.",
  },
  "landing.how.step2.title": { fr: "L'IA repère les ventes associées", en: "AI spots cross-sell opportunities" },
  "landing.how.step2.desc": {
    fr: "Interactions, effets secondaires, besoins latents : Asclion détecte tout ce qu'une équipe surchargée pourrait manquer et le traduit en produits à proposer.",
    en: "Interactions, side effects, latent needs: Asclion catches what a busy team could miss — and turns it into products to offer.",
  },
  "landing.how.step3.title": { fr: "Vendez plus, mieux, au comptoir", en: "Sell more, sell better, at the counter" },
  "landing.how.step3.desc": {
    fr: "Recevez les produits à conseiller dans votre stock, avec la phrase prête à dire. Le patient se sent mieux pris en charge, votre panier moyen progresse.",
    en: "Get the right in-stock products to recommend with ready-to-say phrases. Patients feel better cared for, your average basket grows.",
  },

  "landing.results.title": { fr: "Des résultats commerciaux concrets", en: "Concrete business results" },
  "landing.results.basket": { fr: "Panier moyen", en: "Average basket" },
  "landing.results.basket.desc": { fr: "Hausse moyenne observée sur les délivrances accompagnées d'Asclion", en: "Average uplift observed on dispensations supported by Asclion" },
  "landing.results.crosssell": { fr: "Ventes associées", en: "Cross-sells" },
  "landing.results.crosssell.desc": { fr: "Multiplication du nombre de produits complémentaires proposés au comptoir", en: "Multiplier on complementary products offered at the counter" },
  "landing.results.speed": { fr: "Par ordonnance", en: "Per prescription" },
  "landing.results.speed.desc": { fr: "Une opportunité commerciale identifiée sans ralentir l'équipe", en: "A sales opportunity surfaced without slowing the team down" },
  "landing.results.disclaimer": { fr: "Indicateurs constatés sur nos pharmacies pilotes — variables selon assortiment et usage.", en: "Figures observed on our pilot pharmacies — vary by product mix and usage." },

  // ===== SIMULATOR =====
  "landing.sim.badge": { fr: "Simulateur gratuit", en: "Free simulator" },
  "landing.sim.title": { fr: "Le potentiel de votre officine", en: "Your pharmacy's potential" },
  "landing.sim.ca": { fr: "Chiffre d'affaires annuel", en: "Annual revenue" },
  "landing.sim.days": { fr: "Jours d'ouverture / semaine", en: "Opening days / week" },
  "landing.sim.result.label": { fr: "Marge additionnelle estimée", en: "Estimated additional margin" },
  "landing.sim.result.unit": { fr: "€ / mois", en: "€ / month" },
  "landing.sim.result.hint": {
    fr: "soit ~{n} passages/jour et 5 à 12 % de conseils aboutis en plus",
    en: "i.e. ~{n} visits/day and 5 to 12% more successful advice",
  },
  "landing.sim.cta": { fr: "Recevoir mon diagnostic personnalisé", en: "Get my personalised diagnosis" },
  "landing.sim.disclaimer": {
    fr: "Estimation basée sur les moyennes des officines françaises (panier moyen 42 €, données 2025). Résultats variables selon l'officine.",
    en: "Estimate based on French pharmacy averages (avg basket €42, 2025 data). Results vary by pharmacy.",
  },

  // ===== REFERRAL =====
  "landing.referral.title": { fr: "Parrainez une consœur, un confrère", en: "Refer a fellow pharmacist" },
  "landing.referral.subtitle": {
    fr: "Les meilleures officines se recommandent entre elles. Asclion aussi.",
    en: "The best pharmacies recommend each other. Asclion too.",
  },
  "landing.referral.card1.title": { fr: "1 mois offert", en: "1 month free" },
  "landing.referral.card1.desc": {
    fr: "sur votre abonnement, pour chaque officine parrainée qui s'équipe",
    en: "on your subscription, for each referred pharmacy that signs up",
  },
  "landing.referral.card2.title": { fr: "Essai prolongé", en: "Extended trial" },
  "landing.referral.card2.desc": {
    fr: "pour l'officine parrainée : elle démarre sereinement",
    en: "for the referred pharmacy: a smooth start",
  },
  "landing.referral.card3.title": { fr: "Cumulable", en: "Stackable" },
  "landing.referral.card3.desc": {
    fr: "12 parrainages = votre année offerte",
    en: "12 referrals = your year on us",
  },
  "landing.referral.cta": { fr: "Demander mon code de parrainage", en: "Request my referral code" },


  // ===== NEW: HORMOZI HERO =====
  "landing.hero.badge": {
    fr: "⚡ Pharmacie pilote · +880 € de CA additionnel dès le 1ᵉʳ mois",
    en: "⚡ Pilot pharmacy · +€880 additional revenue in the first month",
  },
  "landing.hero.title.line1": { fr: "Ajoutez", en: "Add" },
  "landing.hero.title.amount": { fr: "+800 à +2 000 € de CA/mois", en: "+€800 to +€2,000/month" },
  "landing.hero.title.line2": { fr: "à votre officine — sans embaucher, sans changer de LGO.", en: "to your pharmacy — no new hires, no software change." },
  "landing.hero.subtitle": {
    fr: "Vos préparateurs délivrent l'ordonnance, notre IA suggère en 2 secondes le produit associé pertinent (déjà en stock). Résultat mesuré chez notre pilote : 1 patient sur 5 repart avec le produit conseillé.",
    en: "Your team dispenses the prescription, our AI suggests the right associated product in 2 seconds (already in stock). Measured result at our pilot: 1 in 5 patients leaves with the recommended product.",
  },
  "landing.hero.cta.primary": { fr: "Réserver ma démo (15 min) →", en: "Book my demo (15 min) →" },
  "landing.hero.cta.secondary": { fr: "Voir la garantie", en: "See the guarantee" },
  "landing.hero.trust1": { fr: "Compatible Winpharma, LGPI, Pharmagest", en: "Works with Winpharma, LGPI, Pharmagest" },
  "landing.hero.trust2": { fr: "Installation en 24 h", en: "Setup in 24 h" },
  "landing.hero.trust3": { fr: "RGPD & données hébergées en UE", en: "GDPR & EU-hosted data" },

  // ===== NEW: PROOF =====
  "landing.proof.badge": { fr: "Résultat mesuré", en: "Measured result" },
  "landing.proof.quote": {
    fr: "« +880 € de chiffre d'affaires additionnel sur le 1ᵉʳ mois, avec 1 patient sur 5 qui repart avec le produit conseillé. »",
    en: '"+€880 in additional revenue in the first month, with 1 in 5 patients leaving with the recommended product."',
  },
  "landing.proof.author": { fr: "— Pharmacie pilote, avril 2026", en: "— Pilot pharmacy, April 2026" },
  "landing.proof.kpi1.value": { fr: "+880 €", en: "+€880" },
  "landing.proof.kpi1.label": { fr: "CA additionnel · 1ᵉʳ mois", en: "Extra revenue · 1st month" },
  "landing.proof.kpi2.value": { fr: "1 / 5", en: "1 / 5" },
  "landing.proof.kpi2.label": { fr: "patients acceptent le conseil", en: "patients accept the advice" },
  "landing.proof.kpi3.value": { fr: "< 2 s", en: "< 2 s" },
  "landing.proof.kpi3.label": { fr: "latence par ordonnance", en: "latency per prescription" },

  // ===== NEW: VALUE STACK =====
  "landing.stack.title": { fr: "Ce que vous obtenez en rejoignant Asclion", en: "What you get when you join Asclion" },
  "landing.stack.subtitle": { fr: "Tout est inclus. Aucune option cachée.", en: "Everything included. No hidden add-ons." },
  "landing.stack.item1.title": { fr: "Copilote IA Asclion (licence illimitée, tous postes)", en: "Asclion AI copilot (unlimited license, all workstations)" },
  "landing.stack.item1.value": { fr: "valeur ~ 199 €/mois", en: "value ~ €199/mo" },
  "landing.stack.item2.title": { fr: "Installation & connexion à votre LGO par nos équipes", en: "Setup & pharmacy-software integration by our team" },
  "landing.stack.item2.value": { fr: "valeur ~ 490 €", en: "value ~ €490" },
  "landing.stack.item3.title": { fr: "Formation de votre équipe (visio 30 min)", en: "Team training (30-min video session)" },
  "landing.stack.item3.value": { fr: "valeur ~ 190 €", en: "value ~ €190" },
  "landing.stack.item4.title": { fr: "Base de 4 000+ correspondances médicaments → conseils", en: "4,000+ drug → advice mappings knowledge base" },
  "landing.stack.item4.value": { fr: "inclus", en: "included" },
  "landing.stack.item5.title": { fr: "Support prioritaire (réponse < 4 h ouvrées)", en: "Priority support (reply within 4 business hours)" },
  "landing.stack.item5.value": { fr: "valeur ~ 90 €/mois", en: "value ~ €90/mo" },
  "landing.stack.item6.title": { fr: "Mises à jour cliniques mensuelles", en: "Monthly clinical updates" },
  "landing.stack.item6.value": { fr: "inclus", en: "included" },
  "landing.stack.total.label": { fr: "Valeur totale", en: "Total value" },
  "landing.stack.total.value": { fr: "~ 970 € + 289 €/mois", en: "~ €970 + €289/mo" },
  "landing.stack.price.label": { fr: "Votre tarif pilote", en: "Your pilot pricing" },
  "landing.stack.price.value": { fr: "sur devis, transparent, sans surprise", en: "on request, transparent, no surprises" },

  // ===== NEW: GUARANTEE =====
  "landing.guarantee.badge": { fr: "Garantie", en: "Guarantee" },
  "landing.guarantee.title": { fr: "Résultat ou remboursé — sans discussion.", en: "Results or refunded — no questions asked." },
  "landing.guarantee.body": {
    fr: "Si Asclion ne vous génère pas au moins l'équivalent de son coût en CA additionnel dès le 2ᵉ mois, on vous rembourse intégralement.",
    en: "If Asclion doesn't generate at least its own cost in additional revenue from month 2, we refund you in full.",
  },
  "landing.guarantee.footnote": {
    fr: "On peut se le permettre : nos pharmacies pilotes font en moyenne +800 €/mois dès le premier mois.",
    en: "We can afford it: our pilot pharmacies average +€800/month from month one.",
  },

  // ===== NEW: FOR WHOM =====
  "landing.forwhom.title": { fr: "Pour qui est fait Asclion ?", en: "Who is Asclion for?" },
  "landing.forwhom.yes.title": { fr: "Fait pour vous si :", en: "Made for you if:" },
  "landing.forwhom.yes.1": { fr: "Vous êtes titulaire d'officine (indépendant ou groupement)", en: "You own or run a pharmacy (independent or group)" },
  "landing.forwhom.yes.2": { fr: "Vous voulez augmenter votre CA sans sacrifier le conseil", en: "You want to grow revenue without compromising advice quality" },
  "landing.forwhom.yes.3": { fr: "Vous utilisez Winpharma, LGPI, Pharmagest, Smart Rx, LGO, Périphar…", en: "You use Winpharma, LGPI, Pharmagest, Smart Rx, LGO, Périphar…" },
  "landing.forwhom.no.title": { fr: "Ce n'est pas pour vous si :", en: "Not for you if:" },
  "landing.forwhom.no.1": { fr: "Vous cherchez uniquement à écouler du stock (Asclion ne recommande que ce qui est cliniquement pertinent)", en: "You only want to clear stock (Asclion only recommends what's clinically relevant)" },
  "landing.forwhom.no.2": { fr: "Vous n'avez pas de scanner de médicaments au comptoir", en: "You don't have a barcode scanner at the counter" },

  // ===== NEW: FAQ =====
  "landing.faq.title": { fr: "Les 4 questions qu'on nous pose toujours", en: "The 4 questions we always get" },
  "landing.faq.q1": { fr: "Combien ça coûte, vraiment ?", en: "How much does it really cost?" },
  "landing.faq.a1": {
    fr: "Un abonnement mensuel unique, sans frais cachés, sans engagement long. Prix communiqué en démo (adapté à la taille de l'officine). Rappel : garantie « résultat ou remboursé » dès le 2ᵉ mois.",
    en: "A single monthly subscription, no hidden fees, no long lock-in. Price shared during the demo (adapted to pharmacy size). Reminder: results-or-refund guarantee from month 2.",
  },
  "landing.faq.q2": { fr: "Combien de temps pour installer ?", en: "How long does setup take?" },
  "landing.faq.a2": {
    fr: "24 h ouvrées. Nous connectons Asclion à votre LGO et formons votre équipe en visio de 30 minutes. Aucune interruption au comptoir.",
    en: "24 business hours. We connect Asclion to your pharmacy software and train your team in a 30-min video call. Zero counter downtime.",
  },
  "landing.faq.q3": { fr: "Est-ce compatible avec mon LGO ?", en: "Is it compatible with my pharmacy software?" },
  "landing.faq.a3": {
    fr: "Oui. Asclion fonctionne en surcouche non intrusive au-dessus de Winpharma, LGPI, Pharmagest, Smart Rx, LGO et Périphar. Aucune modification de votre logiciel.",
    en: "Yes. Asclion runs as a non-intrusive overlay above Winpharma, LGPI, Pharmagest, Smart Rx, LGO and Périphar. Zero changes to your software.",
  },
  "landing.faq.q4": { fr: "Et les données patients ?", en: "What about patient data?" },
  "landing.faq.a4": {
    fr: "Aucune donnée identifiante n'est stockée. Les noms sont hachés (SHA-256) avant tout enregistrement. Hébergement UE, conforme RGPD, PIA disponible sur demande.",
    en: "No identifying data is stored. Names are hashed (SHA-256) before any recording. EU hosting, GDPR-compliant, PIA available on request.",
  },

  // ===== NEW: URGENCY =====
  "landing.urgency.text": {
    fr: "⏱ Places pilotes limitées — nous accompagnons personnellement chaque pharmacie sur ses 30 premiers jours. Nous acceptons 3 nouvelles pharmacies par mois pour garantir la qualité de l'onboarding.",
    en: "⏱ Limited pilot slots — we personally accompany each pharmacy through its first 30 days. We accept 3 new pharmacies per month to guarantee onboarding quality.",
  },

  "landing.access.title": { fr: "Réservez votre démo (15 min)", en: "Book your demo (15 min)" },
  "landing.access.desc": {
    fr: "Trois champs suffisent. On revient vers vous sous 24 h ouvrées avec un créneau adapté.",
    en: "Three fields, that's it. We get back to you within 24 business hours with a slot that fits.",
  },

  // ===== ACCESS FORM =====
  "form.pharmacy_name": { fr: "Nom de la pharmacie *", en: "Pharmacy name *" },
  "form.contact_name": { fr: "Nom du contact", en: "Contact name" },
  "form.email": { fr: "Email professionnel *", en: "Work email *" },
  "form.phone": { fr: "Téléphone (recommandé — rappel sous 24 h)", en: "Phone (recommended — callback within 24 h)" },
  "form.city": { fr: "Ville", en: "City" },
  "form.lgo": { fr: "LGO utilisé (ex: Winpharma, LGPI...)", en: "Pharmacy software (e.g. Winpharma, LGPI...)" },
  "form.more": { fr: "Ajouter des infos (optionnel)", en: "Add more info (optional)" },
  "form.microcopy": { fr: "Réponse sous 24 h ouvrées · Aucune CB requise · Aucun engagement", en: "Reply within 24 business hours · No credit card · No commitment" },
  "form.consent": {
    fr: "J'accepte que mes données soient traitées pour répondre à ma demande, conformément à la",
    en: "I agree that my data may be processed to respond to my request, in accordance with the",
  },
  "form.privacy": { fr: "politique de confidentialité", en: "privacy policy" },
  "form.and": { fr: "et aux", en: "and the" },
  "form.terms": { fr: "CGU", en: "Terms of Use" },
  "form.submit": { fr: "Réserver ma démo gratuite →", en: "Book my free demo →" },
  "form.submitted.title": { fr: "Demande envoyée !", en: "Request sent!" },
  "form.submitted.desc": { fr: "Nous vous contactons sous 24 h ouvrées avec un créneau adapté.", en: "We'll contact you within 24 business hours with a slot that fits." },
  "form.error.consent": { fr: "Veuillez accepter la politique de confidentialité.", en: "Please accept the privacy policy." },
  "form.success.toast": { fr: "Demande envoyée ! Nous reviendrons vers vous rapidement.", en: "Request sent! We'll get back to you soon." },
  "form.error.toast": { fr: "Erreur lors de l'envoi", en: "Error sending request" },

  // ===== FOOTER =====
  "footer.disclaimer": {
    fr: "Asclion — Outil d'aide, ne remplace pas le jugement professionnel",
    en: "Asclion — Decision-support tool, does not replace professional judgment",
  },
  "footer.help": { fr: "Aide", en: "Help" },
  "footer.legal": { fr: "Mentions légales", en: "Legal notice" },
  "footer.privacy": { fr: "Confidentialité", en: "Privacy" },
  "footer.cookies": { fr: "Cookies", en: "Cookies" },
  "footer.terms": { fr: "CGU", en: "Terms" },

  // ===== LANGUAGE TOGGLE =====
  "lang.fr": { fr: "FR", en: "FR" },
  "lang.en": { fr: "EN", en: "EN" },
  "lang.switch": { fr: "Switch to English", en: "Passer en français" },

  // ===== AIDE =====
  "aide.back": { fr: "Retour à l'accueil", en: "Back to home" },
  "aide.title": { fr: "Aide & FAQ", en: "Help & FAQ" },
  "aide.intro": {
    fr: "Réponses aux questions les plus fréquentes sur Asclion. Une autre question ?",
    en: "Answers to the most common questions about Asclion. Another question?",
  },
  "aide.contact": { fr: "Contactez-nous", en: "Contact us" },
  "aide.q1": { fr: "Comment connecter mon scanner d'ordonnances ?", en: "How do I connect my prescription scanner?" },
  "aide.a1.p1": {
    fr: "Cliquez sur Connecter scanner dans le widget puis sélectionnez le dossier où votre scanner dépose les fichiers (PDF ou images). Asclion surveille en continu ce dossier et lance l'analyse automatiquement à chaque nouvelle ordonnance.",
    en: "Click Connect scanner in the widget, then select the folder where your scanner drops files (PDF or images). Asclion continuously watches this folder and runs the analysis automatically on every new prescription.",
  },
  "aide.a1.p2": {
    fr: "Pour les scanners de codes-barres (douchettes USB), aucune configuration n'est nécessaire : branchez la douchette et scannez, Asclion détecte automatiquement la frappe rapide et lance la recherche.",
    en: "For barcode scanners (USB guns), no configuration is needed: plug it in and scan, Asclion automatically detects the rapid input and triggers the lookup.",
  },
  "aide.q2": { fr: "Comment configurer mon LGO (Winpharma, LGPI, Pharmagest…) ?", en: "How do I configure my pharmacy software?" },
  "aide.a2.p1": {
    fr: "Sur l'application desktop, Asclion détecte automatiquement votre LGO au démarrage et propose le bon preset. Vous pouvez aussi le configurer manuellement via le menu Réglages → Configuration avancée du widget.",
    en: "On the desktop app, Asclion auto-detects your pharmacy software at startup and suggests the right preset. You can also configure it manually via Settings → Advanced configuration in the widget.",
  },
  "aide.a2.p2": {
    fr: "Le preset adapte la position et la taille du widget pour qu'il s'intègre parfaitement à côté de votre LGO sans le masquer.",
    en: "The preset adjusts the widget's position and size so it fits perfectly next to your pharmacy software without covering it.",
  },
  "aide.q3": { fr: "Pourquoi un produit n'apparaît-il pas dans mes recommandations ?", en: "Why is a product missing from my recommendations?" },
  "aide.a3.p1": {
    fr: "Asclion s'appuie sur une base clinique curatée. Si un produit manque, deux causes possibles :",
    en: "Asclion relies on a curated clinical database. If a product is missing, two possible causes:",
  },
  "aide.a3.li1": {
    fr: "Le médicament détecté n'est pas encore couvert dans la base — signalez-le à",
    en: "The detected medication is not yet covered in the database — report it to",
  },
  "aide.a3.li2": {
    fr: "Vous avez personnalisé vos recommandations dans Dashboard → Personnalisation et le produit a été remplacé.",
    en: "You customized your recommendations in Dashboard → Customization and the product was replaced.",
  },
  "aide.q4": { fr: "Que faire si une analyse est lente ?", en: "What if an analysis is slow?" },
  "aide.a4.p1": { fr: "Le temps d'analyse cible est de 2,5 secondes. En cas de lenteur :", en: "Target analysis time is 2.5 seconds. If it's slow:" },
  "aide.a4.li1": {
    fr: "Vérifiez votre connexion Internet (un bandeau orange apparaît si Asclion détecte le mode hors ligne).",
    en: "Check your Internet connection (an orange banner appears if Asclion detects offline mode).",
  },
  "aide.a4.li2": {
    fr: "Pour les ordonnances scannées en photo, privilégiez un format PDF ou JPG net pour accélérer l'OCR.",
    en: "For photo-scanned prescriptions, prefer a clean PDF or JPG to speed up OCR.",
  },
  "aide.a4.li3": {
    fr: "Si le problème persiste, contactez le support avec le code de l'analyse affiché en bas du widget.",
    en: "If the issue persists, contact support with the analysis code shown at the bottom of the widget.",
  },
  "aide.q5": { fr: "Quels sont les raccourcis clavier ?", en: "What are the keyboard shortcuts?" },
  "aide.a5.k1": { fr: "Échap — Nouvelle ordonnance / réinitialiser", en: "Esc — New prescription / reset" },
  "aide.a5.k2": { fr: "Entrée — Lancer l'analyse", en: "Enter — Run analysis" },
  "aide.a5.k3": { fr: "Ctrl + K — Focus saisie rapide", en: "Ctrl + K — Focus quick input" },
  "aide.a5.k4": { fr: "Ctrl + 1/2/3 — Changer de mode (Saisie, Texte, Photo)", en: "Ctrl + 1/2/3 — Switch mode (Input, Text, Photo)" },
  "aide.a5.k5": { fr: "? — Ouvrir cette page d'aide", en: "? — Open this help page" },
  "aide.a5.note": { fr: "Personnalisables depuis Dashboard → Raccourcis clavier.", en: "Customizable in Dashboard → Keyboard shortcuts." },
  "aide.q6": { fr: "Mes données patient sont-elles stockées ?", en: "Is my patient data stored?" },
  "aide.a6.p1": {
    fr: "Aucune donnée patient identifiante n'est stockée. Les noms extraits des ordonnances sont anonymisés via un hash SHA-256 avant tout enregistrement. Les analyses servent uniquement à mesurer la qualité des recommandations.",
    en: "No identifying patient data is stored. Names extracted from prescriptions are anonymized via SHA-256 hashing before any storage. Analyses are used only to measure recommendation quality.",
  },
  "aide.a6.p2": { fr: "Plus de détails dans notre", en: "More details in our" },
  "aide.q7": { fr: "Contacter le support", en: "Contact support" },
  "aide.a7.p1": { fr: "Notre équipe répond sous 24 h ouvrées.", en: "Our team replies within 24 business hours." },

  // ===== VS LGO =====
  "vslgo.back": { fr: "Retour à l'accueil", en: "Back to home" },
  "vslgo.badge": { fr: "Comparatif", en: "Comparison" },
  "vslgo.subtitle": { fr: "Voici pourquoi Asclion change la donne.", en: "Here's why Asclion changes the game." },
  "vslgo.pitch": {
    fr: "« Les LGO vous proposent des produits que les labos ont payés pour mettre en avant. Asclion vous propose ce dont le patient a réellement besoin, avec la phrase exacte à dire. Et ça marche sur tous les LGO. »",
    en: '"Pharmacy software suggests products that labs paid to promote. Asclion suggests what the patient actually needs, with the exact phrase to say. And it works on top of any pharmacy software."',
  },
  "vslgo.diff.title": { fr: "Les 7 différenciateurs forts", en: "The 7 key differentiators" },
  "vslgo.diff.subtitle": {
    fr: "Ce qu'Asclion fait, et que les modules conseil intégrés aux LGO ne font pas.",
    en: "What Asclion does, and what built-in pharmacy software advice modules don't.",
  },
  "vslgo.diff.label": { fr: "Différenciateur", en: "Differentiator" },
  "vslgo.classic": { fr: "LGO classique", en: "Classic pharmacy software" },
  "vslgo.table.title": { fr: "Tableau comparatif", en: "Comparison table" },
  "vslgo.table.subtitle": { fr: "Les critères qui comptent vraiment au comptoir.", en: "The criteria that really matter at the counter." },
  "vslgo.table.criteria": { fr: "Critère", en: "Criterion" },
  "vslgo.table.lgo": { fr: "LGO (Winpharma / LGPI)", en: "Pharmacy software (Winpharma / LGPI)" },
  "vslgo.cta.title": { fr: "Voir Asclion en action", en: "See Asclion in action" },
  "vslgo.cta.subtitle": { fr: "10 minutes de démo suffisent pour comprendre la différence.", en: "10 minutes of demo is enough to see the difference." },
  "vslgo.cta.button": { fr: "Demander une démo", en: "Request a demo" },
  "vslgo.footer": { fr: "© Asclion — Le copilote IA des pharmaciens", en: "© Asclion — The AI copilot for pharmacists" },

  // Differentiators
  "vslgo.d1.title": { fr: "Indépendance commerciale = confiance clinique", en: "Commercial independence = clinical trust" },
  "vslgo.d1.lgo": {
    fr: "Les LGO sont financés par les laboratoires : les suggestions sont souvent du référencement sponsorisé.",
    en: "Pharmacy software is funded by labs: suggestions are often sponsored placements.",
  },
  "vslgo.d1.asclion": {
    fr: "Asclion est pharmacien-first. Les recommandations reposent sur la pertinence clinique réelle (molécule, ATC, pathologie), jamais sur un deal marketing.",
    en: "Asclion is pharmacist-first. Recommendations are based on real clinical relevance (molecule, ATC, pathology), never on a marketing deal.",
  },
  "vslgo.d1.pitch": { fr: "« Nous ne vendons pas votre écran aux labos. »", en: '"We don\'t sell your screen to labs."' },

  "vslgo.d2.title": { fr: "Raisonnement IA vs règles figées", en: "AI reasoning vs static rules" },
  "vslgo.d2.lgo": {
    fr: "Table de correspondance CIP → CIP, quelques milliers de règles statiques négociées avec les labos.",
    en: "SKU → SKU lookup table, a few thousand static rules negotiated with labs.",
  },
  "vslgo.d2.asclion": {
    fr: "Pipeline clinique multi-niveaux (Médicament → Molécule → ATC → Pathologie → PC) couvrant des millions de combinaisons, avec détection des interactions et des besoins latents (ex : AINS → protection gastrique).",
    en: "Multi-level clinical pipeline (Drug → Molecule → ATC → Pathology → Counter Product) covering millions of combinations, with interaction detection and latent need detection (e.g. NSAID → gastric protection).",
  },
  "vslgo.d2.pitch": { fr: "Le système comprend la prescription, il ne fait pas que la lire.", en: "The system understands the prescription, it doesn't just read it." },

  "vslgo.d3.title": { fr: "Phrases conseil « prêtes à dire »", en: "Ready-to-say advice phrases" },
  "vslgo.d3.lgo": { fr: "Affiche un nom de produit. Le préparateur doit improviser le discours.", en: "Shows a product name. The technician has to improvise the pitch." },
  "vslgo.d3.asclion": {
    fr: "Phrase complète mi-technique mi-commerciale (15-25 mots) que le préparateur lit ou adapte. Débloque les équipes non-formées au conseil (intérimaires, jeunes diplômés).",
    en: "Complete half-technical, half-commercial phrase (15-25 words) the technician reads or adapts. Unblocks teams not trained for upselling (temps, junior staff).",
  },
  "vslgo.d3.pitch": { fr: "Le conseil est dit, pas seulement affiché.", en: "Advice is spoken, not just displayed." },

  "vslgo.d4.title": { fr: "Multi-caisses synchronisées + benchmark anonymisé", en: "Synced multi-register + anonymous benchmark" },
  "vslgo.d4.lgo": { fr: "KPIs basiques par caisse, aucune comparaison externe.", en: "Basic KPIs per register, no external comparison." },
  "vslgo.d4.asclion": {
    fr: "Benchmark inter-officines anonymisé : « Votre taux de conversion est de 18 %, la médiane du réseau est à 24 %. » Le titulaire dispose d'une vue stratégique sur sa performance conseil.",
    en: 'Anonymous inter-pharmacy benchmark: "Your conversion rate is 18%, the network median is 24%." The owner gets a strategic view of advice performance.',
  },
  "vslgo.d4.pitch": { fr: "Vous savez enfin où vous vous situez.", en: "You finally know where you stand." },

  "vslgo.d5.title": { fr: "Feedback loop qui apprend", en: "Feedback loop that learns" },
  "vslgo.d5.lgo": { fr: "Les règles ne bougent jamais.", en: "Rules never change." },
  "vslgo.d5.asclion": {
    fr: "Chaque clic « Commander » ou « Ignorer » alimente le moteur. Les recommandations s'adaptent à la patientèle locale et aux préférences de l'équipe. Mapping personnalisé par marque partenaire.",
    en: 'Every "Order" or "Skip" click feeds the engine. Recommendations adapt to local clientele and team preferences. Custom mapping per partner brand.',
  },
  "vslgo.d5.pitch": { fr: "Plus vous l'utilisez, plus il devient précis.", en: "The more you use it, the more accurate it gets." },

  "vslgo.d6.title": { fr: "Mode « overlay » non-intrusif", en: "Non-intrusive overlay mode" },
  "vslgo.d6.lgo": { fr: "Il faut cliquer dans plusieurs menus pour voir la suggestion. Résultat : personne ne la voit.", en: "You have to click through several menus to see the suggestion. Result: no one sees it." },
  "vslgo.d6.asclion": {
    fr: "Widget flottant qui apparaît automatiquement quand l'ordonnance est scannée (douchette, dossier surveillé, OCR). Zéro friction = adoption réelle au comptoir.",
    en: "Floating widget that appears automatically when the prescription is scanned (gun, watched folder, OCR). Zero friction = real adoption at the counter.",
  },
  "vslgo.d6.pitch": { fr: "Invisible quand inutile, présent quand nécessaire.", en: "Invisible when unneeded, present when needed." },

  "vslgo.d7.title": { fr: "Indépendance LGO = portabilité", en: "Software independence = portability" },
  "vslgo.d7.lgo": { fr: "Si la pharmacie change de LGO (Winpharma → LGPI), elle perd tout son historique conseil.", en: "If the pharmacy switches software (Winpharma → LGPI), it loses all its advice history." },
  "vslgo.d7.asclion": {
    fr: "Asclion fonctionne par-dessus n'importe quel LGO via API. L'investissement est protégé, l'intelligence conseil reste à la pharmacie.",
    en: "Asclion runs on top of any pharmacy software via API. The investment is protected, the advice intelligence stays with the pharmacy.",
  },
  "vslgo.d7.pitch": { fr: "Votre intelligence conseil vous appartient, pas à votre éditeur LGO.", en: "Your advice intelligence belongs to you, not to your software vendor." },

  // Comparison rows
  "vslgo.row.logic": { fr: "Logique de recommandation", en: "Recommendation logic" },
  "vslgo.row.logic.lgo": { fr: "Règles CIP figées", en: "Static SKU rules" },
  "vslgo.row.logic.asclion": { fr: "IA clinique multi-niveaux", en: "Multi-level clinical AI" },
  "vslgo.row.funding": { fr: "Modèle de financement", en: "Funding model" },
  "vslgo.row.funding.lgo": { fr: "Laboratoires (biais)", en: "Labs (biased)" },
  "vslgo.row.funding.asclion": { fr: "Pharmacie (neutre)", en: "Pharmacy (neutral)" },
  "vslgo.row.phrase": { fr: "Phrase conseil prête à dire", en: "Ready-to-say advice" },
  "vslgo.row.kpi": { fr: "Multi-caisses & KPIs", en: "Multi-register & KPIs" },
  "vslgo.row.kpi.lgo": { fr: "Basique", en: "Basic" },
  "vslgo.row.kpi.asclion": { fr: "Avancé + benchmark anonymisé", en: "Advanced + anonymous benchmark" },
  "vslgo.row.learning": { fr: "Apprentissage continu", en: "Continuous learning" },
  "vslgo.row.portability": { fr: "Portabilité LGO", en: "Software portability" },
  "vslgo.row.portability.asclion": { fr: "Universel (Winpharma, LGPI, Pharmagest, Smart Rx)", en: "Universal (Winpharma, LGPI, Pharmagest, Smart Rx)" },
  "vslgo.row.delay": { fr: "Délai d'analyse", en: "Analysis time" },
  "vslgo.row.delay.lgo": { fr: "Instantané (basique)", en: "Instant (basic)" },
  "vslgo.row.delay.asclion": { fr: "< 2,5 s (raisonnement complet)", en: "< 2.5s (full reasoning)" },
  "vslgo.row.interactions": { fr: "Détection interactions médicamenteuses", en: "Drug interaction detection" },
  "vslgo.row.interactions.lgo": { fr: "Limité", en: "Limited" },
  "vslgo.row.interactions.asclion": { fr: "Complet (majeure / modérée / mineure)", en: "Complete (major / moderate / minor)" },
  "vslgo.row.latent": { fr: "Besoins latents (ex : AINS → IPP)", en: "Latent needs (e.g. NSAID → PPI)" },

  // ===== LEGAL (shared) =====
  "legal.back": { fr: "Retour", en: "Back" },
  "legal.lastUpdate": { fr: "Dernière mise à jour", en: "Last updated" },

  "legal.mentions.title": { fr: "Mentions légales", en: "Legal notice" },
  "legal.mentions.editor": { fr: "Éditeur du site", en: "Site publisher" },
  "legal.mentions.editorIntro": {
    fr: "Le site asclion.com et le logiciel Asclion sont édités par :",
    en: "The asclion.com website and the Asclion software are published by:",
  },
  "legal.mentions.hosting": { fr: "Hébergement", en: "Hosting" },
  "legal.mentions.hostingText": {
    fr: "Le site et les données sont hébergés au sein de l'Union Européenne par les prestataires techniques utilisés par Asclion (Supabase / AWS Europe). Les serveurs applicables se trouvent dans la zone UE. Une liste détaillée peut être obtenue sur simple demande à tanguytubert@gmail.com.",
    en: "The site and data are hosted within the European Union by the technical providers used by Asclion (Supabase / AWS Europe). The relevant servers are located in the EU zone. A detailed list is available upon request at tanguytubert@gmail.com.",
  },
  "legal.mentions.ip": { fr: "Propriété intellectuelle", en: "Intellectual property" },
  "legal.mentions.ipText": {
    fr: "L'ensemble des éléments accessibles sur le site (textes, graphismes, logo, code, base de données clinique) est protégé par le droit d'auteur, le droit des marques et le droit des bases de données. Toute reproduction, représentation, modification ou exploitation, partielle ou intégrale, sans autorisation écrite préalable est interdite.",
    en: "All elements accessible on the site (text, graphics, logo, code, clinical database) are protected by copyright, trademark and database rights. Any reproduction, representation, modification or exploitation, in whole or in part, without prior written authorization is prohibited.",
  },
  "legal.mentions.liability": { fr: "Responsabilité", en: "Liability" },
  "legal.mentions.liabilityText": {
    fr: "Asclion est un outil d'aide à la dispensation destiné aux professionnels de santé. Les suggestions affichées sont fournies à titre informatif et ne se substituent en aucun cas au jugement professionnel du pharmacien, qui demeure seul responsable de la délivrance. Asclion ne réalise aucun diagnostic médical et n'a pas vocation à être qualifié de dispositif médical au sens du règlement (UE) 2017/745.",
    en: "Asclion is a dispensing-support tool for healthcare professionals. The displayed suggestions are provided for informational purposes only and do not replace the professional judgment of the pharmacist, who remains solely responsible for dispensing. Asclion does not perform any medical diagnosis and is not intended to qualify as a medical device under regulation (EU) 2017/745.",
  },
  "legal.mentions.links": { fr: "Liens utiles", en: "Useful links" },

  // ===== DEMO WIDGET =====
  "demo.headerTag": { fr: "Démo", en: "Demo" },
  "demo.closeAria": { fr: "Fermer la démo Asclion", en: "Close Asclion demo" },
  "demo.openAria": { fr: "Ouvrir la démo Asclion", en: "Open Asclion demo" },
  "demo.list.title": { fr: "Démo", en: "Demo" },
  "demo.list.subtitle": { fr: "— choisissez une ordonnance à analyser\n", en: "— pick a sample prescription" },
  "demo.preview.back": { fr: "Retour", en: "Back" },
  "demo.preview.analyze": { fr: "Analyser cette ordonnance", en: "Analyze this prescription" },
  "demo.lead.intro": { fr: "Cette démo vous parle ?", en: "Liked the demo?" },
  "demo.lead.desc": {
    fr: "Asclion s'adapte à votre officine, votre LGO et votre catalogue. Recevez une démo personnalisée — 15 minutes, sans engagement.",
    en: "Asclion adapts to your pharmacy, software and catalog. Get a personalized demo — 15 minutes, no commitment.",
  },
  "demo.lead.skip": { fr: "Passer cette étape, tester une autre ordonnance →", en: "Skip this step, try another prescription →" },
  "demo.lead.namePh": { fr: "Nom", en: "Full name" },
  "demo.lead.officinePh": { fr: "Officine", en: "Pharmacy" },
  "demo.lead.emailPh": { fr: "Email", en: "Email" },
  "demo.lead.submit": { fr: "Être recontacté", en: "Get a callback" },
  "demo.lead.thanks": { fr: "Merci !", en: "Thank you!" },
  "demo.lead.callback": { fr: "Nous vous contactons sous 24h pour une démo personnalisée.", en: "We'll reach out within 24 hours for a personalized demo." },
  "demo.lead.successToast": { fr: "Merci ! Nous vous recontactons rapidement.", en: "Thanks! We'll get back to you soon." },
  "demo.lead.errorToast": { fr: "Une erreur est survenue. Réessayez.", en: "An error occurred. Please try again." },
  "demo.lead.disclaimer": {
    fr: "En soumettant, vous acceptez d'être recontacté par Asclion. Données conservées 12 mois max.",
    en: "By submitting, you agree to be contacted by Asclion. Data kept for max 12 months.",
  },
  "demo.lead.privacyLink": { fr: "Politique de confidentialité", en: "Privacy policy" },
  "demo.lead.dismiss": { fr: "Fermer", en: "Close" },

  // ===== ANALYSIS RESULTS =====
  "results.empty": { fr: "🔍 Aucun médicament reconnu.", en: "🔍 No medication recognized." },
  "results.newAnalysis": { fr: "Nouvelle analyse", en: "New analysis" },
  "results.newPrescription": { fr: "Nouvelle ordonnance", en: "New prescription" },
  "results.interactions": { fr: "Interactions", en: "Interactions" },
  "results.advice": { fr: "Conseil", en: "Advice" },
  "results.complementary": { fr: "Produits complémentaires", en: "Complementary products" },
  "results.priority": { fr: "prioritaire", en: "priority" },
  "results.accepted": { fr: "Accepté", en: "Accepted" },
  "results.accept": { fr: "Accepter", en: "Accept" },
  "results.acceptAria": { fr: "Accepter", en: "Accept" },
  "results.acceptedAria": { fr: "accepté", en: "accepted" },
  "results.acceptedToast": { fr: "accepté", en: "accepted" },
  "results.demoToast": {
    fr: "Démonstration — connectez-vous pour activer l'historique des combinaisons.",
    en: "Demo mode — sign in to enable combination history.",
  },
  "results.productsAccepted": { fr: "produit(s) accepté(s)", en: "product(s) accepted" },
  "results.demoBannerLabel": { fr: "Démonstration · ", en: "Demo · " },
  "results.demoBannerText": {
    fr: "activez votre officine pour analyser vos vraies ordonnances et bénéficier du mapping LGO personnalisé.",
    en: "activate your pharmacy to analyze real prescriptions and benefit from custom software mapping.",
  },
  "results.show": { fr: "Afficher", en: "Show" },
  "results.hide": { fr: "Masquer", en: "Hide" },
  "results.adviceFor": { fr: "le conseil pour", en: "advice for" },
  "results.patientAdviceFor": { fr: "le conseil patient pour", en: "patient advice for" },

  // ===== SKELETON =====
  "skeleton.step1": { fr: "Lecture de l'ordonnance…", en: "Reading the prescription…" },
  "skeleton.step2": { fr: "Recherche clinique…", en: "Clinical lookup…" },
  "skeleton.step3": { fr: "Préparation des suggestions…", en: "Preparing suggestions…" },

  // ===== LEGAL DISCLAIMER =====
  "disclaimer.text": {
    fr: "Les suggestions sont fournies à titre informatif. La décision finale appartient au pharmacien.",
    en: "Suggestions are provided for informational purposes. The final decision belongs to the pharmacist.",
  },

  // ===== SEO META =====
  "seo.landing.title": {
    fr: "Asclion — +800 à 2 000 €/mois de CA pour votre officine",
    en: "Asclion — +€800 to €2,000/mo of extra revenue for your pharmacy",
  },
  "seo.landing.desc": {
    fr: "Copilote IA au comptoir : +880 € de CA additionnel dès le 1ᵉʳ mois chez notre pharmacie pilote. Compatible tous LGO. Garantie résultat ou remboursé.",
    en: "AI counter copilot: +€880 additional revenue in month one at our pilot pharmacy. Works with any pharmacy software. Results-or-refund guarantee.",
  },
  "seo.vslgo.title": {
    fr: "Asclion vs LGO — Comparatif copilote IA pharmacie",
    en: "Asclion vs PMS — AI pharmacy copilot comparison",
  },
  "seo.vslgo.desc": {
    fr: "Asclion vs Winpharma, LGPI, Pharmagest : pourquoi un copilote IA dédié au conseil associé surpasse les modules cross-sell des LGO.",
    en: "Asclion vs Winpharma, LGPI, Pharmagest: why a dedicated AI copilot outperforms the cross-sell modules of traditional pharmacy systems.",
  },
  "seo.aide.title": {
    fr: "Aide — FAQ Asclion pour pharmaciens",
    en: "Help — Asclion FAQ for pharmacists",
  },
  "seo.aide.desc": {
    fr: "Réponses aux questions fréquentes sur Asclion : installation, scanner, surveillance dossier, confidentialité des données patient.",
    en: "Frequently asked questions about Asclion: installation, scanner, folder watching, patient data privacy.",
  },
  "seo.auth.title": {
    fr: "Connexion — Asclion",
    en: "Sign in — Asclion",
  },
  "seo.auth.desc": {
    fr: "Connectez-vous à votre espace Asclion pour accéder au copilote IA de votre pharmacie.",
    en: "Sign in to your Asclion workspace to access your pharmacy's AI copilot.",
  },
  "seo.features.title": {
    fr: "Fonctionnalités Asclion — Toutes les capacités du copilote",
    en: "Asclion Features — Every copilot capability",
  },
  "seo.features.desc": {
    fr: "Découvrez toutes les fonctionnalités d'Asclion : scan douchette, analyse clinique IA, recommandations personnalisées, intégration LGO, dashboard KPI.",
    en: "Discover every Asclion feature: barcode scan, AI clinical analysis, tailored recommendations, PMS integration, KPI dashboard.",
  },
  "seo.legal.mentions.title": {
    fr: "Mentions légales — Asclion",
    en: "Legal notice — Asclion",
  },
  "seo.legal.mentions.desc": {
    fr: "Mentions légales du site Asclion : éditeur, hébergeur, propriété intellectuelle.",
    en: "Legal notice for the Asclion site: publisher, host, intellectual property.",
  },
  "seo.legal.privacy.title": {
    fr: "Politique de confidentialité — Asclion",
    en: "Privacy policy — Asclion",
  },
  "seo.legal.privacy.desc": {
    fr: "Politique de confidentialité d'Asclion : données collectées, finalités, RGPD, droits des utilisateurs et des patients.",
    en: "Asclion privacy policy: data collected, purposes, GDPR, rights of users and patients.",
  },
  "seo.legal.cookies.title": {
    fr: "Gestion des cookies — Asclion",
    en: "Cookie policy — Asclion",
  },
  "seo.legal.cookies.desc": {
    fr: "Gestion des cookies sur asclion.com : cookies nécessaires, mesure d'audience, consentement.",
    en: "Cookie management on asclion.com: necessary cookies, analytics, consent.",
  },
  "seo.legal.terms.title": {
    fr: "Conditions générales d'utilisation — Asclion",
    en: "Terms of service — Asclion",
  },
  "seo.legal.terms.desc": {
    fr: "Conditions générales d'utilisation du logiciel Asclion et du site asclion.com.",
    en: "Terms of service for the Asclion software and the asclion.com website.",
  },
  "seo.legal.dpa.title": {
    fr: "Accord de sous-traitance (DPA) — Asclion",
    en: "Data Processing Agreement (DPA) — Asclion",
  },
  "seo.legal.dpa.desc": {
    fr: "Accord de sous-traitance RGPD entre Asclion et les pharmacies clientes.",
    en: "GDPR Data Processing Agreement between Asclion and client pharmacies.",
  },
  "seo.legal.pia.title": {
    fr: "Analyse d'impact (PIA) — Asclion",
    en: "Data Protection Impact Assessment (DPIA) — Asclion",
  },
  "seo.legal.pia.desc": {
    fr: "Analyse d'impact relative à la protection des données pour le logiciel Asclion.",
    en: "Data Protection Impact Assessment for the Asclion software.",
  },

  // ===== AIDE FAQ (structured data) =====
  "aide.faq.q1": { fr: "Comment installer Asclion ?", en: "How do I install Asclion?" },
  "aide.faq.a1": {
    fr: "Téléchargez le logiciel desktop depuis le site et lancez l'installateur Windows en un clic.",
    en: "Download the desktop app from the website and run the one-click Windows installer.",
  },
  "aide.faq.q2": { fr: "Asclion remplace-t-il mon LGO ?", en: "Does Asclion replace my pharmacy management system?" },
  "aide.faq.a2": {
    fr: "Non, Asclion est un copilote complémentaire qui s'intègre à votre LGO existant (Winpharma, LGPI, Pharmagest).",
    en: "No, Asclion is a complementary copilot that integrates with your existing pharmacy management system (Winpharma, LGPI, Pharmagest).",
  },
  "aide.faq.q3": { fr: "Les données patient sont-elles protégées ?", en: "Is patient data protected?" },
  "aide.faq.a3": {
    fr: "Oui : aucune donnée patient identifiable ne sort de la pharmacie. Seuls des hashes anonymes sont stockés.",
    en: "Yes: no identifiable patient data leaves the pharmacy. Only anonymous hashes are stored.",
  },
} as const;

export type TranslationKey = keyof typeof translations;
