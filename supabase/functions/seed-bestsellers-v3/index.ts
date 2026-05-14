import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Nouvelles molécules manquantes ──
const NEW_MOLECULES = [
  { nom: "Métopimazine", atc: "A04AD05", classe: "Antiémétiques" },
  { nom: "Oxomémazine", atc: "R06AD08", classe: "Antihistaminiques phénothiazines" },
  { nom: "Acétylleucine", atc: "N07CA04", classe: "Antivertigineux" },
  { nom: "Naftidrofuryl", atc: "C04AX21", classe: "Vasodilatateurs périphériques" },
  { nom: "Troxérutine", atc: "C05CA04", classe: "Veinotoniques" },
  { nom: "Diosmine + Hespéridine", atc: "C05CA53", classe: "Veinotoniques" },
  { nom: "Méquitazine", atc: "R06AD07", classe: "Antihistaminiques" },
  { nom: "Lopéramide", atc: "A07DA03", classe: "Antidiarrhéiques" },
  { nom: "Trimébutine", atc: "A03AA05", classe: "Antispasmodiques" },
  { nom: "Nifuroxazide", atc: "A07AX03", classe: "Anti-infectieux intestinaux" },
  { nom: "Flurbiprofène", atc: "M01AE09", classe: "AINS" },
  { nom: "Acide niflumique suppositoire", atc: "M01AX04", classe: "AINS" },
  { nom: "Prednisolone", atc: "H02AB06", classe: "Corticostéroïdes" },
  { nom: "Bétaméthasone cutanée", atc: "D07AC01", classe: "Dermocorticoïdes" },
  { nom: "Econazole cutané", atc: "D01AC03", classe: "Antifongiques locaux" },
  { nom: "Acide fusidique crème", atc: "D06AX01", classe: "Antibiotiques locaux" },
];

// ── Nouveaux médicaments courants manquants ──
const NEW_MEDICAMENTS = [
  { nom: "Vogalène 15mg", molecule: "Métopimazine", atc: "A04AD05", labo: "Recordati", forme: "Gélule", dosage: "15mg", otc: true },
  { nom: "Vogalib 7.5mg lyoc", molecule: "Métopimazine", atc: "A04AD05", labo: "Recordati", forme: "Lyophilisat oral", dosage: "7.5mg", otc: true },
  { nom: "Toplexil sirop", molecule: "Oxomémazine", atc: "R06AD08", labo: "Sanofi", forme: "Sirop", dosage: "0.33mg/ml", otc: true },
  { nom: "Humex Toux Sèche Oxomémazine", molecule: "Oxomémazine", atc: "R06AD08", labo: "URGO", forme: "Sirop", dosage: "0.33mg/ml", otc: true },
  { nom: "Tanganil 500mg", molecule: "Acétylleucine", atc: "N07CA04", labo: "Pierre Fabre", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Praxilène 200mg", molecule: "Naftidrofuryl", atc: "C04AX21", labo: "Merck", forme: "Gélule", dosage: "200mg", otc: false },
  { nom: "Veinamitol 3500mg", molecule: "Troxérutine", atc: "C05CA04", labo: "Negma", forme: "Poudre", dosage: "3500mg", otc: true },
  { nom: "Daflon 500mg", molecule: "Diosmine + Hespéridine", atc: "C05CA53", labo: "Servier", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Daflon 1000mg", molecule: "Diosmine + Hespéridine", atc: "C05CA53", labo: "Servier", forme: "Comprimé", dosage: "1000mg", otc: false },
  { nom: "Primalan 5mg", molecule: "Méquitazine", atc: "R06AD07", labo: "Pierre Fabre", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Imodium 2mg", molecule: "Lopéramide", atc: "A07DA03", labo: "Johnson & Johnson", forme: "Gélule", dosage: "2mg", otc: true },
  { nom: "Imodiumlingual 2mg", molecule: "Lopéramide", atc: "A07DA03", labo: "Johnson & Johnson", forme: "Lyophilisat oral", dosage: "2mg", otc: true },
  { nom: "Débridat 100mg", molecule: "Trimébutine", atc: "A03AA05", labo: "Biocodex", forme: "Comprimé", dosage: "100mg", otc: false },
  { nom: "Ercéfuryl 200mg", molecule: "Nifuroxazide", atc: "A07AX03", labo: "Sanofi", forme: "Gélule", dosage: "200mg", otc: true },
  { nom: "Strefen 8.75mg", molecule: "Flurbiprofène", atc: "M01AE09", labo: "Reckitt", forme: "Pastille", dosage: "8.75mg", otc: true },
  { nom: "Nifluril suppositoire 700mg", molecule: "Acide niflumique suppositoire", atc: "M01AX04", labo: "UPSA", forme: "Suppositoire", dosage: "700mg", otc: false },
  { nom: "Solupred 20mg", molecule: "Prednisolone", atc: "H02AB06", labo: "Sanofi", forme: "Comprimé orodispersible", dosage: "20mg", otc: false },
  { nom: "Solupred 5mg", molecule: "Prednisolone", atc: "H02AB06", labo: "Sanofi", forme: "Comprimé orodispersible", dosage: "5mg", otc: false },
  { nom: "Diprosone crème", molecule: "Bétaméthasone cutanée", atc: "D07AC01", labo: "MSD", forme: "Crème", dosage: "0.05%", otc: false },
  { nom: "Pevaryl 1% crème", molecule: "Econazole cutané", atc: "D01AC03", labo: "Johnson & Johnson", forme: "Crème", dosage: "1%", otc: false },
  { nom: "Pevaryl 1% poudre", molecule: "Econazole cutané", atc: "D01AC03", labo: "Johnson & Johnson", forme: "Poudre", dosage: "1%", otc: false },
  { nom: "Fucidine 2% crème", molecule: "Acide fusidique crème", atc: "D06AX01", labo: "LEO Pharma", forme: "Crème", dosage: "2%", otc: false },
  { nom: "Lysopaïne maux de gorge Ambroxol", molecule: "Ambroxol", atc: "R02AD", labo: "Sanofi", forme: "Pastille", dosage: "20mg", otc: true },
  { nom: "Maxilase Alpha-amylase", molecule: "Alpha-amylase", atc: "R02AD", labo: "Sanofi", forme: "Comprimé", dosage: "3000UI", otc: true },
  { nom: "Gaviscon sachet", molecule: "Alginate de sodium", atc: "A02BX13", labo: "Reckitt", forme: "Suspension buvable", dosage: "10ml", otc: true },
  { nom: "Maalox maux d'estomac", molecule: "Hydroxyde d'aluminium + Magnésium", atc: "A02AD", labo: "Sanofi", forme: "Comprimé à croquer", dosage: "400mg", otc: true },
  { nom: "Forlax 10g", molecule: "Macrogol", atc: "A06AD15", labo: "Ipsen", forme: "Poudre", dosage: "10g", otc: true },
  { nom: "Dulcolax 5mg", molecule: "Bisacodyl", atc: "A06AB02", labo: "Sanofi", forme: "Comprimé", dosage: "5mg", otc: true },
  { nom: "Hémoclar crème", molecule: "Pentosane polysulfate", atc: "C05BA04", labo: "Sanofi", forme: "Crème", dosage: "0.4%", otc: true },
  { nom: "Synthol gel", molecule: "Salicylate de diéthylamine", atc: "M02AC", labo: "GSK", forme: "Gel", dosage: "50g", otc: true },
  { nom: "Voltarène Emulgel 1%", molecule: "Diclofénac topique", atc: "M02AA15", labo: "GSK", forme: "Gel", dosage: "1%", otc: true },
  { nom: "Flector tissugel", molecule: "Diclofénac patch", atc: "M02AA15", labo: "IBSA", forme: "Emplâtre", dosage: "140mg", otc: true },
];

// ── Nouvelles pathologies manquantes ──
const NEW_PATHOLOGIES = [
  { nom: "Nausées et vomissements", categorie: "Gastro-entérologie", gravite: 1, desc: "Sensation de malaise digestif avec ou sans vomissements" },
  { nom: "Vertiges positionnels", categorie: "ORL", gravite: 1, desc: "Sensation vertigineuse lors des changements de position" },
  { nom: "Insuffisance veineuse chronique", categorie: "Vasculaire", gravite: 1, desc: "Mauvais retour veineux avec jambes lourdes et gonflées" },
  { nom: "Mycose cutanée", categorie: "Dermatologie", gravite: 1, desc: "Infection fongique de la peau ou des plis" },
  { nom: "Mycose des pieds", categorie: "Dermatologie", gravite: 1, desc: "Pied d'athlète, intertrigo inter-orteils" },
  { nom: "Piqûre d'insecte", categorie: "Dermatologie", gravite: 1, desc: "Réaction locale inflammatoire suite à une piqûre" },
  { nom: "Otite externe", categorie: "ORL", gravite: 1, desc: "Inflammation du conduit auditif externe" },
  { nom: "Douleur lombaire aiguë", categorie: "Rhumatologie", gravite: 1, desc: "Lumbago, douleur aiguë du bas du dos" },
];

// ── Produits complémentaires avec phrases conseil adaptées ──
const PATHOLOGIE_PRODUITS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number; phrase: string }[]> = {
  "Nausées et vomissements": [
    { produit: "Cocculine granules", categorie: "Homéopathie", desc: "Granules anti-nausées", type: "produit_conseil", prio: 85, phrase: "Ces granules calment les nausées rapidement et vous permettent de retrouver votre confort digestif au quotidien." },
    { produit: "Bracelet anti-nausée Sea-Band", categorie: "Acupression", desc: "Bracelet d'acupression contre les nausées", type: "dispositif_medical", prio: 80, phrase: "Ce bracelet agit par acupression pour réduire les nausées, idéal en voyage ou pendant la grossesse." },
    { produit: "Gingembre gélules", categorie: "Phytothérapie", desc: "Extrait de gingembre anti-nausées", type: "complement", prio: 75, phrase: "Le gingembre est reconnu pour calmer les nausées, une solution naturelle qui fonctionne très bien en complément." },
  ],
  "Vertiges positionnels": [
    { produit: "Magnésium marin 300mg", categorie: "Complément", desc: "Magnésium pour le système nerveux", type: "complement", prio: 80, phrase: "Le magnésium aide votre système nerveux à mieux fonctionner, ce qui peut réduire la fréquence des vertiges." },
    { produit: "Ginkgo biloba gélules", categorie: "Phytothérapie", desc: "Améliore la microcirculation cérébrale", type: "complement", prio: 75, phrase: "Le ginkgo soutient la circulation au niveau cérébral, ce qui améliore l'équilibre et réduit les sensations de vertige." },
  ],
  "Insuffisance veineuse chronique": [
    { produit: "Bas de contention classe 2", categorie: "Contention", desc: "Chaussettes ou bas de compression", type: "dispositif_medical", prio: 90, phrase: "Les bas de contention soulagent vraiment les jambes lourdes et gonflées, surtout en fin de journée ou par temps chaud." },
    { produit: "Vigne rouge gélules", categorie: "Phytothérapie", desc: "Extrait de vigne rouge veinotonique", type: "complement", prio: 85, phrase: "La vigne rouge tonifie les veines naturellement et aide à retrouver des jambes légères au quotidien." },
    { produit: "Gel jambes légères menthol", categorie: "Confort", desc: "Gel rafraîchissant pour les jambes", type: "produit_conseil", prio: 75, phrase: "Ce gel apporte une sensation de fraîcheur immédiate et soulage la lourdeur en fin de journée." },
  ],
  "Mycose cutanée": [
    { produit: "Poudre antifongique Mycoster", categorie: "Antifongique", desc: "Poudre asséchante antifongique", type: "produit_conseil", prio: 85, phrase: "Cette poudre assèche la zone touchée et empêche la mycose de revenir, parfaite en complément de votre crème." },
    { produit: "Savon surgras sans savon", categorie: "Hygiène", desc: "Nettoyant doux respectant la peau", type: "produit_conseil", prio: 75, phrase: "Un nettoyant doux protège votre peau pendant le traitement et évite d'aggraver l'irritation." },
  ],
  "Mycose des pieds": [
    { produit: "Spray assainissant chaussures", categorie: "Hygiène", desc: "Spray désinfectant pour chaussures", type: "produit_conseil", prio: 85, phrase: "Désinfecter vos chaussures évite la réinfection, c'est la clé pour que la mycose ne revienne pas." },
    { produit: "Poudre absorbante pieds", categorie: "Hygiène", desc: "Poudre pour garder les pieds au sec", type: "produit_conseil", prio: 80, phrase: "Garder les pieds au sec avec cette poudre limite la prolifération des champignons et accélère la guérison." },
    { produit: "Chaussettes en coton", categorie: "Conseil textile", desc: "Chaussettes respirantes", type: "produit_conseil", prio: 65, phrase: "Des chaussettes en coton laissent respirer vos pieds et réduisent l'humidité qui favorise les mycoses." },
  ],
  "Piqûre d'insecte": [
    { produit: "Apaisyl gel", categorie: "Anti-démangeaisons", desc: "Gel apaisant après piqûre", type: "produit_conseil", prio: 90, phrase: "Ce gel calme les démangeaisons rapidement et réduit le gonflement dès l'application." },
    { produit: "Roll-on après-piqûres", categorie: "Apaisement", desc: "Roll-on apaisant nomade", type: "produit_conseil", prio: 80, phrase: "Pratique à emporter, ce roll-on soulage immédiatement les démangeaisons en balade ou en vacances." },
    { produit: "Spray répulsif anti-moustiques", categorie: "Prévention", desc: "Répulsif cutané", type: "produit_conseil", prio: 75, phrase: "Pour éviter les prochaines piqûres, ce répulsif offre une protection efficace pendant plusieurs heures." },
  ],
  "Otite externe": [
    { produit: "Spray auriculaire eau de mer", categorie: "Hygiène ORL", desc: "Nettoyant auriculaire doux", type: "dispositif_medical", prio: 80, phrase: "Ce spray nettoie le conduit auditif en douceur et prévient les récidives d'otite, surtout après la baignade." },
    { produit: "Bouchons d'oreilles natation", categorie: "Prévention", desc: "Protection auriculaire étanche", type: "dispositif_medical", prio: 75, phrase: "Ces bouchons protègent vos oreilles de l'eau et réduisent le risque de nouvelles otites à la piscine ou à la mer." },
  ],
  "Douleur lombaire aiguë": [
    { produit: "Ceinture lombaire de soutien", categorie: "Orthopédie", desc: "Maintien lombaire", type: "dispositif_medical", prio: 90, phrase: "Cette ceinture soulage la douleur en soutenant votre dos et vous aide à reprendre vos activités plus vite." },
    { produit: "Patch chauffant ThermaCare", categorie: "Thermothérapie", desc: "Patch auto-chauffant 8h", type: "dispositif_medical", prio: 85, phrase: "La chaleur de ce patch détend les muscles en profondeur et soulage la douleur pendant 8 heures." },
    { produit: "Baume du Tigre rouge", categorie: "Topique", desc: "Baume chauffant traditionnel", type: "produit_conseil", prio: 70, phrase: "Ce baume apporte une chaleur apaisante sur la zone douloureuse et aide à détendre les tensions musculaires." },
  ],
  "Diarrhée aiguë": [
    { produit: "Solution de réhydratation orale (SRO)", categorie: "Réhydratation", desc: "Sachets de réhydratation", type: "dispositif_medical", prio: 90, phrase: "La réhydratation est essentielle en cas de diarrhée, ces sachets compensent les pertes en eau et en sels minéraux." },
  ],
  "Constipation": [
    { produit: "Fibres de psyllium", categorie: "Fibres", desc: "Mucilage régulateur du transit", type: "complement", prio: 85, phrase: "Ces fibres régulent le transit naturellement, elles gonflent dans l'intestin et facilitent les selles en douceur." },
    { produit: "Eau minérale riche en magnésium Hépar", categorie: "Hydratation", desc: "Eau riche en magnésium", type: "produit_conseil", prio: 70, phrase: "Boire cette eau riche en magnésium chaque jour aide à relancer le transit de façon naturelle et douce." },
  ],
  "Herpès labial": [
    { produit: "Patch invisible herpès", categorie: "Protection", desc: "Patch hydrocolloïde bouton de fièvre", type: "dispositif_medical", prio: 85, phrase: "Ce patch protège le bouton de fièvre, accélère la cicatrisation et reste discret toute la journée." },
    { produit: "Stick lèvres protecteur SPF50", categorie: "Prévention", desc: "Protection solaire lèvres", type: "produit_conseil", prio: 70, phrase: "Le soleil déclenche souvent les poussées d'herpès, ce stick protège vos lèvres et réduit les récidives." },
  ],
  "Allergie saisonnière": [
    { produit: "Spray nasal eau de mer hypertonique", categorie: "Lavage nasal", desc: "Décongestion nasale naturelle", type: "dispositif_medical", prio: 85, phrase: "Ce spray décongestionne le nez naturellement et élimine les allergènes, parfait en complément de votre antihistaminique." },
    { produit: "Lunettes anti-pollen", categorie: "Protection", desc: "Lunettes enveloppantes", type: "dispositif_medical", prio: 65, phrase: "Ces lunettes protègent vos yeux des pollens et réduisent les irritations oculaires quand vous sortez." },
  ],
  "Rhume": [
    { produit: "Inhalateur Pérubore", categorie: "Inhalation", desc: "Capsules pour inhalation", type: "produit_conseil", prio: 80, phrase: "L'inhalation dégage les voies respiratoires et vous aide à mieux respirer dès les premiers jours du rhume." },
    { produit: "Mouchoirs à l'aloe vera", categorie: "Confort", desc: "Mouchoirs doux pour le nez", type: "produit_conseil", prio: 60, phrase: "Ces mouchoirs enrichis en aloe vera protègent la peau du nez irrité par les mouchages répétés." },
  ],
  "Aphtes": [
    { produit: "Bain de bouche Eludril", categorie: "Antiseptique buccal", desc: "Solution antiseptique buccale", type: "produit_conseil", prio: 85, phrase: "Ce bain de bouche désinfecte l'aphte et accélère sa disparition, en complément de votre traitement." },
    { produit: "Gel protecteur Hyalugel", categorie: "Protection muqueuse", desc: "Gel buccal à l'acide hyaluronique", type: "dispositif_medical", prio: 80, phrase: "Ce gel forme un film protecteur sur l'aphte, réduit la douleur et favorise la cicatrisation." },
  ],
  "Coup de soleil": [
    { produit: "Spray après-soleil Avène", categorie: "Après-soleil", desc: "Brume apaisante post-soleil", type: "produit_conseil", prio: 85, phrase: "Ce spray calme immédiatement la sensation de brûlure et répare la peau après une exposition trop longue." },
    { produit: "Crème solaire SPF50+", categorie: "Prévention", desc: "Protection solaire haute", type: "produit_conseil", prio: 80, phrase: "Pour éviter que ça se reproduise, une bonne protection solaire est indispensable à chaque exposition." },
  ],
  "Crampes musculaires": [
    { produit: "Magnésium B6 comprimés", categorie: "Complément", desc: "Magnésium + Vitamine B6", type: "complement", prio: 90, phrase: "Le magnésium réduit la fréquence des crampes et la vitamine B6 améliore son absorption par l'organisme." },
    { produit: "Eau riche en bicarbonates", categorie: "Hydratation", desc: "Eau minérale alcaline", type: "produit_conseil", prio: 65, phrase: "Une bonne hydratation avec cette eau riche en minéraux prévient les crampes, surtout après l'effort." },
  ],
};

// ── Liens médicament → pathologie ──
const MED_PATHO_LINKS: Record<string, string[]> = {
  "Vogalène 15mg": ["Nausées et vomissements", "Nausées"],
  "Vogalib 7.5mg lyoc": ["Nausées et vomissements", "Nausées", "Mal des transports"],
  "Toplexil sirop": ["Toux sèche"],
  "Humex Toux Sèche Oxomémazine": ["Toux sèche"],
  "Tanganil 500mg": ["Vertiges positionnels"],
  "Praxilène 200mg": ["Insuffisance veineuse chronique"],
  "Veinamitol 3500mg": ["Insuffisance veineuse chronique"],
  "Daflon 500mg": ["Insuffisance veineuse chronique", "Hémorroïdes"],
  "Daflon 1000mg": ["Insuffisance veineuse chronique", "Hémorroïdes"],
  "Primalan 5mg": ["Allergie saisonnière"],
  "Imodium 2mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Imodiumlingual 2mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Débridat 100mg": ["Ballonnements", "Spasmes intestinaux", "Crampes abdominales"],
  "Ercéfuryl 200mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Strefen 8.75mg": ["Maux de gorge", "Angine"],
  "Nifluril suppositoire 700mg": ["Fièvre", "Douleur modérée", "Inflammation"],
  "Solupred 20mg": ["Inflammation", "Allergie saisonnière", "Asthme"],
  "Solupred 5mg": ["Inflammation", "Allergie saisonnière"],
  "Diprosone crème": ["Eczéma", "Dermatite de contact", "Irritation cutanée"],
  "Pevaryl 1% crème": ["Mycose cutanée", "Mycose des pieds", "Candidose vaginale"],
  "Pevaryl 1% poudre": ["Mycose cutanée", "Mycose des pieds"],
  "Fucidine 2% crème": ["Impétigo", "Infection bactérienne"],
  "Lysopaïne maux de gorge Ambroxol": ["Maux de gorge"],
  "Maxilase Alpha-amylase": ["Maux de gorge", "Angine"],
  "Gaviscon sachet": ["Brûlures d estomac", "Gastrite"],
  "Maalox maux d'estomac": ["Brûlures d estomac", "Gastrite", "Dyspepsie fonctionnelle"],
  "Forlax 10g": ["Constipation", "constipation occasionnelle"],
  "Dulcolax 5mg": ["Constipation"],
  "Hémoclar crème": ["Contusion et ecchymose", "Hématome"],
  "Synthol gel": ["Douleur musculaire", "Entorse", "Courbatures"],
  "Voltarène Emulgel 1%": ["Douleur articulaire", "Entorse", "Douleur musculaire", "Douleur lombaire aiguë"],
  "Flector tissugel": ["Douleur articulaire", "Entorse", "Douleur lombaire aiguë"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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


  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stats = { molecules: 0, medicaments: 0, pathologies: 0, produits: 0, links: 0, protocoles: 0, errors: [] as string[] };

    // Load existing
    const moleculeMap: Record<string, string> = {};
    const { data: mols } = await supabase.from("molecules").select("id, nom_molecule");
    for (const m of mols || []) moleculeMap[m.nom_molecule] = m.id;

    const pathoMap: Record<string, string> = {};
    const { data: pathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const p of pathos || []) pathoMap[p.nom_pathologie] = p.id;

    // 1. Molecules
    for (const mol of NEW_MOLECULES) {
      if (moleculeMap[mol.nom]) continue;
      const { data, error } = await supabase.from("molecules").insert({ nom_molecule: mol.nom, atc_code: mol.atc, classe_therapeutique: mol.classe }).select("id").single();
      if (data) { moleculeMap[mol.nom] = data.id; stats.molecules++; }
      if (error) stats.errors.push(`Mol ${mol.nom}: ${error.message}`);
    }

    // 2. Pathologies
    for (const p of NEW_PATHOLOGIES) {
      if (pathoMap[p.nom]) continue;
      const { data, error } = await supabase.from("pathologies").insert({ nom_pathologie: p.nom, categorie: p.categorie, niveau_gravite: p.gravite, description: p.desc }).select("id").single();
      if (data) { pathoMap[p.nom] = data.id; stats.pathologies++; }
      if (error) stats.errors.push(`Patho ${p.nom}: ${error.message}`);
    }

    // 3. Produits complémentaires + protocoles
    for (const [pathoName, produits] of Object.entries(PATHOLOGIE_PRODUITS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) { stats.errors.push(`Patho introuvable: ${pathoName}`); continue; }

      const { data: existing } = await supabase.from("produits_complementaires").select("produit").eq("pathologie_id", pathoId);
      const existingSet = new Set((existing || []).map(p => p.produit));
      const newIds: string[] = [];

      for (const prod of produits) {
        if (existingSet.has(prod.produit)) continue;
        const { data, error } = await supabase.from("produits_complementaires").insert({
          produit: prod.produit, categorie: prod.categorie, description: prod.desc, type_produit: prod.type,
          priorite: prod.prio, pathologie_id: pathoId, phrase_conseil: prod.phrase,
          est_otc: prod.type === "produit_conseil", est_complement: prod.type === "complement",
          est_dispositif_medical: prod.type === "dispositif_medical", est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) { newIds.push(data.id); stats.produits++; }
        if (error) stats.errors.push(`Prod ${prod.produit}: ${error.message}`);
      }

      // Auto-protocole if needed
      if (newIds.length >= 2) {
        const { data: proto } = await supabase.from("protocole_pathologie").select("id").eq("pathologie_id", pathoId).eq("actif", true).limit(1);
        if (!proto || proto.length === 0) {
          const { data: conseils } = await supabase.from("conseils_associes").select("id").eq("pathologie_id", pathoId);
          const conseilIds = (conseils || []).map(c => c.id);
          if (conseilIds.length === 0) {
            for (const c of [
              { label: `Conseil hygiéno-diététique`, desc: `Mesures générales pour ${pathoName.toLowerCase()}` },
              { label: `Suivi et surveillance`, desc: `Quand reconsulter pour ${pathoName.toLowerCase()}` },
            ]) {
              const { data } = await supabase.from("conseils_associes").insert({ pathologie_id: pathoId, conseil: c.label, description: c.desc, priorite: 80 }).select("id").single();
              if (data) conseilIds.push(data.id);
            }
          }
          if (conseilIds.length >= 2 && newIds.length >= 2) {
            await supabase.from("protocole_pathologie").insert({
              pathologie_id: pathoId, conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
              produit_complementaire_1_id: newIds[0], produit_complementaire_2_id: newIds[1],
              produit_complementaire_3_id: newIds[2] || null, actif: true,
            });
            stats.protocoles++;
          }
        }
      }
    }

    // 4. Médicaments + liens
    for (const med of NEW_MEDICAMENTS) {
      const { data: ex } = await supabase.from("medicaments").select("id").eq("nom_commercial", med.nom).limit(1);
      if (ex && ex.length > 0) continue;

      const { data, error } = await supabase.from("medicaments").insert({
        nom_commercial: med.nom, molecule_id: moleculeMap[med.molecule] || null, atc_code: med.atc,
        laboratoire: med.labo, forme_galenique: med.forme, dosage: med.dosage, est_otc: med.otc,
        est_produit_conseil: med.otc, statut_officine: "actif",
      }).select("id").single();

      if (data) {
        stats.medicaments++;
        for (const pathoName of (MED_PATHO_LINKS[med.nom] || [])) {
          const pathoId = pathoMap[pathoName];
          if (!pathoId) continue;
          const { data: link } = await supabase.from("medicament_pathologie").select("id").eq("medicament_id", data.id).eq("pathologie_id", pathoId).limit(1);
          if (!link || link.length === 0) {
            const { error: le } = await supabase.from("medicament_pathologie").insert({ medicament_id: data.id, pathologie_id: pathoId, score_pertinence: 80, source_mapping: "bestsellers_seed_v3" });
            if (!le) stats.links++;
            else stats.errors.push(`Link: ${le.message}`);
          }
        }
      }
      if (error) stats.errors.push(`Med ${med.nom}: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seed v3: ${stats.medicaments} méds, ${stats.molecules} mols, ${stats.pathologies} pathos, ${stats.produits} produits, ${stats.links} liens, ${stats.protocoles} protocoles`,
      stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
