import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── NEW MOLECULES + MEDICATIONS + PATHOLOGIES + 3 PRODUITS COMPLÉMENTAIRES ───
// Focus: side-effect mitigation & treatment support
const SEED_DATA = [
  {
    molecule: "Duloxétine",
    atc: "N06AX21",
    classe: "Antidépresseur IRSNA",
    medicaments: ["CYMBALTA 30mg", "CYMBALTA 60mg", "DULOXETINE 30mg"],
    pathologies: ["Dépression", "Douleur neuropathique", "Anxiété"],
    produits: [
      { produit: "Mélatonine 1,9mg", categorie: "Complément alimentaire", desc: "Compense les troubles du sommeil fréquents sous duloxétine", type: "complement", prio: 90, phrase: "La duloxétine peut perturber le sommeil, cette mélatonine vous aidera à retrouver un endormissement naturel." },
      { produit: "Magnésium marin B6", categorie: "Complément alimentaire", desc: "Réduit les crampes et la fatigue induites par les IRSNA", type: "complement", prio: 80, phrase: "Le magnésium aide à réduire la fatigue et les tensions musculaires que peut provoquer votre traitement." },
      { produit: "Bain de bouche hydratant", categorie: "Hygiène bucco-dentaire", desc: "Soulage la sécheresse buccale, effet secondaire fréquent", type: "dispositif_medical", prio: 70, phrase: "La sécheresse buccale est fréquente avec ce médicament, ce bain de bouche hydratant vous apportera un confort immédiat." },
    ],
  },
  {
    molecule: "Venlafaxine",
    atc: "N06AX16",
    classe: "Antidépresseur IRSNA",
    medicaments: ["EFFEXOR LP 37,5mg", "EFFEXOR LP 75mg", "EFFEXOR LP 150mg"],
    pathologies: ["Dépression", "Anxiété"],
    produits: [
      { produit: "Larmes artificielles", categorie: "Ophtalmologie", desc: "Compense la sécheresse oculaire induite par la venlafaxine", type: "dispositif_medical", prio: 90, phrase: "Votre traitement peut assécher les yeux, ces larmes artificielles vous soulageront au quotidien." },
      { produit: "Spray nasal eau de mer hypertonique", categorie: "ORL", desc: "Contrecarre la congestion et sécheresse nasale", type: "dispositif_medical", prio: 75, phrase: "Un spray nasal hypertonique compense la sécheresse des muqueuses liée à votre antidépresseur." },
      { produit: "Complexe oméga-3 EPA/DHA", categorie: "Complément alimentaire", desc: "Les oméga-3 potentialisent l'effet antidépresseur et protègent le cardiovasculaire", type: "complement", prio: 85, phrase: "Les oméga-3 soutiennent votre humeur et protègent votre cœur pendant le traitement." },
    ],
  },
  {
    molecule: "Sertraline",
    atc: "N06AB06",
    classe: "Antidépresseur ISRS",
    medicaments: ["ZOLOFT 25mg", "ZOLOFT 50mg", "SERTRALINE 50mg"],
    pathologies: ["Dépression", "Anxiété", "Trouble obsessionnel compulsif"],
    produits: [
      { produit: "Probiotique Lactobacillus rhamnosus", categorie: "Probiotique", desc: "Réduit les troubles digestifs (nausées, diarrhées) fréquents à l'initiation", type: "complement", prio: 90, phrase: "Les probiotiques atténuent les nausées et troubles digestifs fréquents en début de traitement." },
      { produit: "Gingembre en gélules", categorie: "Phytothérapie", desc: "Anti-nauséeux naturel pour les premières semaines de traitement", type: "complement", prio: 80, phrase: "Le gingembre aide à calmer les nausées que vous pourriez ressentir les premières semaines." },
      { produit: "Gel lubrifiant intime", categorie: "Hygiène intime", desc: "Compense la sécheresse intime, effet secondaire connu des ISRS", type: "dispositif_medical", prio: 70, phrase: "Ce gel intime compense un effet secondaire fréquent de votre traitement, n'hésitez pas à en parler à votre médecin." },
    ],
  },
  {
    molecule: "Prednisone",
    atc: "H02AB07",
    classe: "Corticoïde systémique",
    medicaments: ["CORTANCYL 1mg", "CORTANCYL 5mg", "CORTANCYL 20mg", "PREDNISONE 20mg"],
    pathologies: ["Inflammation", "Polyarthrite rhumatoïde", "Asthme"],
    produits: [
      { produit: "Calcium + Vitamine D3 1000UI", categorie: "Complément alimentaire", desc: "Prévient la déminéralisation osseuse induite par la corticothérapie prolongée", type: "complement", prio: 95, phrase: "Les corticoïdes fragilisent les os, le calcium et la vitamine D protègent votre capital osseux." },
      { produit: "Pansement gastrique (alginate)", categorie: "Gastro-entérologie", desc: "Protège la muqueuse gastrique irritée par les corticoïdes", type: "produit_conseil", prio: 85, phrase: "Ce pansement gastrique protège votre estomac de l'irritation causée par la cortisone." },
      { produit: "Crème hydratante corps riche", categorie: "Dermocosmétique", desc: "Compense l'amincissement cutané et la fragilité de la peau sous corticoïdes", type: "produit_conseil", prio: 75, phrase: "La cortisone fragilise la peau, cette crème riche maintient l'hydratation et l'élasticité cutanée." },
    ],
  },
  {
    molecule: "Méthotrexate",
    atc: "L01BA01",
    classe: "Antimétabolite / Immunomodulateur",
    medicaments: ["METHOTREXATE 2,5mg", "NOVATREX 2,5mg", "IMETH 10mg"],
    pathologies: ["Polyarthrite rhumatoïde", "Psoriasis"],
    produits: [
      { produit: "Acide folique 5mg", categorie: "Complément alimentaire", desc: "Réduit la toxicité du méthotrexate (aphtes, nausées, cytopénies)", type: "complement", prio: 95, phrase: "L'acide folique est indispensable pour réduire les effets secondaires du méthotrexate, à prendre le lendemain de votre prise." },
      { produit: "Bain de bouche apaisant", categorie: "Hygiène bucco-dentaire", desc: "Soulage les aphtes et mucites induites par le méthotrexate", type: "produit_conseil", prio: 80, phrase: "Ce bain de bouche apaise les aphtes fréquents sous méthotrexate et accélère la cicatrisation." },
      { produit: "Crème solaire SPF50+", categorie: "Dermocosmétique", desc: "Protège la peau photosensibilisée par le méthotrexate", type: "produit_conseil", prio: 75, phrase: "Le méthotrexate rend votre peau sensible au soleil, une protection SPF50+ est indispensable." },
    ],
  },
  {
    molecule: "Tamoxifène",
    atc: "L02BA01",
    classe: "Anti-estrogène",
    medicaments: ["NOLVADEX 20mg", "TAMOXIFENE 20mg"],
    pathologies: ["Cancer du sein hormonodépendant"],
    produits: [
      { produit: "Gel vaginal hydratant", categorie: "Hygiène intime", desc: "Soulage la sécheresse vaginale induite par le tamoxifène", type: "dispositif_medical", prio: 90, phrase: "Le tamoxifène provoque souvent une sécheresse intime, ce gel hydratant vous apportera du confort." },
      { produit: "Actifed bouffées de chaleur (sauge)", categorie: "Phytothérapie", desc: "Atténue les bouffées de chaleur fréquentes sous anti-estrogènes", type: "complement", prio: 85, phrase: "La sauge aide à réduire les bouffées de chaleur liées à votre traitement hormonal." },
      { produit: "Complément articulaire (collagène + curcuma)", categorie: "Complément alimentaire", desc: "Réduit les douleurs articulaires, effet secondaire courant", type: "complement", prio: 75, phrase: "Ce complément soulage les douleurs articulaires fréquentes sous tamoxifène." },
    ],
  },
  {
    molecule: "Rivaroxaban",
    atc: "B01AF01",
    classe: "Anticoagulant oral direct",
    medicaments: ["XARELTO 10mg", "XARELTO 15mg", "XARELTO 20mg"],
    pathologies: ["Fibrillation auriculaire", "Thrombose veineuse profonde"],
    produits: [
      { produit: "Brosse à dents souple", categorie: "Hygiène bucco-dentaire", desc: "Réduit les saignements gingivaux sous anticoagulant", type: "produit_conseil", prio: 85, phrase: "Sous anticoagulant, une brosse souple réduit les saignements des gencives." },
      { produit: "Pansement hémostatique", categorie: "Premiers soins", desc: "Permet un contrôle rapide des petits saignements sous anticoagulant", type: "dispositif_medical", prio: 80, phrase: "Ces pansements hémostatiques arrêtent rapidement les petits saignements, utile sous anticoagulant." },
      { produit: "Protecteur gastrique naturel (réglisse DGL)", categorie: "Phytothérapie", desc: "Protège la muqueuse gastrique sans interférer avec l'anticoagulant", type: "complement", prio: 70, phrase: "La réglisse DGL protège votre estomac naturellement sans interagir avec votre anticoagulant." },
    ],
  },
  {
    molecule: "Sitagliptine",
    atc: "A10BH01",
    classe: "Inhibiteur DPP-4",
    medicaments: ["JANUVIA 100mg", "XELEVIA 100mg"],
    pathologies: ["Diabète type 2"],
    produits: [
      { produit: "Crème pieds diabétiques", categorie: "Dermocosmétique", desc: "Prévient les complications cutanées du pied diabétique", type: "produit_conseil", prio: 90, phrase: "Prendre soin de vos pieds est essentiel avec le diabète, cette crème prévient les crevasses et complications." },
      { produit: "Chrome + Cannelle", categorie: "Complément alimentaire", desc: "Aide à la régulation glycémique en complément du traitement", type: "complement", prio: 80, phrase: "Le chrome et la cannelle contribuent à maintenir une glycémie stable en complément de votre traitement." },
      { produit: "Lecteur de glycémie + bandelettes", categorie: "Dispositif médical", desc: "Autocontrôle glycémique pour optimiser le traitement", type: "dispositif_medical", prio: 75, phrase: "Un suivi régulier de votre glycémie vous aide à mieux contrôler votre diabète au quotidien." },
    ],
  },
  {
    molecule: "Empagliflozine",
    atc: "A10BK03",
    classe: "Inhibiteur SGLT2",
    medicaments: ["JARDIANCE 10mg", "JARDIANCE 25mg"],
    pathologies: ["Diabète type 2", "Insuffisance cardiaque"],
    produits: [
      { produit: "Canneberge (cranberry) gélules", categorie: "Phytothérapie", desc: "Prévient les infections urinaires favorisées par la glycosurie des SGLT2", type: "complement", prio: 90, phrase: "Les inhibiteurs SGLT2 augmentent le sucre dans les urines, la canneberge prévient les infections urinaires." },
      { produit: "Gel intime antifongique", categorie: "Hygiène intime", desc: "Prévient les mycoses génitales, effet secondaire connu des SGLT2", type: "produit_conseil", prio: 85, phrase: "Ce gel prévient les mycoses favorisées par votre traitement, un effet secondaire connu et gérable." },
      { produit: "Solution de réhydratation orale", categorie: "Hydratation", desc: "Compense le risque de déshydratation par effet diurétique des SGLT2", type: "produit_conseil", prio: 75, phrase: "Pensez à bien vous hydrater, les SGLT2 augmentent l'élimination urinaire et peuvent déshydrater." },
    ],
  },
  {
    molecule: "Tramadol",
    atc: "N02AX02",
    classe: "Antalgique opioïde faible",
    medicaments: ["TOPALGIC 50mg", "CONTRAMAL LP 100mg", "TRAMADOL 50mg"],
    pathologies: ["Douleur modérée"],
    produits: [
      { produit: "Macrogol (laxatif osmotique)", categorie: "Gastro-entérologie", desc: "Prévient la constipation quasi-systématique sous opioïdes", type: "produit_conseil", prio: 95, phrase: "Le tramadol constipe presque toujours, ce laxatif doux prévient ce désagrément dès le début du traitement." },
      { produit: "Dompéridone 10mg", categorie: "Gastro-entérologie", desc: "Anti-nauséeux pour les nausées fréquentes à l'initiation du tramadol", type: "produit_conseil", prio: 85, phrase: "Si vous avez des nausées les premiers jours, ce médicament les atténuera rapidement." },
      { produit: "Brumisateur d'eau thermale", categorie: "Dermocosmétique", desc: "Soulage les bouffées de chaleur et sueurs liées au tramadol", type: "produit_conseil", prio: 65, phrase: "Ce brumisateur rafraîchit et soulage les bouffées de chaleur que peut provoquer le tramadol." },
    ],
  },
  {
    molecule: "Morphine",
    atc: "N02AA01",
    classe: "Antalgique opioïde fort",
    medicaments: ["SKENAN LP 10mg", "SKENAN LP 30mg", "ACTISKENAN 5mg", "ORAMORPH"],
    pathologies: ["Douleur sévère"],
    produits: [
      { produit: "Macrogol 4000 sachets", categorie: "Gastro-entérologie", desc: "Laxatif systématique obligatoire sous morphiniques", type: "produit_conseil", prio: 98, phrase: "Sous morphine, le laxatif est indispensable dès le premier jour pour prévenir la constipation sévère." },
      { produit: "Spray buccal hydratant", categorie: "Hygiène bucco-dentaire", desc: "Soulage la xérostomie (bouche sèche) sous morphiniques", type: "dispositif_medical", prio: 80, phrase: "La morphine assèche la bouche, ce spray hydratant vous apportera un confort immédiat." },
      { produit: "Antiémétique (métoclopramide)", categorie: "Gastro-entérologie", desc: "Contrôle les nausées et vomissements induits par les opioïdes", type: "produit_conseil", prio: 85, phrase: "Cet antiémétique prévient les nausées des premiers jours de traitement par morphine." },
    ],
  },
  {
    molecule: "Lercanidipine",
    atc: "C08CA13",
    classe: "Inhibiteur calcique",
    medicaments: ["LERCAN 10mg", "LERCAN 20mg", "ZANIDIP 10mg"],
    pathologies: ["Hypertension artérielle"],
    produits: [
      { produit: "Bas de contention classe 2", categorie: "Dispositif médical", desc: "Réduit les œdèmes des chevilles, effet secondaire fréquent des inhibiteurs calciques", type: "dispositif_medical", prio: 90, phrase: "Les inhibiteurs calciques peuvent gonfler les chevilles, ces bas de contention préviennent les œdèmes." },
      { produit: "Gel jambes légères (menthol)", categorie: "Dermocosmétique", desc: "Soulage la sensation de jambes lourdes liée aux œdèmes", type: "produit_conseil", prio: 75, phrase: "Ce gel rafraîchissant soulage la sensation de jambes lourdes que peut provoquer votre antihypertenseur." },
      { produit: "Oméga-3 cardio", categorie: "Complément alimentaire", desc: "Soutien cardiovasculaire en complément du traitement antihypertenseur", type: "complement", prio: 70, phrase: "Les oméga-3 soutiennent votre santé cardiovasculaire en complément de votre traitement." },
    ],
  },
  {
    molecule: "Périndopril",
    atc: "C09AA04",
    classe: "IEC (Inhibiteur de l'enzyme de conversion)",
    medicaments: ["COVERSYL 5mg", "COVERSYL 10mg", "PERINDOPRIL 5mg"],
    pathologies: ["Hypertension artérielle", "Insuffisance cardiaque"],
    produits: [
      { produit: "Pastilles miel-citron apaisantes", categorie: "ORL", desc: "Soulage la toux sèche irritative, effet secondaire classique des IEC", type: "produit_conseil", prio: 90, phrase: "La toux sèche est un effet connu des IEC, ces pastilles apaisent l'irritation de la gorge." },
      { produit: "Sel de régime (chlorure de potassium réduit)", categorie: "Diététique", desc: "Alternative au sel classique pour accompagner le régime hyposodé", type: "produit_conseil", prio: 75, phrase: "Un sel de régime accompagne parfaitement votre traitement antihypertenseur avec un régime pauvre en sel." },
      { produit: "Tensiomètre automatique bras", categorie: "Dispositif médical", desc: "Autocontrôle tensionnel à domicile pour suivi optimal", type: "dispositif_medical", prio: 80, phrase: "Surveiller votre tension à domicile permet d'optimiser votre traitement en concertation avec votre médecin." },
    ],
  },
  {
    molecule: "Losartan",
    atc: "C09CA01",
    classe: "ARA II (Sartan)",
    medicaments: ["COZAAR 50mg", "COZAAR 100mg", "LOSARTAN 50mg"],
    pathologies: ["Hypertension artérielle"],
    produits: [
      { produit: "Potassium alimentaire (banane séchée)", categorie: "Diététique", desc: "Surveillance du potassium important sous sartans (risque hyperkaliémie)", type: "produit_conseil", prio: 70, phrase: "Sous sartan, surveillez votre apport en potassium — demandez conseil à votre médecin." },
      { produit: "Crème solaire visage SPF30", categorie: "Dermocosmétique", desc: "Protection contre la photosensibilité possible des sartans", type: "produit_conseil", prio: 75, phrase: "Certains sartans peuvent rendre la peau sensible au soleil, pensez à vous protéger." },
      { produit: "Coenzyme Q10", categorie: "Complément alimentaire", desc: "Soutien mitochondrial et cardiovasculaire", type: "complement", prio: 80, phrase: "La coenzyme Q10 soutient la fonction cardiaque et l'énergie cellulaire en complément de votre traitement." },
    ],
  },
  {
    molecule: "Furosémide",
    atc: "C03CA01",
    classe: "Diurétique de l'anse",
    medicaments: ["LASILIX 20mg", "LASILIX 40mg", "FUROSEMIDE 40mg"],
    pathologies: ["Insuffisance cardiaque", "Œdèmes"],
    produits: [
      { produit: "Potassium effervescent", categorie: "Complément alimentaire", desc: "Compense la fuite potassique induite par le furosémide", type: "complement", prio: 95, phrase: "Le furosémide fait perdre du potassium, ce complément évite les carences et crampes." },
      { produit: "Magnésium bisglycinate", categorie: "Complément alimentaire", desc: "Compense la fuite en magnésium associée aux diurétiques de l'anse", type: "complement", prio: 85, phrase: "Le magnésium compense les pertes liées à votre diurétique et réduit les crampes." },
      { produit: "Crème pieds hydratante urée 10%", categorie: "Dermocosmétique", desc: "Hydrate la peau déshydratée par l'effet diurétique", type: "produit_conseil", prio: 70, phrase: "L'effet diurétique peut assécher la peau, cette crème à l'urée maintient l'hydratation." },
    ],
  },
  {
    molecule: "Spironolactone",
    atc: "C03DA01",
    classe: "Diurétique épargneur de potassium",
    medicaments: ["ALDACTONE 25mg", "ALDACTONE 50mg", "SPIRONOLACTONE 25mg"],
    pathologies: ["Insuffisance cardiaque", "Hypertension artérielle"],
    produits: [
      { produit: "Crème anti-gynécomastie (émollient apaisant)", categorie: "Dermocosmétique", desc: "Soulage la tension mammaire, effet anti-androgène de la spironolactone", type: "produit_conseil", prio: 80, phrase: "La spironolactone peut provoquer une sensibilité mammaire, cette crème apaise l'inconfort." },
      { produit: "Protecteur gastrique naturel", categorie: "Gastro-entérologie", desc: "Réduit les troubles digestifs occasionnels sous spironolactone", type: "produit_conseil", prio: 70, phrase: "Ce protecteur gastrique soulage les éventuels troubles digestifs liés à votre traitement." },
      { produit: "Tisane drainante sans potassium", categorie: "Phytothérapie", desc: "Hydratation sans apport supplémentaire de potassium (attention hyperkaliémie)", type: "complement", prio: 65, phrase: "Hydratez-vous bien mais évitez les sources de potassium supplémentaires avec ce diurétique." },
    ],
  },
  {
    molecule: "Propranolol",
    atc: "C07AA05",
    classe: "Bêta-bloquant non sélectif",
    medicaments: ["AVLOCARDYL 40mg", "PROPRANOLOL 40mg", "HEMANGIOL"],
    pathologies: ["Hypertension artérielle", "Migraine", "Anxiété"],
    produits: [
      { produit: "Guarana en gélules", categorie: "Complément alimentaire", desc: "Compense la fatigue et l'asthénie induites par les bêta-bloquants", type: "complement", prio: 80, phrase: "Le guarana compense la fatigue que peuvent provoquer les bêta-bloquants, sans pic d'énergie." },
      { produit: "Crème mains chauffante", categorie: "Dermocosmétique", desc: "Soulage le syndrome de Raynaud (mains froides) fréquent sous bêta-bloquants", type: "produit_conseil", prio: 75, phrase: "Les bêta-bloquants peuvent refroidir les extrémités, cette crème chauffante soulage vos mains." },
      { produit: "Glucomètre", categorie: "Dispositif médical", desc: "Surveillance glycémique si patient diabétique (les BB masquent l'hypoglycémie)", type: "dispositif_medical", prio: 70, phrase: "Les bêta-bloquants peuvent masquer les signes d'hypoglycémie, un contrôle régulier est recommandé." },
    ],
  },
  {
    molecule: "Escitalopram",
    atc: "N06AB10",
    classe: "Antidépresseur ISRS",
    medicaments: ["SEROPLEX 5mg", "SEROPLEX 10mg", "SEROPLEX 20mg", "ESCITALOPRAM 10mg"],
    pathologies: ["Dépression", "Anxiété", "Trouble panique"],
    produits: [
      { produit: "Safran en gélules (Saffr'Activ)", categorie: "Phytothérapie", desc: "Potentialise l'effet antidépresseur naturellement, études cliniques positives", type: "complement", prio: 85, phrase: "Le safran a montré des effets positifs sur l'humeur en complément de votre antidépresseur." },
      { produit: "Vitamine D3 2000UI", categorie: "Complément alimentaire", desc: "Carence en vitamine D fréquente chez les patients dépressifs, impact sur l'humeur", type: "complement", prio: 80, phrase: "Un bon niveau de vitamine D contribue à améliorer l'humeur et l'énergie pendant votre traitement." },
      { produit: "Gel lubrifiant intime", categorie: "Hygiène intime", desc: "Compense la baisse de libido et sécheresse intime sous ISRS", type: "dispositif_medical", prio: 70, phrase: "Ce gel peut aider à gérer certains effets secondaires intimes fréquents avec les ISRS." },
    ],
  },
  {
    molecule: "Mirtazapine",
    atc: "N06AX11",
    classe: "Antidépresseur NaSSA",
    medicaments: ["NORSET 15mg", "NORSET 30mg", "MIRTAZAPINE 15mg"],
    pathologies: ["Dépression", "Insomnie"],
    produits: [
      { produit: "Konjac (coupe-faim naturel)", categorie: "Complément alimentaire", desc: "Limite la prise de poids, effet secondaire majeur de la mirtazapine", type: "complement", prio: 90, phrase: "La mirtazapine stimule l'appétit, le konjac vous aide à contrôler la sensation de faim." },
      { produit: "CLA (acide linoléique conjugué)", categorie: "Complément alimentaire", desc: "Aide au maintien de la masse maigre face à la prise de poids iatrogène", type: "complement", prio: 75, phrase: "Ce complément aide à maintenir votre poids de forme pendant le traitement." },
      { produit: "Tisane drainante (bouleau-reine des prés)", categorie: "Phytothérapie", desc: "Favorise l'élimination et réduit la rétention d'eau sous mirtazapine", type: "complement", prio: 70, phrase: "Cette tisane drainante aide à limiter la rétention d'eau que peut provoquer votre antidépresseur." },
    ],
  },
  {
    molecule: "Liraglutide",
    atc: "A10BJ02",
    classe: "Agoniste GLP-1",
    medicaments: ["VICTOZA", "SAXENDA"],
    pathologies: ["Diabète type 2", "Obésité"],
    produits: [
      { produit: "Dompéridone (anti-nauséeux)", categorie: "Gastro-entérologie", desc: "Contrôle les nausées fréquentes à l'initiation des GLP-1", type: "produit_conseil", prio: 90, phrase: "Les nausées sont fréquentes au début, cet anti-nauséeux les atténue pendant la phase d'adaptation." },
      { produit: "Aiguilles pour stylo (31G 6mm)", categorie: "Dispositif médical", desc: "Aiguilles courtes confortables pour l'injection quotidienne", type: "dispositif_medical", prio: 85, phrase: "Ces aiguilles courtes rendent l'injection quotidienne plus confortable et moins douloureuse." },
      { produit: "Multivitamines complet", categorie: "Complément alimentaire", desc: "Compense les carences liées à la réduction alimentaire sous GLP-1", type: "complement", prio: 75, phrase: "En mangeant moins sous ce traitement, un complexe vitamines prévient les carences nutritionnelles." },
    ],
  },
  {
    molecule: "Lithium",
    atc: "N05AN01",
    classe: "Thymorégulateur",
    medicaments: ["TERALITHE 250mg", "TERALITHE LP 400mg"],
    pathologies: ["Trouble bipolaire"],
    produits: [
      { produit: "Sel iodé de table", categorie: "Diététique", desc: "Soutien thyroïdien, le lithium peut induire une hypothyroïdie", type: "produit_conseil", prio: 85, phrase: "Le lithium peut affecter la thyroïde, un apport en iode alimentaire soutient son fonctionnement." },
      { produit: "Crème hydratante corps riche", categorie: "Dermocosmétique", desc: "Combat la sécheresse cutanée et l'acné induites par le lithium", type: "produit_conseil", prio: 80, phrase: "Le lithium peut assécher la peau, cette crème riche maintient votre confort cutané." },
      { produit: "Eau de source embouteillée (1,5L)", categorie: "Hydratation", desc: "Hydratation constante essentielle pour maintenir la lithiémie stable", type: "produit_conseil", prio: 90, phrase: "Boire régulièrement est essentiel sous lithium pour maintenir un taux sanguin stable et éviter la toxicité." },
    ],
  },
  {
    molecule: "Valproate de sodium",
    atc: "N03AG01",
    classe: "Antiépileptique / Thymorégulateur",
    medicaments: ["DEPAKINE 200mg", "DEPAKINE 500mg", "DEPAKINE CHRONO"],
    pathologies: ["Épilepsie", "Trouble bipolaire"],
    produits: [
      { produit: "L-Carnitine", categorie: "Complément alimentaire", desc: "Protège contre l'hépatotoxicité du valproate", type: "complement", prio: 85, phrase: "La L-carnitine protège votre foie des effets du valproate, un complément recommandé." },
      { produit: "Complexe vitamines B", categorie: "Complément alimentaire", desc: "Compense la déplétion en vitamines B induite par les antiépileptiques", type: "complement", prio: 80, phrase: "Les antiépileptiques réduisent les vitamines B, ce complexe prévient les carences." },
      { produit: "Brosse à cheveux douce", categorie: "Hygiène", desc: "Ménage les cheveux fragilisés (alopécie possible sous valproate)", type: "produit_conseil", prio: 70, phrase: "Le valproate peut fragiliser les cheveux, une brosse douce et des soins adaptés les protègent." },
    ],
  },
  {
    molecule: "Clonazépam",
    atc: "N03AE01",
    classe: "Benzodiazépine antiépileptique",
    medicaments: ["RIVOTRIL 2mg", "RIVOTRIL gouttes"],
    pathologies: ["Épilepsie", "Anxiété sévère"],
    produits: [
      { produit: "Mélatonine 1mg libération prolongée", categorie: "Complément alimentaire", desc: "Alternative pour le sevrage progressif et l'amélioration du sommeil", type: "complement", prio: 80, phrase: "La mélatonine aide à améliorer la qualité du sommeil et facilite le sevrage progressif." },
      { produit: "Valériane + Passiflore", categorie: "Phytothérapie", desc: "Soutien anxiolytique naturel pour accompagner la décroissance", type: "complement", prio: 75, phrase: "Ces plantes calmantes soutiennent la relaxation pendant la réduction progressive du traitement." },
      { produit: "Tapis d'acupression", categorie: "Bien-être", desc: "Relaxation musculaire et gestion du stress sans médicament", type: "dispositif_medical", prio: 65, phrase: "Ce tapis stimule la relaxation naturelle et aide à gérer le stress au quotidien." },
    ],
  },
  {
    molecule: "Isotrétinoïne",
    atc: "D10BA01",
    classe: "Rétinoïde systémique",
    medicaments: ["ROACCUTANE 10mg", "ROACCUTANE 20mg", "PROCUTA 40mg", "CURACNE"],
    pathologies: ["Acné sévère"],
    produits: [
      { produit: "Baume à lèvres réparateur (cold cream)", categorie: "Dermocosmétique", desc: "Indispensable contre la chéilite (lèvres sèches), effet constant sous isotrétinoïne", type: "produit_conseil", prio: 98, phrase: "Les lèvres sèchent systématiquement sous Roaccutane, ce baume réparateur est indispensable." },
      { produit: "Larmes artificielles (hyaluronate)", categorie: "Ophtalmologie", desc: "Soulage la sécheresse oculaire sévère sous rétinoïdes", type: "dispositif_medical", prio: 90, phrase: "La sécheresse des yeux est très fréquente, ces larmes artificielles vous soulageront au quotidien." },
      { produit: "Crème hydratante visage non comédogène", categorie: "Dermocosmétique", desc: "Hydratation intense obligatoire pour la xérose cutanée sous isotrétinoïne", type: "produit_conseil", prio: 95, phrase: "Votre peau sera très sèche pendant le traitement, cette crème hydratante non comédogène est essentielle." },
    ],
  },
  {
    molecule: "Doxycycline",
    atc: "J01AA02",
    classe: "Tétracycline",
    medicaments: ["DOXYCYCLINE 100mg", "TOLEXINE 100mg", "DOXYLIS 100mg"],
    pathologies: ["Acné", "Infection bactérienne", "Rosacée"],
    produits: [
      { produit: "Crème solaire SPF50+ légère", categorie: "Dermocosmétique", desc: "Protection obligatoire contre la photosensibilisation des tétracyclines", type: "produit_conseil", prio: 95, phrase: "La doxycycline rend votre peau très sensible au soleil, la protection SPF50+ est obligatoire." },
      { produit: "Probiotique Saccharomyces boulardii", categorie: "Probiotique", desc: "Prévient les diarrhées sous antibiotique à large spectre", type: "complement", prio: 85, phrase: "Ce probiotique protège votre flore intestinale pendant tout le traitement antibiotique." },
      { produit: "Gel anti-reflux", categorie: "Gastro-entérologie", desc: "Prévient l'œsophagite, la doxycycline doit être prise debout avec beaucoup d'eau", type: "produit_conseil", prio: 75, phrase: "Prenez la doxycycline debout avec un grand verre d'eau, ce gel protège votre œsophage." },
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders }

  // ── Admin auth guard ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheckClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminCheckClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = { molecules: 0, medicaments: 0, pathologies: 0, produits: 0, links: 0, errors: [] as string[] };

    // Load existing data maps
    const [molRes, pathoRes] = await Promise.all([
      supabase.from("molecules").select("id, nom_molecule"),
      supabase.from("pathologies").select("id, nom_pathologie"),
    ]);
    const molMap = new Map((molRes.data || []).map((m: any) => [m.nom_molecule.toLowerCase(), m.id]));
    const pathoMap = new Map((pathoRes.data || []).map((p: any) => [p.nom_pathologie.toLowerCase(), p.id]));

    for (const entry of SEED_DATA) {
      try {
        // 1. Upsert molecule
        let moleculeId = molMap.get(entry.molecule.toLowerCase());
        if (!moleculeId) {
          const { data: newMol, error } = await supabase.from("molecules").insert({
            nom_molecule: entry.molecule,
            atc_code: entry.atc,
            classe_therapeutique: entry.classe,
          }).select("id").single();
          if (error) { results.errors.push(`Mol ${entry.molecule}: ${error.message}`); continue; }
          moleculeId = newMol.id;
          molMap.set(entry.molecule.toLowerCase(), moleculeId);
          results.molecules++;
        }

        // 2. Upsert medicaments
        for (const medName of entry.medicaments) {
          const { data: existing } = await supabase.from("medicaments")
            .select("id").ilike("nom_commercial", medName).maybeSingle();
          if (!existing) {
            const { error } = await supabase.from("medicaments").insert({
              nom_commercial: medName,
              molecule_id: moleculeId,
              atc_code: entry.atc,
              est_otc: false,
              est_produit_conseil: false,
            });
            if (!error) results.medicaments++;
          }
        }

        // 3. Process pathologies + produits
        for (const pathoName of entry.pathologies) {
          let pathoId = pathoMap.get(pathoName.toLowerCase());
          if (!pathoId) {
            const { data: newPatho, error } = await supabase.from("pathologies").insert({
              nom_pathologie: pathoName,
              categorie: entry.classe,
            }).select("id").single();
            if (error) { results.errors.push(`Patho ${pathoName}: ${error.message}`); continue; }
            pathoId = newPatho.id;
            pathoMap.set(pathoName.toLowerCase(), pathoId);
            results.pathologies++;
          }

          // Link molecule <-> pathologie
          const { data: existingLink } = await supabase.from("molecule_pathologie")
            .select("id").eq("molecule_id", moleculeId).eq("pathologie_id", pathoId).maybeSingle();
          if (!existingLink) {
            await supabase.from("molecule_pathologie").insert({
              molecule_id: moleculeId,
              pathologie_id: pathoId,
              score_pertinence: 80,
              source_mapping: "seed-phase5",
            });
            results.links++;
          }

          // Insert 3 produits complémentaires (for the FIRST pathology only to avoid duplicates)
          if (pathoName === entry.pathologies[0]) {
            for (const prod of entry.produits) {
              const { data: existingProd } = await supabase.from("produits_complementaires")
                .select("id").eq("produit", prod.produit).eq("pathologie_id", pathoId).maybeSingle();
              if (!existingProd) {
                const { error } = await supabase.from("produits_complementaires").insert({
                  produit: prod.produit,
                  categorie: prod.categorie,
                  description: prod.desc,
                  type_produit: prod.type,
                  priorite: prod.prio,
                  pathologie_id: pathoId,
                  phrase_conseil: prod.phrase,
                  est_eligible_cross_sell: true,
                });
                if (!error) results.produits++;
                else results.errors.push(`Prod ${prod.produit}: ${error.message}`);
              }
            }
          }
        }
      } catch (e) {
        results.errors.push(`${entry.molecule}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
