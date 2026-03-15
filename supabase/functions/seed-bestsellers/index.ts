import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Top-selling French pharmacy medications NOT yet in the database
const NEW_MOLECULES = [
  { nom: "Acétyl-leucine", atc: "N07CA04", classe: "Antivertigineux" },
  { nom: "Alpha-amylase", atc: "A09AA01", classe: "Enzymes digestives" },
  { nom: "Oxomémazine", atc: "R06AD08", classe: "Antihistaminiques sédatifs" },
  { nom: "Acide niflumique", atc: "M01AX02", classe: "AINS" },
  { nom: "Tixocortol", atc: "R01AD07", classe: "Corticoïdes nasaux" },
  { nom: "Métoclopramide", atc: "A03FA01", classe: "Antiémétiques" },
  { nom: "Tramadol", atc: "N02AX02", classe: "Opioïdes faibles" },
  { nom: "Prégabaline", atc: "N03AX16", classe: "Antiépileptiques / Douleur neuropathique" },
  { nom: "Lopéramide", atc: "A07DA03", classe: "Antidiarrhéiques" },
  { nom: "Montelukast", atc: "R03DC03", classe: "Antileucotriène" },
  { nom: "Prednisolone", atc: "H02AB06", classe: "Corticoïdes systémiques" },
  { nom: "Fluoxétine", atc: "N06AB03", classe: "ISRS" },
  { nom: "Sertraline", atc: "N06AB06", classe: "ISRS" },
  { nom: "Lévonorgestrel", atc: "G03AC03", classe: "Contraceptifs progestatifs" },
  { nom: "Éthinylestradiol + Lévonorgestrel", atc: "G03AA07", classe: "Contraceptifs oraux combinés" },
  { nom: "Salbutamol", atc: "R03AC02", classe: "Bronchodilatateurs bêta-2" },
  { nom: "Ambroxol", atc: "R05CB06", classe: "Mucolytiques" },
  { nom: "Trimébutine", atc: "A03AA05", classe: "Antispasmodiques digestifs" },
  { nom: "Ranitidine", atc: "A02BA02", classe: "Anti-H2" },
  { nom: "Dexeryl", atc: "D02AX", classe: "Émollients" },
];

const NEW_MEDICAMENTS = [
  { nom: "Tanganil 500mg", molecule: "Acétyl-leucine", atc: "N07CA04", labo: "Pierre Fabre", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Maxilase maux de gorge", molecule: "Alpha-amylase", atc: "A09AA01", labo: "Sanofi", forme: "Comprimé", dosage: "3000U", otc: true },
  { nom: "Nifluril 250mg", molecule: "Acide niflumique", atc: "M01AX02", labo: "UPSA", forme: "Gélule", dosage: "250mg", otc: false },
  { nom: "Pivalone spray nasal", molecule: "Tixocortol", atc: "R01AD07", labo: "Viatris", forme: "Spray nasal", dosage: "1%", otc: false },
  { nom: "Primperan 10mg", molecule: "Métoclopramide", atc: "A03FA01", labo: "Sanofi", forme: "Comprimé", dosage: "10mg", otc: false },
  { nom: "Tramadol Biogaran 50mg", molecule: "Tramadol", atc: "N02AX02", labo: "Biogaran", forme: "Gélule", dosage: "50mg", otc: false },
  { nom: "Lyrica 150mg", molecule: "Prégabaline", atc: "N03AX16", labo: "Pfizer", forme: "Gélule", dosage: "150mg", otc: false },
  { nom: "Rhinofluimucil", molecule: "Acétylcystéine", atc: "R01AX", labo: "Zambon", forme: "Spray nasal", dosage: "1%", otc: true },
  { nom: "Lamaline", molecule: "Codéine", atc: "N02AA59", labo: "Servier", forme: "Gélule", dosage: "Paracétamol+Opium+Caféine", otc: false },
  { nom: "Singulair 10mg", molecule: "Montelukast", atc: "R03DC03", labo: "MSD", forme: "Comprimé", dosage: "10mg", otc: false },
  { nom: "Solupred 20mg", molecule: "Prednisolone", atc: "H02AB06", labo: "Sanofi", forme: "Comprimé orodispersible", dosage: "20mg", otc: false },
  { nom: "Prozac 20mg", molecule: "Fluoxétine", atc: "N06AB03", labo: "Lilly", forme: "Gélule", dosage: "20mg", otc: false },
  { nom: "Zoloft 50mg", molecule: "Sertraline", atc: "N06AB06", labo: "Pfizer", forme: "Comprimé", dosage: "50mg", otc: false },
  { nom: "Ventoline 100µg", molecule: "Salbutamol", atc: "R03AC02", labo: "GlaxoSmithKline", forme: "Aérosol", dosage: "100µg", otc: false },
  { nom: "Maalox maux d'estomac", molecule: "Ranitidine", atc: "A02AD01", labo: "Sanofi", forme: "Comprimé à croquer", dosage: "400mg", otc: true },
  { nom: "Mucosolvan 30mg", molecule: "Ambroxol", atc: "R05CB06", labo: "Sanofi", forme: "Comprimé", dosage: "30mg", otc: true },
  { nom: "Débridat 100mg", molecule: "Trimébutine", atc: "A03AA05", labo: "Pfizer", forme: "Comprimé", dosage: "100mg", otc: false },
  { nom: "Loperamide Biogaran 2mg", molecule: "Lopéramide", atc: "A07DA03", labo: "Biogaran", forme: "Gélule", dosage: "2mg", otc: true },
  { nom: "Dexeryl crème", molecule: "Dexeryl", atc: "D02AX", labo: "Pierre Fabre", forme: "Crème", dosage: "250g", otc: true },
  { nom: "Xanax 0.25mg", molecule: "Alprazolam", atc: "N05BA12", labo: "Pfizer", forme: "Comprimé", dosage: "0.25mg", otc: false },
  { nom: "Lexomil 6mg", molecule: "Bromazépam", atc: "N05BA08", labo: "Roche", forme: "Comprimé sécable", dosage: "6mg", otc: false },
  { nom: "Tahor 10mg", molecule: "Atorvastatine", atc: "C10AA05", labo: "Pfizer", forme: "Comprimé", dosage: "10mg", otc: false },
  { nom: "Levothyrox 50µg", molecule: "Lévothyroxine", atc: "H03AA01", labo: "Merck", forme: "Comprimé", dosage: "50µg", otc: false },
  { nom: "Levothyrox 75µg", molecule: "Lévothyroxine", atc: "H03AA01", labo: "Merck", forme: "Comprimé", dosage: "75µg", otc: false },
  { nom: "Levothyrox 100µg", molecule: "Lévothyroxine", atc: "H03AA01", labo: "Merck", forme: "Comprimé", dosage: "100µg", otc: false },
  { nom: "Kardégic 160mg", molecule: "Acide acétylsalicylique", atc: "B01AC06", labo: "Sanofi", forme: "Poudre", dosage: "160mg", otc: false },
  { nom: "Plavix 75mg", molecule: "Clopidogrel", atc: "B01AC04", labo: "Sanofi", forme: "Comprimé", dosage: "75mg", otc: false },
  { nom: "Seretide 250/25", molecule: "Fluticasone + Salmétérol", atc: "R03AK06", labo: "GlaxoSmithKline", forme: "Aérosol", dosage: "250/25µg", otc: false },
  { nom: "Spiriva 18µg", molecule: "Tiotropium", atc: "R03BB04", labo: "Boehringer", forme: "Capsule inhalation", dosage: "18µg", otc: false },
  { nom: "Célestène 2mg", molecule: "Bétaméthasone", atc: "H02AB01", labo: "MSD", forme: "Comprimé", dosage: "2mg", otc: false },
];

// New pathologies to add
const NEW_PATHOLOGIES = [
  { nom: "Vertiges", categorie: "Neurologie", gravite: 2, desc: "Sensation de rotation ou d'instabilité" },
  { nom: "Spasmes intestinaux", categorie: "Gastro-entérologie", gravite: 1, desc: "Contractions douloureuses de l'intestin" },
  { nom: "Toux productive", categorie: "Pneumologie", gravite: 1, desc: "Toux avec expectoration de mucus" },
  { nom: "Contraception", categorie: "Gynécologie", gravite: 0, desc: "Prévention de la grossesse" },
  { nom: "Vomissements", categorie: "Gastro-entérologie", gravite: 2, desc: "Éjection forcée du contenu gastrique" },
  { nom: "Sécheresse cutanée", categorie: "Dermatologie", gravite: 1, desc: "Peau sèche, rugueuse, parfois prurigineuse" },
  { nom: "Rhinite aiguë", categorie: "ORL", gravite: 1, desc: "Inflammation aiguë de la muqueuse nasale" },
];

// Pathology → Produits complémentaires
const PATHOLOGIE_PRODUITS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number }[]> = {
  "Vertiges": [
    { produit: "Ginkgo biloba 120mg", categorie: "Microcirculation", desc: "Améliore la circulation cérébrale", type: "complement", prio: 85 },
    { produit: "Magnésium marin B6", categorie: "Équilibre nerveux", desc: "Soutien du système nerveux", type: "complement", prio: 75 },
    { produit: "Bracelet anti-nausée", categorie: "Confort", desc: "Acupression P6 contre les nausées associées", type: "dispositif_medical", prio: 60 },
  ],
  "Spasmes intestinaux": [
    { produit: "Probiotiques Lactibiane", categorie: "Flore intestinale", desc: "Rééquilibrage de la flore digestive", type: "complement", prio: 85 },
    { produit: "Tisane fenouil-menthe", categorie: "Confort digestif", desc: "Apaise les spasmes digestifs", type: "produit_conseil", prio: 75 },
    { produit: "Bouillotte abdominale", categorie: "Confort", desc: "Chaleur apaisante contre les crampes", type: "produit_conseil", prio: 65 },
  ],
  "Toux productive": [
    { produit: "Miel de thym bio", categorie: "Adoucissant gorge", desc: "Apaise les voies respiratoires", type: "produit_conseil", prio: 85 },
    { produit: "Spray nasal eau de mer hypertonique", categorie: "Hygiène nasale", desc: "Décongestionnant nasal naturel", type: "dispositif_medical", prio: 80 },
    { produit: "Pastilles Propolis", categorie: "Gorge", desc: "Antiseptique naturel gorge", type: "produit_conseil", prio: 70 },
  ],
  "Vomissements": [
    { produit: "Solution de réhydratation orale", categorie: "Réhydratation", desc: "Compense les pertes hydriques", type: "produit_conseil", prio: 90 },
    { produit: "Gingembre en gélules", categorie: "Antiémétique naturel", desc: "Réduit les nausées naturellement", type: "complement", prio: 80 },
    { produit: "Coca-Cola dégazéifié", categorie: "Conseil", desc: "Apport en sucre et soulagement", type: "produit_conseil", prio: 60 },
  ],
  "Sécheresse cutanée": [
    { produit: "Crème émolliente Avène XeraCalm", categorie: "Hydratation", desc: "Hydratation intense peaux très sèches", type: "produit_conseil", prio: 90 },
    { produit: "Huile d'amande douce", categorie: "Soin corporel", desc: "Nourrit et protège la peau sèche", type: "produit_conseil", prio: 80 },
    { produit: "Oméga-3 EPA/DHA", categorie: "Nutrition cutanée", desc: "Soutient la barrière lipidique", type: "complement", prio: 70 },
  ],
  "Rhinite aiguë": [
    { produit: "Spray nasal eau de mer isotonique", categorie: "Hygiène nasale", desc: "Lavage nasal doux", type: "dispositif_medical", prio: 90 },
    { produit: "Mouchoirs doux à l'aloe vera", categorie: "Confort", desc: "Évite l'irritation du nez", type: "produit_conseil", prio: 70 },
    { produit: "Inhalateur aux huiles essentielles", categorie: "Décongestion", desc: "Eucalyptus et menthe", type: "produit_conseil", prio: 65 },
  ],
  "Douleur neuropathique": [
    { produit: "Crème capsaïcine", categorie: "Antalgique topique", desc: "Soulagement local de la douleur nerveuse", type: "produit_conseil", prio: 80 },
    { produit: "Complexe vitamines B (B1, B6, B12)", categorie: "Nerf", desc: "Soutien de la gaine de myéline", type: "complement", prio: 85 },
    { produit: "Coussin ergonomique", categorie: "Confort", desc: "Réduction de la pression sur les nerfs", type: "produit_conseil", prio: 60 },
  ],
  "Douleur modérée": [
    { produit: "Patch chauffant ThermaCare", categorie: "Antalgique topique", desc: "Chaleur thérapeutique 8h", type: "dispositif_medical", prio: 85 },
    { produit: "Gel anti-douleur Voltarène", categorie: "AINS topique", desc: "Diclofénac topique anti-inflammatoire", type: "produit_conseil", prio: 80 },
    { produit: "Curcuma + Poivre noir", categorie: "Anti-inflammatoire naturel", desc: "Effet anti-inflammatoire synergique", type: "complement", prio: 70 },
  ],
  "Dépression": [
    { produit: "Millepertuis 300mg", categorie: "Phytothérapie", desc: "Antidépresseur naturel léger (attention interactions)", type: "complement", prio: 75 },
    { produit: "Oméga-3 haute concentration", categorie: "Soutien humeur", desc: "EPA soutient l'équilibre émotionnel", type: "complement", prio: 80 },
    { produit: "Vitamine D3 1000UI", categorie: "Soutien immuno-nerveux", desc: "Souvent déficitaire dans la dépression", type: "complement", prio: 85 },
  ],
  "Hypercholestérolémie": [
    { produit: "Levure de riz rouge", categorie: "Cholestérol", desc: "Monacoline K, statine naturelle", type: "complement", prio: 85 },
    { produit: "Oméga-3 EPA/DHA", categorie: "Cardiovasculaire", desc: "Réduit les triglycérides", type: "complement", prio: 80 },
    { produit: "Phytostérols", categorie: "Cholestérol", desc: "Bloquent l'absorption du cholestérol", type: "complement", prio: 75 },
  ],
  "Asthme": [
    { produit: "Chambre d'inhalation", categorie: "Dispositif", desc: "Améliore l'efficacité de l'aérosol", type: "dispositif_medical", prio: 95 },
    { produit: "Peak flow mètre", categorie: "Surveillance", desc: "Mesure du débit expiratoire de pointe", type: "dispositif_medical", prio: 80 },
    { produit: "Spray nasal eau de mer", categorie: "Hygiène", desc: "Hygiène des voies respiratoires hautes", type: "dispositif_medical", prio: 70 },
  ],
};

// Medication → Pathology mappings
const MED_PATHO_LINKS: Record<string, string[]> = {
  "Tanganil 500mg": ["Vertiges", "Nausées"],
  "Maxilase maux de gorge": ["Maux de gorge", "Angine"],
  "Nifluril 250mg": ["Douleur modérée", "Inflammation", "Douleur articulaire"],
  "Pivalone spray nasal": ["Rhinite aiguë", "Allergie saisonnière", "Congestion nasale"],
  "Primperan 10mg": ["Vomissements", "Nausées", "Gastro-entérite"],
  "Tramadol Biogaran 50mg": ["Douleur modérée", "Lombalgie", "Douleur articulaire"],
  "Lyrica 150mg": ["Douleur neuropathique", "Fibromyalgie", "Épilepsie"],
  "Rhinofluimucil": ["Rhinite aiguë", "Congestion nasale"],
  "Lamaline": ["Douleur modérée", "Lombalgie"],
  "Singulair 10mg": ["Asthme", "Allergie saisonnière"],
  "Solupred 20mg": ["Inflammation", "Allergie saisonnière", "Asthme", "Arthrose"],
  "Prozac 20mg": ["Dépression", "Anxiété"],
  "Zoloft 50mg": ["Dépression", "Anxiété"],
  "Ventoline 100µg": ["Asthme", "BPCO", "Bronchite aiguë"],
  "Maalox maux d'estomac": ["Brûlures d estomac", "Gastrite"],
  "Mucosolvan 30mg": ["Toux productive", "Bronchite aiguë"],
  "Débridat 100mg": ["Spasmes intestinaux", "Ballonnements", "Crampes abdominales"],
  "Loperamide Biogaran 2mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Dexeryl crème": ["Sécheresse cutanée", "Eczéma", "Eczéma léger"],
  "Xanax 0.25mg": ["Anxiété", "Insomnie"],
  "Lexomil 6mg": ["Anxiété", "Insomnie"],
  "Tahor 10mg": ["Hypercholestérolémie"],
  "Levothyrox 50µg": ["Hypothyroïdie"],
  "Levothyrox 75µg": ["Hypothyroïdie"],
  "Levothyrox 100µg": ["Hypothyroïdie"],
  "Kardégic 160mg": ["Hypertension artérielle", "Fibrillation auriculaire"],
  "Plavix 75mg": ["Fibrillation auriculaire", "Angor"],
  "Seretide 250/25": ["Asthme", "BPCO"],
  "Spiriva 18µg": ["BPCO", "Asthme"],
  "Célestène 2mg": ["Inflammation", "Allergie saisonnière"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stats = {
      molecules_created: 0,
      medicaments_created: 0,
      pathologies_created: 0,
      produits_created: 0,
      links_created: 0,
      protocoles_created: 0,
      errors: [] as string[],
    };

    // 1. Upsert molecules
    const moleculeMap: Record<string, string> = {};
    // Load existing molecules
    const { data: existingMols } = await supabase.from("molecules").select("id, nom_molecule");
    for (const m of existingMols || []) {
      moleculeMap[m.nom_molecule] = m.id;
    }

    for (const mol of NEW_MOLECULES) {
      if (!moleculeMap[mol.nom]) {
        const { data, error } = await supabase.from("molecules").insert({
          nom_molecule: mol.nom,
          atc_code: mol.atc,
          classe_therapeutique: mol.classe,
        }).select("id").single();
        if (data) {
          moleculeMap[mol.nom] = data.id;
          stats.molecules_created++;
        }
        if (error) stats.errors.push(`Molecule ${mol.nom}: ${error.message}`);
      }
    }

    // 2. Upsert new pathologies
    const pathoMap: Record<string, string> = {};
    const { data: existingPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const p of existingPathos || []) {
      pathoMap[p.nom_pathologie] = p.id;
    }

    for (const patho of NEW_PATHOLOGIES) {
      if (!pathoMap[patho.nom]) {
        const { data, error } = await supabase.from("pathologies").insert({
          nom_pathologie: patho.nom,
          categorie: patho.categorie,
          niveau_gravite: patho.gravite,
          description: patho.desc,
        }).select("id").single();
        if (data) {
          pathoMap[patho.nom] = data.id;
          stats.pathologies_created++;
        }
        if (error) stats.errors.push(`Pathologie ${patho.nom}: ${error.message}`);
      }
    }

    // 3. Add produits complémentaires for pathologies
    for (const [pathoName, produits] of Object.entries(PATHOLOGIE_PRODUITS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) continue;

      // Check existing products
      const { data: existingProds } = await supabase
        .from("produits_complementaires")
        .select("produit")
        .eq("pathologie_id", pathoId);
      const existingNames = new Set((existingProds || []).map(p => p.produit));

      const conseilIds: string[] = [];
      const produitIds: string[] = [];

      for (const prod of produits) {
        if (existingNames.has(prod.produit)) continue;
        const { data, error } = await supabase.from("produits_complementaires").insert({
          produit: prod.produit,
          categorie: prod.categorie,
          description: prod.desc,
          type_produit: prod.type,
          priorite: prod.prio,
          pathologie_id: pathoId,
          est_otc: prod.type === "produit_conseil",
          est_complement: prod.type === "complement",
          est_dispositif_medical: prod.type === "dispositif_medical",
          est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) {
          produitIds.push(data.id);
          stats.produits_created++;
        }
        if (error) stats.errors.push(`Produit ${prod.produit}: ${error.message}`);
      }

      // Create conseils for new pathologies
      const conseilTemplates = [
        { code: `CONSEIL_${pathoName.toUpperCase().replace(/\s/g, "_")}_1`, label: `Conseil hygiéno-diététique`, desc: `Mesures générales pour ${pathoName.toLowerCase()}` },
        { code: `CONSEIL_${pathoName.toUpperCase().replace(/\s/g, "_")}_2`, label: `Suivi et surveillance`, desc: `Quand reconsulter pour ${pathoName.toLowerCase()}` },
      ];

      const { data: existingConseils } = await supabase
        .from("conseils_associes")
        .select("id, conseil_code")
        .eq("pathologie_id", pathoId);

      if (!existingConseils || existingConseils.length === 0) {
        for (const c of conseilTemplates) {
          const { data, error } = await supabase.from("conseils_associes").insert({
            pathologie_id: pathoId,
            conseil: c.label,
            description: c.desc,
            conseil_code: c.code,
            priorite: 80,
          }).select("id").single();
          if (data) conseilIds.push(data.id);
          if (error) stats.errors.push(`Conseil ${c.code}: ${error.message}`);
        }
      } else {
        for (const c of existingConseils) conseilIds.push(c.id);
      }

      // Create protocole if we have enough data
      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        const { data: existingProto } = await supabase
          .from("protocole_pathologie")
          .select("id")
          .eq("pathologie_id", pathoId)
          .eq("actif", true)
          .limit(1);

        if (!existingProto || existingProto.length === 0) {
          const { error } = await supabase.from("protocole_pathologie").insert({
            pathologie_id: pathoId,
            conseil_1_id: conseilIds[0],
            conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0],
            produit_complementaire_2_id: produitIds[1],
            produit_complementaire_3_id: produitIds[2],
            actif: true,
            version_protocole: 1,
          });
          if (!error) stats.protocoles_created++;
          else stats.errors.push(`Protocole ${pathoName}: ${error.message}`);
        }
      }
    }

    // 4. Create medicaments
    for (const med of NEW_MEDICAMENTS) {
      const { data: existing } = await supabase
        .from("medicaments")
        .select("id")
        .eq("nom_commercial", med.nom)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const moleculeId = moleculeMap[med.molecule] || null;

      const { data, error } = await supabase.from("medicaments").insert({
        nom_commercial: med.nom,
        molecule_id: moleculeId,
        atc_code: med.atc,
        laboratoire: med.labo,
        forme_galenique: med.forme,
        dosage: med.dosage,
        est_otc: med.otc,
        est_produit_conseil: med.otc,
        statut_officine: "actif",
      }).select("id").single();

      if (data) {
        stats.medicaments_created++;

        // 5. Link medicament to pathologies
        const pathologies = MED_PATHO_LINKS[med.nom] || [];
        for (const pathoName of pathologies) {
          const pathoId = pathoMap[pathoName];
          if (!pathoId) {
            stats.errors.push(`Pathologie not found: ${pathoName} for ${med.nom}`);
            continue;
          }

          const { data: existingLink } = await supabase
            .from("medicament_pathologie")
            .select("id")
            .eq("medicament_id", data.id)
            .eq("pathologie_id", pathoId)
            .limit(1);

          if (!existingLink || existingLink.length === 0) {
            const { error: linkError } = await supabase.from("medicament_pathologie").insert({
              medicament_id: data.id,
              pathologie_id: pathoId,
              score_pertinence: 80,
              source_mapping: "bestsellers_seed",
            });
            if (!linkError) stats.links_created++;
            else stats.errors.push(`Link ${med.nom}→${pathoName}: ${linkError.message}`);
          }
        }
      }
      if (error) stats.errors.push(`Medicament ${med.nom}: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seed bestsellers terminé: ${stats.medicaments_created} médicaments, ${stats.molecules_created} molécules, ${stats.pathologies_created} pathologies, ${stats.produits_created} produits, ${stats.links_created} liens, ${stats.protocoles_created} protocoles`,
      stats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
