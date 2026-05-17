import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── ATC-to-pathologie mapping for auto-deduction ──
const ATC_PATHO_MAP: Record<string, string[]> = {
  // Antalgiques
  "N02B": ["Douleur légère à modérée", "Fièvre", "Céphalée de tension"],
  "N02BE": ["Douleur légère à modérée", "Fièvre", "Céphalée de tension"],
  "N02A": ["Douleur neuropathique", "Névralgie"],
  "N02C": ["Migraine", "Céphalée de tension"],
  // AINS
  "M01A": ["Douleur légère à modérée", "Inflammation", "Douleur articulaire"],
  "M01AE": ["Douleur légère à modérée", "Inflammation", "Fièvre", "Douleur articulaire"],
  "M01AB": ["Douleur légère à modérée", "Inflammation", "Douleur articulaire"],
  // Gastro
  "A02BC": ["reflux gastro-œsophagien léger", "Brûlures d'estomac", "Gastrite"],
  "A02B": ["reflux gastro-œsophagien léger", "Brûlures d'estomac", "Gastrite"],
  "A02A": ["Brûlures d'estomac", "Gastrite"],
  "A02BX": ["reflux gastro-œsophagien léger", "Brûlures d'estomac"],
  "A03": ["Ballonnements", "Douleur abdominale", "Colique du nourrisson"],
  "A07": ["Diarrhée aiguë", "Gastro-entérite"],
  "A06": ["Constipation occasionnelle", "Constipation chronique"],
  // Antibiotiques
  "J01": ["Infection bactérienne"],
  "J01CA": ["Infection bactérienne", "Angine bactérienne"],
  "J01CR": ["Infection bactérienne", "Angine bactérienne", "Sinusite aiguë"],
  "J01FA": ["Infection bactérienne", "Angine bactérienne"],
  "J01XE": ["Infection urinaire", "Cystite"],
  "J01XX": ["Infection urinaire", "Cystite"],
  // Respiratoire
  "R05": ["Toux sèche", "Toux grasse"],
  "R05CB": ["Toux grasse"],
  "R05DA": ["Toux sèche"],
  "R01": ["Rhinite allergique", "Rhume", "Congestion nasale"],
  "R06": ["Rhinite allergique", "Allergie cutanée"],
  "R03": ["Asthme", "BPCO"],
  "R03BA": ["Asthme"],
  "R03AC": ["Asthme", "BPCO"],
  // Cardio
  "C09": ["Hypertension artérielle"],
  "C07": ["Hypertension artérielle", "Angor"],
  "C08": ["Hypertension artérielle"],
  "C03": ["Hypertension artérielle", "Oedème", "Insuffisance cardiaque"],
  "C01": ["Insuffisance cardiaque", "Angor"],
  "C10": ["Hypercholestérolémie", "Syndrome métabolique"],
  "B01": ["Fibrillation auriculaire"],
  "B01AF": ["Fibrillation auriculaire"],
  // Diabète
  "A10B": ["Diabète type 2", "Syndrome métabolique"],
  "A10BA": ["Diabète type 2"],
  "A10BB": ["Diabète type 2"],
  "A10BK": ["Diabète type 2", "Insuffisance cardiaque"],
  "A10A": ["Diabète type 1"],
  // Neuro/psy
  "N05B": ["Stress et anxiété légère", "Troubles du sommeil légers"],
  "N05C": ["Troubles du sommeil légers", "Insomnie occasionnelle"],
  "N06A": ["Dépression"],
  "N06AB": ["Dépression", "Stress et anxiété légère"],
  "N06AX": ["Dépression"],
  "N03": ["Épilepsie"],
  "N04": ["Maladie de Parkinson"],
  // Dermatologie
  "D07": ["Eczéma", "Dermatite atopique", "Irritation cutanée"],
  "D01": ["Mycose cutanée", "Mycose des pieds"],
  "D06": ["Acné légère", "Infection cutanée"],
  "D10": ["Acné légère"],
  // Uro
  "G04B": ["Hyperplasie bénigne de la prostate", "Hypertrophie bénigne de prostate"],
  "G04BD": ["Incontinence urinaire"],
  // Thyroïde
  "H03A": ["Hypothyroïdie"],
  "H03B": ["Hyperthyroïdie"],
  // Ophtalmologie
  "S01": ["Sécheresse oculaire", "Conjonctivite", "Glaucome"],
  "S01XA": ["Sécheresse oculaire"],
  "S01AA": ["Conjonctivite"],
  // ORL
  "R02": ["Mal de gorge"],
  // Musculo-squelettique
  "M05B": ["Ostéoporose"],
  "M04": ["Goutte"],
  "M02": ["Douleur articulaire", "Tendinite"],
  "M03": ["Contracture musculaire"],
  // Anémie / sang
  "B03": ["Fatigue et asthénie", "Anémie"],
  "B03A": ["Fatigue et asthénie", "Anémie"],
  "B02": ["Hémorroïdes"],
  // Hormones
  "G03": ["Ménopause", "Pré-ménopause"],
  "G02CB": ["Hyperprolactinémie"],
  "H02": ["Inflammation", "Insuffisance surrénalienne"],
  // Vitamines / suppléments
  "A11": ["Fatigue et asthénie"],
  "A12": ["Fatigue et asthénie", "Stress et anxiété légère"],
  // Anti-parasitaires
  "P02": ["Parasitose intestinale"],
  // Anti-diarrhéiques spécifiques
  "A07DA": ["Diarrhée aiguë"],
  "A07EC": ["Maladie de Crohn", "Rectocolite hémorragique"],
  // Hémorroïdes
  "C05": ["Hémorroïdes", "Insuffisance veineuse"],
  // Antispasmodiques
  "A03B": ["Douleur abdominale", "Colique du nourrisson"],
};

// ── Generic conseils for pathologies without specific ones ──
const GENERIC_CONSEILS: Record<string, { code: string; label: string; desc: string }[]> = {
  "Douleur": [
    { code: "DLR_REPOS", label: "Repos et récupération", desc: "Privilégier le repos, éviter les efforts excessifs" },
    { code: "DLR_HYDRA", label: "Hydratation régulière", desc: "Boire au moins 1.5L d'eau par jour" },
  ],
  "Infection": [
    { code: "INF_HYGIENE", label: "Hygiène stricte", desc: "Lavage des mains fréquent, éviter la propagation" },
    { code: "INF_HYDRA", label: "Hydratation abondante", desc: "Boire beaucoup d'eau et de liquides chauds" },
  ],
  "Gastro": [
    { code: "GAS_ALIM", label: "Alimentation adaptée", desc: "Repas légers, éviter les aliments gras, acides et épicés" },
    { code: "GAS_FRAC", label: "Fractionner les repas", desc: "Manger en petites quantités, éviter de se coucher après le repas" },
  ],
  "Cardio": [
    { code: "CAR_OBSERV", label: "Observance du traitement", desc: "Ne jamais interrompre le traitement sans avis médical" },
    { code: "CAR_HYGIENE", label: "Hygiène de vie", desc: "Activité physique modérée, régime pauvre en sel" },
  ],
  "Psy": [
    { code: "PSY_OBSERV", label: "Observance et patience", desc: "L'effet du traitement peut prendre 2 à 4 semaines" },
    { code: "PSY_HYGIENE", label: "Hygiène de vie", desc: "Sommeil régulier, activité physique, éviter l'alcool" },
  ],
  "Dermato": [
    { code: "DRM_HYDRA", label: "Hydratation cutanée", desc: "Appliquer un émollient quotidiennement" },
    { code: "DRM_SOLEIL", label: "Protection solaire", desc: "Éviter l'exposition solaire directe sur les zones traitées" },
  ],
  "Respi": [
    { code: "RSP_AERO", label: "Aérer le logement", desc: "Aérer 10 min/jour, éviter les irritants (tabac, poussière)" },
    { code: "RSP_HYDRA", label: "Hydratation des muqueuses", desc: "Humidifier l'air, boire régulièrement" },
  ],
  "Default": [
    { code: "GEN_SUIVI", label: "Suivi médical", desc: "Consulter si les symptômes persistent au-delà de 5 jours" },
    { code: "GEN_OBSERV", label: "Observance thérapeutique", desc: "Respecter la posologie et la durée du traitement prescrit" },
  ],
};

// ── Generic produits by category ──
const GENERIC_PRODUITS: Record<string, { nom: string; type: string; cat: string; prio: number }[]> = {
  "Douleur": [
    { nom: "Baume du Tigre", type: "produit_conseil", cat: "Topique antalgique", prio: 90 },
    { nom: "Poche de froid/chaud", type: "dispositif_medical", cat: "Thermothérapie", prio: 70 },
    { nom: "Arnica Montana granules", type: "homeopathie", cat: "Homéopathie", prio: 50 },
  ],
  "Infection": [
    { nom: "Probiotiques (Lactibiane)", type: "complement", cat: "Probiotiques", prio: 90 },
    { nom: "Vitamine C 500mg", type: "complement", cat: "Vitamines", prio: 70 },
    { nom: "Spray assainissant", type: "produit_conseil", cat: "Hygiène", prio: 50 },
  ],
  "Gastro": [
    { nom: "Probiotiques intestinaux", type: "complement", cat: "Probiotiques", prio: 90 },
    { nom: "Charbon végétal activé", type: "complement", cat: "Confort digestif", prio: 70 },
    { nom: "Tisane digestive (fenouil-anis)", type: "produit_conseil", cat: "Phytothérapie", prio: 50 },
  ],
  "Cardio": [
    { nom: "Oméga-3 EPA/DHA", type: "complement", cat: "Compléments cardiovasculaires", prio: 90 },
    { nom: "Coenzyme Q10", type: "complement", cat: "Antioxydants", prio: 70 },
    { nom: "Magnésium marin", type: "complement", cat: "Minéraux", prio: 50 },
  ],
  "Psy": [
    { nom: "Magnésium marin B6", type: "complement", cat: "Stress et sommeil", prio: 90 },
    { nom: "Mélatonine 1.9mg", type: "complement", cat: "Sommeil", prio: 70 },
    { nom: "Huile essentielle lavande", type: "produit_conseil", cat: "Aromathérapie", prio: 50 },
  ],
  "Dermato": [
    { nom: "Crème émolliente (Dexeryl)", type: "produit_conseil", cat: "Émollients", prio: 90 },
    { nom: "Cicaplast Baume B5", type: "produit_conseil", cat: "Réparation cutanée", prio: 70 },
    { nom: "Huile de coco bio", type: "produit_conseil", cat: "Hydratation naturelle", prio: 50 },
  ],
  "Respi": [
    { nom: "Spray nasal eau de mer hypertonique", type: "dispositif_medical", cat: "Hygiène nasale", prio: 90 },
    { nom: "Pastilles gorge miel-citron", type: "produit_conseil", cat: "ORL", prio: 70 },
    { nom: "Inhaleur aux huiles essentielles", type: "produit_conseil", cat: "Aromathérapie", prio: 50 },
  ],
  "Default": [
    { nom: "Multivitamines", type: "complement", cat: "Vitamines", prio: 90 },
    { nom: "Magnésium + B6", type: "complement", cat: "Minéraux", prio: 70 },
    { nom: "Probiotiques", type: "complement", cat: "Probiotiques", prio: 50 },
  ],
};

function getCategoryFromPathologie(name: string): string {
  const n = name.toLowerCase();
  if (/douleur|articulaire|tendinite|contracture|arthrose|rhumat|spondyl|névralg|migraine|céphal|goutte/.test(n)) return "Douleur";
  if (/infect|bactéri|angine|cystite|urinaire|pneumoni/.test(n)) return "Infection";
  if (/gastri|reflux|brûlure|diarr|constip|ballon|digest|côlon|crohn|colite|nausée|vomiss|colique|abdomi/.test(n)) return "Gastro";
  if (/hypertens|cardio|cardiaqu|cholest|fibrillation|angor|insuffisance cardiaq|métaboliq|veineu/.test(n)) return "Cardio";
  if (/stress|anxi|dépres|somm|insomn|phobi|schizo|parkinson|épileps|traum/.test(n)) return "Psy";
  if (/eczéma|dermatit|acné|mycose|psoriasis|irritation|pied|cutané|kératit|orgelet/.test(n)) return "Dermato";
  if (/toux|rhume|rhinit|gorge|sinusite|bronchi|asthme|bpco|congest/.test(n)) return "Respi";
  return "Default";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const stats = {
      protocols_created: 0,
      conseils_created: 0,
      produits_created: 0,
      med_patho_links_created: 0,
      rankings_created: 0,
      errors: [] as string[],
    };

    // ═══════════════════════════════════════════
    // AMÉLIORATION 1: Protocoles pour TOUTES les pathologies
    // ═══════════════════════════════════════════
    
    // Get all pathologies without active protocol
    const { data: orphanPathos } = await supabase
      .from("pathologies")
      .select("id, nom_pathologie, categorie")
      .not("id", "in", `(${
        (await supabase.from("protocole_pathologie").select("pathologie_id").eq("actif", true))
          .data?.map((p: any) => p.pathologie_id).join(",") || "00000000-0000-0000-0000-000000000000"
      })`);

    // Actually, let's do it differently - query orphans directly
    const { data: allPathos } = await supabase.from("pathologies").select("id, nom_pathologie, categorie");
    const { data: activeProtos } = await supabase.from("protocole_pathologie").select("pathologie_id").eq("actif", true);
    const protoSet = new Set((activeProtos || []).map((p: any) => p.pathologie_id));
    const orphanPathologies = (allPathos || []).filter((p: any) => !protoSet.has(p.id));

    for (const patho of orphanPathologies) {
      try {
        const cat = getCategoryFromPathologie(patho.nom_pathologie);
        const conseilTemplates = GENERIC_CONSEILS[cat] || GENERIC_CONSEILS["Default"];
        const produitTemplates = GENERIC_PRODUITS[cat] || GENERIC_PRODUITS["Default"];

        // Upsert 2 conseils
        const conseilIds: string[] = [];
        for (const c of conseilTemplates.slice(0, 2)) {
          const { data: existing } = await supabase
            .from("conseils_associes")
            .select("id")
            .eq("pathologie_id", patho.id)
            .eq("conseil_code", c.code)
            .maybeSingle();

          if (existing) {
            conseilIds.push(existing.id);
          } else {
            const { data: created, error } = await supabase
              .from("conseils_associes")
              .insert({ pathologie_id: patho.id, conseil: c.label, description: c.desc, conseil_code: c.code, priorite: 80 })
              .select("id")
              .single();
            if (created) {
              conseilIds.push(created.id);
              stats.conseils_created++;
            }
            if (error) stats.errors.push(`Conseil ${c.code} for ${patho.nom_pathologie}: ${error.message}`);
          }
        }

        // Upsert 3 produits
        const produitIds: string[] = [];
        for (const p of produitTemplates.slice(0, 3)) {
          const { data: existing } = await supabase
            .from("produits_complementaires")
            .select("id")
            .eq("pathologie_id", patho.id)
            .ilike("produit", `%${p.nom.split(" ")[0]}%`)
            .limit(1)
            .maybeSingle();

          if (existing) {
            produitIds.push(existing.id);
          } else {
            const { data: created, error } = await supabase
              .from("produits_complementaires")
              .insert({
                pathologie_id: patho.id,
                produit: p.nom,
                type_produit: p.type,
                categorie: p.cat,
                priorite: p.prio,
                description: `Recommandé pour ${patho.nom_pathologie}`,
                est_otc: true,
                est_eligible_cross_sell: true,
              })
              .select("id")
              .single();
            if (created) {
              produitIds.push(created.id);
              stats.produits_created++;
            }
            if (error) stats.errors.push(`Produit ${p.nom} for ${patho.nom_pathologie}: ${error.message}`);
          }
        }

        // Create protocol if we have enough
        if (conseilIds.length >= 2 && produitIds.length >= 3) {
          const { error } = await supabase.from("protocole_pathologie").insert({
            pathologie_id: patho.id,
            conseil_1_id: conseilIds[0],
            conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0],
            produit_complementaire_2_id: produitIds[1],
            produit_complementaire_3_id: produitIds[2],
            priorite_produit_1: 90,
            priorite_produit_2: 70,
            priorite_produit_3: 50,
            justification_1: `Prioritaire pour ${patho.nom_pathologie}`,
            justification_2: `Complémentaire pour ${patho.nom_pathologie}`,
            justification_3: `Support additionnel pour ${patho.nom_pathologie}`,
            actif: true,
            version_protocole: 1,
          });
          if (!error) stats.protocols_created++;
          else stats.errors.push(`Protocol for ${patho.nom_pathologie}: ${error.message}`);
        }
      } catch (e) {
        stats.errors.push(`Patho ${patho.nom_pathologie}: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════
    // AMÉLIORATION 2: Médicaments → Pathologie (100% coverage)
    // ═══════════════════════════════════════════
    
    const { data: orphanMeds } = await supabase
      .from("medicaments")
      .select("id, nom_commercial, molecule_id, atc_code")
      .not("id", "in", `(${
        (await supabase.from("medicament_pathologie").select("medicament_id"))
          .data?.map((m: any) => m.medicament_id).join(",") || "00000000-0000-0000-0000-000000000000"
      })`);

    // Actually query properly
    const { data: allMeds } = await supabase
      .from("medicaments")
      .select("id, nom_commercial, molecule_id, atc_code")
      .neq("statut_officine", "exclu");
    const { data: allMedLinks } = await supabase.from("medicament_pathologie").select("medicament_id");
    const linkedMedSet = new Set((allMedLinks || []).map((m: any) => m.medicament_id));
    const unlinkedMeds = (allMeds || []).filter((m: any) => !linkedMedSet.has(m.id));

    // Load all pathologies for name matching
    const { data: pathoList } = await supabase.from("pathologies").select("id, nom_pathologie");
    const pathoMap = new Map((pathoList || []).map((p: any) => [p.nom_pathologie.toLowerCase(), p.id]));

    // Load molecules for ATC lookup
    const { data: moleculesList } = await supabase.from("molecules").select("id, atc_code");
    const moleculeAtcMap = new Map((moleculesList || []).map((m: any) => [m.id, m.atc_code]));

    // Also check molecule_pathologie for indirect links
    const { data: molPathoLinks } = await supabase.from("molecule_pathologie").select("molecule_id, pathologie_id");
    const molPathoMap = new Map<string, string[]>();
    for (const link of (molPathoLinks || [])) {
      if (!molPathoMap.has(link.molecule_id)) molPathoMap.set(link.molecule_id, []);
      molPathoMap.get(link.molecule_id)!.push(link.pathologie_id);
    }

    for (const med of unlinkedMeds) {
      try {
        const foundPathoIds = new Set<string>();

        // Strategy 1: Via molecule_pathologie
        if (med.molecule_id && molPathoMap.has(med.molecule_id)) {
          for (const pid of molPathoMap.get(med.molecule_id)!) {
            foundPathoIds.add(pid);
          }
        }

        // Strategy 2: Via ATC code mapping
        const atcCode = med.atc_code || (med.molecule_id ? moleculeAtcMap.get(med.molecule_id) : null);
        if (atcCode && foundPathoIds.size === 0) {
          // Try increasingly broader ATC prefixes
          for (let len = atcCode.length; len >= 3; len--) {
            const prefix = atcCode.substring(0, len);
            const matchedPathos = ATC_PATHO_MAP[prefix];
            if (matchedPathos) {
              for (const pName of matchedPathos) {
                const pid = pathoMap.get(pName.toLowerCase());
                if (pid) foundPathoIds.add(pid);
              }
              break;
            }
          }
        }

        // Strategy 3: Fallback to broad ATC level 1
        if (foundPathoIds.size === 0 && atcCode) {
          const level1 = atcCode.charAt(0);
          const broadMap: Record<string, string[]> = {
            "A": ["Brûlures d'estomac", "Diarrhée aiguë"],
            "B": ["Fatigue et asthénie"],
            "C": ["Hypertension artérielle"],
            "D": ["Irritation cutanée", "Eczéma"],
            "G": ["Infection urinaire"],
            "H": ["Hypothyroïdie"],
            "J": ["Infection bactérienne"],
            "L": ["Inflammation"],
            "M": ["Douleur articulaire", "Inflammation"],
            "N": ["Douleur légère à modérée"],
            "P": ["Parasitose intestinale"],
            "R": ["Toux sèche", "Rhume"],
            "S": ["Sécheresse oculaire"],
            "V": ["Fatigue et asthénie"],
          };
          const fallbackPathos = broadMap[level1];
          if (fallbackPathos) {
            for (const pName of fallbackPathos) {
              const pid = pathoMap.get(pName.toLowerCase());
              if (pid) foundPathoIds.add(pid);
            }
          }
        }

        // Insert links
        for (const pathoId of foundPathoIds) {
          const { error } = await supabase.from("medicament_pathologie").insert({
            medicament_id: med.id,
            pathologie_id: pathoId,
            score_pertinence: 70,
            source_mapping: "auto_fill_atc",
          });
          if (!error) stats.med_patho_links_created++;
        }
      } catch (e) {
        stats.errors.push(`Med ${med.nom_commercial}: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════
    // AMÉLIORATION 3: Ranking des produits complémentaires
    // ═══════════════════════════════════════════
    
    // Load all produits with their pathologies
    const { data: allProduits } = await supabase
      .from("produits_complementaires")
      .select("id, pathologie_id, produit, priorite, type_produit, categorie, est_otc, est_complement, est_dispositif_medical, est_eligible_cross_sell");

    for (const prod of (allProduits || [])) {
      try {
        // Calculate scores
        const scoreClinique = Math.min(1, (prod.priorite || 50) / 100);
        const scorePertinence = scoreClinique; // mirrors priority initially
        const scoreCrossSell = prod.est_eligible_cross_sell ? 0.8 : 0.3;
        
        // Saisonnalité: boost for seasonal products
        const month = new Date().getMonth(); // 0-11
        const cat = (prod.categorie || "").toLowerCase();
        let scoreSaison = 0.5;
        if (/rhume|grippe|gorge|nasal|toux/.test(cat) && (month >= 9 || month <= 2)) scoreSaison = 0.9;
        if (/solaire|coup de soleil/.test(cat) && month >= 4 && month <= 8) scoreSaison = 0.9;
        if (/allergi/.test(cat) && month >= 2 && month <= 6) scoreSaison = 0.9;

        // Popularité: OTC and complements are more popular
        let scorePopularite = 0.5;
        if (prod.est_otc) scorePopularite += 0.2;
        if (prod.est_complement) scorePopularite += 0.1;
        if (prod.est_dispositif_medical) scorePopularite -= 0.1;
        scorePopularite = Math.max(0, Math.min(1, scorePopularite));

        // Upsert ranking
        const { error } = await supabase.from("produit_complementaire_ranking").upsert({
          pathologie_id: prod.pathologie_id,
          produit_id: prod.id,
          score_clinique: scoreClinique,
          score_pertinence_pathologie: scorePertinence,
          score_cross_sell: scoreCrossSell,
          score_saisonnalite: scoreSaison,
          score_popularite: scorePopularite,
        }, { onConflict: "pathologie_id,produit_id" });
        
        if (!error) stats.rankings_created++;
        else stats.errors.push(`Ranking ${prod.produit}: ${error.message}`);
      } catch (e) {
        stats.errors.push(`Ranking ${prod.produit}: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════
    // Verification counts
    // ═══════════════════════════════════════════
    const { data: finalCounts } = await supabase.rpc("get_clinical_coverage_stats").maybeSingle();
    
    // Manual counts
    const [pc1, pc2, pc3, pc4] = await Promise.all([
      supabase.from("pathologies").select("id", { count: "exact", head: true }),
      supabase.from("protocole_pathologie").select("pathologie_id", { count: "exact", head: true }).eq("actif", true),
      supabase.from("medicaments").select("id", { count: "exact", head: true }).neq("statut_officine", "exclu"),
      supabase.from("medicament_pathologie").select("medicament_id", { count: "exact", head: true }),
    ]);

    return new Response(JSON.stringify({
      success: true,
      message: "Auto-fill clinique terminé",
      stats,
      coverage: {
        total_pathologies: pc1.count,
        pathologies_with_protocol: pc2.count,
        total_medicaments: pc3.count,
        medicaments_with_pathology: pc4.count,
        rankings_total: stats.rankings_created,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
