export type Lang = "fr" | "en";

export const translations = {
  // ===== NAV =====
  "nav.admin": { fr: "Admin", en: "Admin" },
  "nav.dashboard": { fr: "Dashboard", en: "Dashboard" },
  "nav.download": { fr: "Télécharger", en: "Download" },
  "nav.signin": { fr: "Se connecter", en: "Sign in" },
  "nav.signout": { fr: "Déconnexion", en: "Sign out" },

  // ===== LANDING =====
  "landing.badge": { fr: "v0.9 · pharmacies pilotes ouvertes", en: "v0.9 · pilot pharmacies onboarding" },
  "landing.title.line1": { fr: "Le conseil associé,", en: "The right counter advice," },
  "landing.title.line2": { fr: "sans le chercher.", en: "without looking for it." },
  "landing.subtitle": {
    fr: "Asclion lit chaque ordonnance ou médicament scanné, repère ce qui manque vraiment au patient, et écrit la phrase à dire — directement au comptoir, en moins de 3 secondes.",
    en: "Asclion reads every prescription or scanned drug, spots what the patient actually needs, and writes the phrase to say — at the counter, in under 3 seconds.",
  },
  "landing.cta.access": { fr: "Demander un accès", en: "Request access" },
  "landing.cta.vsLgo": { fr: "Asclion vs LGO", en: "Asclion vs LGO" },

  "landing.how.title": { fr: "Comment ça marche", en: "How it works" },
  "landing.how.step1.title": { fr: "Vous scannez.", en: "You scan." },
  "landing.how.step1.desc": {
    fr: "Douchette, dossier surveillé ou saisie clavier. Aucun bouton à cliquer, aucune configuration par poste.",
    en: "Barcode gun, watched folder or keyboard input. No button to click, no per-machine setup.",
  },
  "landing.how.step2.title": { fr: "On lit.", en: "We read." },
  "landing.how.step2.desc": {
    fr: "Reconnaissance de la molécule, de la pathologie probable et des interactions, en moins de 2,5 s.",
    en: "Molecule, likely pathology and interactions recognised, in under 2.5 seconds.",
  },
  "landing.how.step3.title": { fr: "On propose.", en: "We suggest." },
  "landing.how.step3.desc": {
    fr: "Top produits réellement utiles pour ce patient, avec la phrase mi-technique mi-commerciale à dire.",
    en: "Top products that actually help this patient, with the half-clinical half-commercial phrase to say.",
  },

  "landing.access.title": { fr: "Demande de renseignements", en: "Request information" },
  "landing.access.desc": {
    fr: "Remplissez le formulaire ci-dessous, notre équipe vous recontactera dans les plus brefs délais.",
    en: "Fill in the form below, our team will get back to you shortly.",
  },

  // ===== ACCESS FORM =====
  "form.pharmacy_name": { fr: "Nom de la pharmacie *", en: "Pharmacy name *" },
  "form.contact_name": { fr: "Nom du contact *", en: "Contact name *" },
  "form.email": { fr: "Email *", en: "Email *" },
  "form.phone": { fr: "Téléphone", en: "Phone" },
  "form.city": { fr: "Ville", en: "City" },
  "form.lgo": { fr: "LGO utilisé (ex: Winpharma, LGPI...)", en: "Pharmacy software (e.g. Winpharma, LGPI...)" },
  "form.consent": {
    fr: "J'accepte que mes données soient traitées pour répondre à ma demande, conformément à la",
    en: "I agree that my data may be processed to respond to my request, in accordance with the",
  },
  "form.privacy": { fr: "politique de confidentialité", en: "privacy policy" },
  "form.and": { fr: "et aux", en: "and the" },
  "form.terms": { fr: "CGU", en: "Terms of Use" },
  "form.submit": { fr: "Envoyer ma demande d'accès", en: "Send my access request" },
  "form.submitted.title": { fr: "Demande envoyée !", en: "Request sent!" },
  "form.submitted.desc": { fr: "Nous vous contacterons pour créer votre accès.", en: "We will contact you to create your account." },
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
  "vslgo.footer": { fr: "© Asclion — Le conseil associé au comptoir", en: "© Asclion — Counter advice that works" },

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
    fr: "Le site et les données sont hébergés au sein de l'Union Européenne par les prestataires techniques utilisés par Asclion (notamment Lovable, Supabase / AWS Europe). Les serveurs applicables se trouvent dans la zone UE. Une liste détaillée peut être obtenue sur simple demande à contact@asclion.com.",
    en: "The site and data are hosted within the European Union by the technical providers used by Asclion (notably Lovable, Supabase / AWS Europe). The relevant servers are located in the EU zone. A detailed list is available upon request at contact@asclion.com.",
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
  "results.empty": { fr: "Aucun médicament reconnu.", en: "No medication recognized." },
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
    fr: "Asclion — Le conseil associé au comptoir, en moins de 3 secondes",
    en: "Asclion — Counter advice that works, in under 3 seconds",
  },
  "seo.landing.desc": {
    fr: "Asclion lit l'ordonnance ou les médicaments scannés et propose le conseil associé pertinent en moins de 3 secondes. Pour les pharmacies d'officine.",
    en: "Asclion reads the prescription or scanned drugs and suggests the right counter advice in under 3 seconds. Built for community pharmacies.",
  },
  "seo.vslgo.title": {
    fr: "Asclion vs LGO — Comparatif comptoir et conseil associé",
    en: "Asclion vs pharmacy software — Counter advice comparison",
  },
  "seo.vslgo.desc": {
    fr: "Asclion vs Winpharma, LGPI, Pharmagest : pourquoi un outil dédié au conseil associé surpasse les modules cross-sell des LGO.",
    en: "Asclion vs Winpharma, LGPI, Pharmagest: why a dedicated counter-advice tool outperforms the cross-sell modules of traditional pharmacy systems.",
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
    fr: "Connectez-vous à votre espace Asclion.",
    en: "Sign in to your Asclion workspace.",
  },
  "seo.features.title": {
    fr: "Fonctionnalités Asclion — Tout ce que l'outil fait au comptoir",
    en: "Asclion features — Everything the tool does at the counter",
  },
  "seo.features.desc": {
    fr: "Toutes les fonctionnalités d'Asclion : scan douchette, analyse clinique, recommandations personnalisées, intégration LGO, dashboard KPI.",
    en: "Every Asclion feature: barcode scan, clinical analysis, tailored recommendations, PMS integration, KPI dashboard.",
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
    fr: "Non, Asclion vient en complément et s'intègre à votre LGO existant (Winpharma, LGPI, Pharmagest).",
    en: "No, Asclion is a complement that integrates with your existing pharmacy management system (Winpharma, LGPI, Pharmagest).",
  },
  "aide.faq.q3": { fr: "Les données patient sont-elles protégées ?", en: "Is patient data protected?" },
  "aide.faq.a3": {
    fr: "Oui : aucune donnée patient identifiable ne sort de la pharmacie. Seuls des hashes anonymes sont stockés.",
    en: "Yes: no identifiable patient data leaves the pharmacy. Only anonymous hashes are stored.",
  },
} as const;

export type TranslationKey = keyof typeof translations;
