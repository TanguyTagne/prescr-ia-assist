import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEW_MOLECULES = [
  { nom: "Doxylamine", atc: "R06AA09", classe: "Antihistaminiques sédatifs" },
  { nom: "Racécadotril", atc: "A07XA04", classe: "Antisécrétoires intestinaux" },
  { nom: "Phloroglucinol + Triméthylphloroglucinol", atc: "A03AX", classe: "Antispasmodiques" },
  { nom: "Pseudoéphédrine + Ibuprofène", atc: "R01BA52", classe: "Décongestionnants systémiques" },
  { nom: "Rétinol (Vitamine A)", atc: "D11AH", classe: "Dermatologie" },
  { nom: "Panthenol (Dexpanthénol)", atc: "D02AE", classe: "Protecteurs cutanés" },
  { nom: "Cuivre-Zinc (Sucralfate)", atc: "D02AE", classe: "Protecteurs cutanés" },
  { nom: "Arnica montana", atc: "M02AA", classe: "Anti-inflammatoire homéopathique" },
  { nom: "Anas barbariae", atc: "L03AX", classe: "Homéopathie" },
  { nom: "Trolamine", atc: "D02AE", classe: "Émollients et protecteurs" },
  { nom: "Hexamidine", atc: "R02AA20", classe: "Antiseptiques ORL" },
  { nom: "Biclotymol", atc: "R02AA", classe: "Antiseptiques gorge" },
  { nom: "Acide hyaluronique ophtalmique", atc: "S01XA20", classe: "Larmes artificielles" },
  { nom: "Siméticone + Phloroglucinol", atc: "A03AX", classe: "Antispasmodiques + Antiflatulents" },
];

const NEW_MEDICAMENTS = [
  { nom: "Strepsils Miel Citron", molecule: "Hexamidine", atc: "R02AA20", labo: "Reckitt", forme: "Pastille", dosage: "1.2mg", otc: true },
  { nom: "Drill maux de gorge Tétracaïne", molecule: "Biclotymol", atc: "R02AA", labo: "Pierre Fabre", forme: "Pastille", dosage: "100mg", otc: true },
  { nom: "Hexaspray", molecule: "Biclotymol", atc: "R02AA", labo: "Bouchara-Recordati", forme: "Spray buccal", dosage: "0.75%", otc: true },
  { nom: "Colludol", molecule: "Biclotymol", atc: "R02AA", labo: "Sanofi", forme: "Spray buccal", dosage: "0.5%", otc: true },
  { nom: "Donormyl 15mg", molecule: "Doxylamine", atc: "R06AA09", labo: "UPSA", forme: "Comprimé effervescent", dosage: "15mg", otc: true },
  { nom: "Meteospasmyl", molecule: "Siméticone + Phloroglucinol", atc: "A03AX", labo: "Mayoly Spindler", forme: "Capsule molle", dosage: "60mg+300mg", otc: true },
  { nom: "Tiorfan 100mg", molecule: "Racécadotril", atc: "A07XA04", labo: "Bioprojet", forme: "Gélule", dosage: "100mg", otc: false },
  { nom: "Nurofen Rhume", molecule: "Pseudoéphédrine + Ibuprofène", atc: "R01BA52", labo: "Reckitt", forme: "Comprimé", dosage: "200mg+30mg", otc: true },
  { nom: "Arnigel", molecule: "Arnica montana", atc: "M02AA", labo: "Boiron", forme: "Gel", dosage: "7%", otc: true },
  { nom: "Homéoplasmine", molecule: "Trolamine", atc: "D02AE", labo: "Boiron", forme: "Pommade", dosage: "18g", otc: true },
  { nom: "A313 pommade", molecule: "Rétinol (Vitamine A)", atc: "D11AH", labo: "Pharma Développement", forme: "Pommade", dosage: "200000UI", otc: true },
  { nom: "Cicaplast Baume B5", molecule: "Panthenol (Dexpanthénol)", atc: "D02AE", labo: "La Roche-Posay", forme: "Baume", dosage: "5%", otc: true },
  { nom: "Cicalfate+ crème", molecule: "Cuivre-Zinc (Sucralfate)", atc: "D02AE", labo: "Avène", forme: "Crème", dosage: "100ml", otc: true },
  { nom: "Bepanthen Sensicalm", molecule: "Panthenol (Dexpanthénol)", atc: "D02AE", labo: "Bayer", forme: "Crème", dosage: "50g", otc: true },
  { nom: "Dacryoserum", molecule: "Acide hyaluronique ophtalmique", atc: "S01XA", labo: "Alcon", forme: "Solution ophtalmique", dosage: "5ml", otc: true },
  { nom: "Théalose", molecule: "Acide hyaluronique ophtalmique", atc: "S01XA20", labo: "Théa", forme: "Collyre", dosage: "3%", otc: true },
  { nom: "Spedifen 400mg", molecule: "Ibuprofène", atc: "M01AE01", labo: "Zambon", forme: "Granulé", dosage: "400mg", otc: true },
  { nom: "Antarène 400mg", molecule: "Ibuprofène", atc: "M01AE01", labo: "Elerte", forme: "Comprimé", dosage: "400mg", otc: false },
  { nom: "Bi-Profénid 100mg", molecule: "Kétoprofène", atc: "M01AE03", labo: "Sanofi", forme: "Comprimé LP", dosage: "100mg", otc: false },
  { nom: "Nexium Control 20mg", molecule: "Ésoméprazole", atc: "A02BC05", labo: "GSK", forme: "Comprimé", dosage: "20mg", otc: true },
  { nom: "Oméprazole Biogaran 20mg", molecule: "Oméprazole", atc: "A02BC01", labo: "Biogaran", forme: "Gélule", dosage: "20mg", otc: false },
  { nom: "Pantoprazole Biogaran 20mg", molecule: "Pantoprazole", atc: "A02BC02", labo: "Biogaran", forme: "Comprimé", dosage: "20mg", otc: false },
  { nom: "Smectalia 3g", molecule: "Diosmectite", atc: "A07BC05", labo: "Ipsen", forme: "Poudre", dosage: "3g", otc: true },
  { nom: "Nausicalm 50mg", molecule: "Doxylamine", atc: "R06AA09", labo: "UPSA", forme: "Gélule", dosage: "50mg", otc: true },
  { nom: "Doliprane Liquiz 300mg", molecule: "Paracétamol", atc: "N02BE01", labo: "Sanofi", forme: "Suspension buvable", dosage: "300mg", otc: true },
  { nom: "Efferalgan Codéiné 500mg/30mg", molecule: "Codéine", atc: "N02BE51", labo: "UPSA", forme: "Comprimé effervescent", dosage: "500mg/30mg", otc: false },
];

const NEW_PATHOLOGIES = [
  { nom: "Sécheresse oculaire", categorie: "Ophtalmologie", gravite: 1, desc: "Insuffisance de la production lacrymale" },
  { nom: "Irritation cutanée", categorie: "Dermatologie", gravite: 1, desc: "Rougeurs, tiraillements, desquamation de la peau" },
  { nom: "Gerçures et crevasses", categorie: "Dermatologie", gravite: 1, desc: "Fissures superficielles de la peau" },
  { nom: "Contusion et ecchymose", categorie: "Traumatologie", gravite: 1, desc: "Bleus, bosses suite à un choc" },
  { nom: "Toux sèche", categorie: "Pneumologie", gravite: 1, desc: "Toux non productive irritative" },
  { nom: "Syndrome grippal", categorie: "Infectiologie", gravite: 2, desc: "État fébrile avec courbatures et fatigue" },
];

const PATHOLOGIE_PRODUITS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number }[]> = {
  "Sécheresse oculaire": [
    { produit: "Théalose collyre", categorie: "Larmes artificielles", desc: "Hydratation et protection oculaire", type: "dispositif_medical", prio: 90 },
    { produit: "Compresses oculaires apaisantes", categorie: "Confort oculaire", desc: "Apaise la fatigue et l'irritation des yeux", type: "dispositif_medical", prio: 75 },
    { produit: "Oméga-3 DHA Vision", categorie: "Complément", desc: "Soutient la qualité du film lacrymal", type: "complement", prio: 70 },
  ],
  "Irritation cutanée": [
    { produit: "Cicaplast Baume B5", categorie: "Réparation cutanée", desc: "Baume réparateur multi-usage", type: "produit_conseil", prio: 90 },
    { produit: "Eau thermale Avène spray", categorie: "Apaisement", desc: "Calme et apaise les peaux irritées", type: "produit_conseil", prio: 80 },
    { produit: "Crème au calendula", categorie: "Phytothérapie", desc: "Apaisante et cicatrisante naturelle", type: "produit_conseil", prio: 70 },
  ],
  "Gerçures et crevasses": [
    { produit: "Homéoplasmine pommade", categorie: "Réparation", desc: "Cicatrisation des gerçures et irritations", type: "produit_conseil", prio: 90 },
    { produit: "Stick lèvres réparateur Cicalfate", categorie: "Lèvres", desc: "Protection et réparation des lèvres gercées", type: "produit_conseil", prio: 85 },
    { produit: "Beurre de karité pur", categorie: "Nutrition cutanée", desc: "Nourrit intensément les zones très sèches", type: "produit_conseil", prio: 70 },
  ],
  "Contusion et ecchymose": [
    { produit: "Arnigel gel Arnica", categorie: "Anti-ecchymose", desc: "Gel à l'arnica pour bosses et bleus", type: "produit_conseil", prio: 90 },
    { produit: "Poche de froid réutilisable", categorie: "Cryothérapie", desc: "Application de froid pour réduire l'œdème", type: "dispositif_medical", prio: 85 },
    { produit: "Bande de contention élastique", categorie: "Maintien", desc: "Compression légère de la zone contuse", type: "dispositif_medical", prio: 70 },
  ],
  "Toux sèche": [
    { produit: "Miel de Manuka MGO 250+", categorie: "Adoucissant gorge", desc: "Apaise la gorge irritée naturellement", type: "produit_conseil", prio: 85 },
    { produit: "Pastilles Vicks", categorie: "Gorge", desc: "Effet apaisant sur les voies respiratoires", type: "produit_conseil", prio: 75 },
    { produit: "Humidificateur d'air", categorie: "Confort", desc: "Maintient un taux d'humidité optimal", type: "produit_conseil", prio: 65 },
  ],
  "Syndrome grippal": [
    { produit: "Vitamine C 1000mg", categorie: "Immunité", desc: "Soutient les défenses immunitaires", type: "complement", prio: 85 },
    { produit: "Échinacée gélules", categorie: "Phytothérapie", desc: "Stimulant immunitaire naturel", type: "complement", prio: 80 },
    { produit: "Tisane thym-miel-citron", categorie: "Confort ORL", desc: "Apaise gorge et voies respiratoires", type: "produit_conseil", prio: 75 },
  ],
  "Maux de gorge": [
    { produit: "Spray gorge Propolis", categorie: "Antiseptique naturel", desc: "Désinfection et apaisement de la gorge", type: "produit_conseil", prio: 85 },
    { produit: "Pastilles Strepsils Miel", categorie: "Gorge", desc: "Antiseptique local pour maux de gorge", type: "produit_conseil", prio: 80 },
    { produit: "Miel de thym artisanal", categorie: "Adoucissant", desc: "Propriétés antiseptiques et adoucissantes", type: "produit_conseil", prio: 70 },
  ],
};

const MED_PATHO_LINKS: Record<string, string[]> = {
  "Strepsils Miel Citron": ["Maux de gorge", "Angine"],
  "Drill maux de gorge Tétracaïne": ["Maux de gorge", "Angine"],
  "Hexaspray": ["Maux de gorge", "Angine"],
  "Colludol": ["Maux de gorge"],
  "Donormyl 15mg": ["Insomnie", "insomnie légère"],
  "Meteospasmyl": ["Ballonnements", "Spasmes intestinaux", "Flatulences"],
  "Tiorfan 100mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Nurofen Rhume": ["Syndrome grippal", "Congestion nasale", "Fièvre"],
  "Arnigel": ["Contusion et ecchymose", "Douleur musculaire", "Entorse"],
  "Homéoplasmine": ["Gerçures et crevasses", "Irritation cutanée"],
  "A313 pommade": ["Irritation cutanée", "Sécheresse cutanée", "Acné"],
  "Cicaplast Baume B5": ["Irritation cutanée", "Gerçures et crevasses", "Brûlure légère"],
  "Cicalfate+ crème": ["Irritation cutanée", "Gerçures et crevasses", "Cicatrice"],
  "Bepanthen Sensicalm": ["Eczéma léger", "Irritation cutanée", "Sécheresse cutanée"],
  "Dacryoserum": ["Sécheresse oculaire", "Conjonctivite allergique"],
  "Théalose": ["Sécheresse oculaire"],
  "Spedifen 400mg": ["Douleur légère", "Douleur modérée", "Fièvre", "Céphalées"],
  "Antarène 400mg": ["Douleur modérée", "Inflammation", "Douleur articulaire"],
  "Bi-Profénid 100mg": ["Douleur modérée", "Douleur articulaire", "Lombalgie"],
  "Nexium Control 20mg": ["Brûlures d estomac", "Gastrite"],
  "Oméprazole Biogaran 20mg": ["Brûlures d estomac", "Gastrite"],
  "Pantoprazole Biogaran 20mg": ["Brûlures d estomac", "Gastrite"],
  "Smectalia 3g": ["Diarrhée aiguë", "Gastro-entérite"],
  "Nausicalm 50mg": ["Nausées", "Mal des transports", "Vomissements"],
  "Doliprane Liquiz 300mg": ["Fièvre", "Douleur légère", "Céphalées"],
  "Efferalgan Codéiné 500mg/30mg": ["Douleur modérée", "Toux sèche"],
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

    const stats = { molecules_created: 0, medicaments_created: 0, pathologies_created: 0, produits_created: 0, links_created: 0, protocoles_created: 0, errors: [] as string[] };

    // Load existing data
    const moleculeMap: Record<string, string> = {};
    const { data: existingMols } = await supabase.from("molecules").select("id, nom_molecule");
    for (const m of existingMols || []) moleculeMap[m.nom_molecule] = m.id;

    const pathoMap: Record<string, string> = {};
    const { data: existingPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const p of existingPathos || []) pathoMap[p.nom_pathologie] = p.id;

    // 1. Insert molecules
    for (const mol of NEW_MOLECULES) {
      if (moleculeMap[mol.nom]) continue;
      const { data, error } = await supabase.from("molecules").insert({ nom_molecule: mol.nom, atc_code: mol.atc, classe_therapeutique: mol.classe }).select("id").single();
      if (data) { moleculeMap[mol.nom] = data.id; stats.molecules_created++; }
      if (error) stats.errors.push(`Mol ${mol.nom}: ${error.message}`);
    }

    // 2. Insert pathologies
    for (const p of NEW_PATHOLOGIES) {
      if (pathoMap[p.nom]) continue;
      const { data, error } = await supabase.from("pathologies").insert({ nom_pathologie: p.nom, categorie: p.categorie, niveau_gravite: p.gravite, description: p.desc }).select("id").single();
      if (data) { pathoMap[p.nom] = data.id; stats.pathologies_created++; }
      if (error) stats.errors.push(`Patho ${p.nom}: ${error.message}`);
    }

    // 3. Produits + protocoles
    for (const [pathoName, produits] of Object.entries(PATHOLOGIE_PRODUITS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) continue;

      const { data: existingProds } = await supabase.from("produits_complementaires").select("produit").eq("pathologie_id", pathoId);
      const existingNames = new Set((existingProds || []).map(p => p.produit));
      const produitIds: string[] = [];

      for (const prod of produits) {
        if (existingNames.has(prod.produit)) continue;
        const { data, error } = await supabase.from("produits_complementaires").insert({
          produit: prod.produit, categorie: prod.categorie, description: prod.desc, type_produit: prod.type,
          priorite: prod.prio, pathologie_id: pathoId, est_otc: prod.type === "produit_conseil",
          est_complement: prod.type === "complement", est_dispositif_medical: prod.type === "dispositif_medical", est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) { produitIds.push(data.id); stats.produits_created++; }
        if (error) stats.errors.push(`Prod ${prod.produit}: ${error.message}`);
      }

      // Conseils + protocole
      const { data: existingConseils } = await supabase.from("conseils_associes").select("id").eq("pathologie_id", pathoId);
      const conseilIds: string[] = (existingConseils || []).map(c => c.id);

      if (conseilIds.length === 0) {
        for (const c of [
          { label: `Conseil hygiéno-diététique`, desc: `Mesures générales pour ${pathoName.toLowerCase()}` },
          { label: `Suivi et surveillance`, desc: `Quand reconsulter pour ${pathoName.toLowerCase()}` },
        ]) {
          const { data } = await supabase.from("conseils_associes").insert({ pathologie_id: pathoId, conseil: c.label, description: c.desc, priorite: 80 }).select("id").single();
          if (data) conseilIds.push(data.id);
        }
      }

      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        const { data: existingProto } = await supabase.from("protocole_pathologie").select("id").eq("pathologie_id", pathoId).eq("actif", true).limit(1);
        if (!existingProto || existingProto.length === 0) {
          const { error } = await supabase.from("protocole_pathologie").insert({
            pathologie_id: pathoId, conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0], produit_complementaire_2_id: produitIds[1], produit_complementaire_3_id: produitIds[2], actif: true,
          });
          if (!error) stats.protocoles_created++;
        }
      }
    }

    // 4. Insert medicaments + links
    for (const med of NEW_MEDICAMENTS) {
      const { data: existing } = await supabase.from("medicaments").select("id").eq("nom_commercial", med.nom).limit(1);
      if (existing && existing.length > 0) continue;

      const { data, error } = await supabase.from("medicaments").insert({
        nom_commercial: med.nom, molecule_id: moleculeMap[med.molecule] || null, atc_code: med.atc,
        laboratoire: med.labo, forme_galenique: med.forme, dosage: med.dosage, est_otc: med.otc,
        est_produit_conseil: med.otc, statut_officine: "actif",
      }).select("id").single();

      if (data) {
        stats.medicaments_created++;
        for (const pathoName of (MED_PATHO_LINKS[med.nom] || [])) {
          const pathoId = pathoMap[pathoName];
          if (!pathoId) { stats.errors.push(`Patho not found: ${pathoName}`); continue; }
          const { data: link } = await supabase.from("medicament_pathologie").select("id").eq("medicament_id", data.id).eq("pathologie_id", pathoId).limit(1);
          if (!link || link.length === 0) {
            const { error: le } = await supabase.from("medicament_pathologie").insert({ medicament_id: data.id, pathologie_id: pathoId, score_pertinence: 80, source_mapping: "bestsellers_seed_v2" });
            if (!le) stats.links_created++;
            else stats.errors.push(`Link: ${le.message}`);
          }
        }
      }
      if (error) stats.errors.push(`Med ${med.nom}: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Seed v2: ${stats.medicaments_created} méds, ${stats.molecules_created} mols, ${stats.pathologies_created} pathos, ${stats.produits_created} prods, ${stats.links_created} liens`, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
