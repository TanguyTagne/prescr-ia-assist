import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractCore(name: string): string {
  return (name || "")
    .trim()
    .replace(/\d+\s*(mg|g|ml|ui|µg|mcg|%)/gi, "")
    .replace(
      /\b(comprim[ée]s?|g[ée]lules?|sachets?|sirop|suspension|solution|cr[èe]me|gel|patch|spray|gouttes|pommade|injectable|lyoc|effervescent|orodispersible|lp|fort|adulte|enfant|nourrisson|buvable)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

// Exclut les produits non-médicamenteux / peu impressionnants de la démo :
// pilluliers, compresses, pansements, dispositifs médicaux, accessoires…
const BORING_RE =
  /pillulier|compresse|pansement|bandage|bande\b|gants?\b|thermom[eè]tre|tensiom[eè]tre|canne\b|b[eé]quille|bas de contention|collier cervical|dispositif|masque\b|s[eé]rum physiologique|coton|sparadrap|poche de (?:froid|chaud)|attelle|orth[eè]se|ceinture lombaire|fauteuil|d[eé]ambulateur|brosse [àa] dents|dentifrice|bain de bouche|lingette|alcool modifi[eé]|eau oxyg[eé]n[eé]e|test de grossesse|autotest|pile\b|lancette|aiguille|seringue|glucom[eè]tre/i;

const isImpressive = (p: any) => !BORING_RE.test(`${p.produit ?? ""} ${p.categorie ?? ""}`);

// Noms de laboratoires : jamais affichés dans les suggestions (ni dans les
// noms de médicaments de la démo, ni dans les produits conseillés).
const LAB_RE =
  /\b(sandoz|teva|mylan|viatris|biogaran|zentiva|arrow|eg\b|eg labo|krka|zydus|actavis|ratiopharm|cristers|aurobindo|ranbaxy|stada|servier|pfizer|sanofi|bayer|gsk|glaxosmithkline|novartis|roche|merck|msd|boehringer|astrazeneca|lilly|janssen|bristol|myers|squibb|abbvie|amgen|takeda|pierre fabre|ipsen|lundbeck|recordati|menarini|theramex|effik|mylan|sandoz)\b/gi;

// Retire les mentions de laboratoires d'un libellé affiché.
function stripLab(name: string): string {
  return (name || "")
    .replace(LAB_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;:\-–—()\/]+$/, "")
    .replace(/^[\s,;:\-–—()\/]+/, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

const hasLab = (name: string) => {
  LAB_RE.lastIndex = 0;
  return LAB_RE.test(name || "");
};

// ── Démo : 5 médicaments vedettes avec PC et phrases validés ──
const DEMO_CURATED: {
  match: RegExp;
  nom: string;
  classe: string;
  conseil: string;
  pcs: { produit: string; phrase: string; description: string }[];
}[] = [
  {
    match: /isotr[eé]tino|roaccutane|accutane|curacn[eé]|procuta/i,
    nom: "Isotrétinoïne",
    classe: "Rétinoïde anti-acnéique",
    conseil:
      "La chéilite touche ~90 % des patients et la photosensibilisation est constante : la photoprotection fait partie du traitement, au même titre que la molécule.",
    pcs: [
      {
        produit: "SPF50+ non comédogène",
        phrase: "protège la peau fragilisée",
        description:
          "Photosensibilisation majeure sous isotrétinoïne : SPF50+ quotidien visage et zones exposées, dès le premier jour.",
      },
      {
        produit: "Baume lèvres réparateur",
        phrase: "soulage la chéilite",
        description:
          "Chéilite chez ~90 % des patients : application répétée dès les premières semaines de traitement.",
      },
      {
        produit: "Larmes artificielles",
        phrase: "compense la sécheresse oculaire",
        description:
          "Sécheresse oculaire fréquente : instiller dès les premiers signes de gêne, surtout chez les porteurs de lentilles.",
      },
    ],
  },
  {
    match: /hydrochlorothiazide|esidrex|coaprovel|hyzaar/i,
    nom: "Hydrochlorothiazide",
    classe: "Diurétique thiazidique",
    conseil:
      "Alerte ANSM du 06/11/2018 : risque de cancer cutané non mélanome à dose cumulée — la photoprotection est une recommandation explicite, pas un confort.",
    pcs: [
      {
        produit: "SPF50+ visage et mains",
        phrase: "réduit le risque cumulé UV",
        description:
          "Alerte ANSM 2018 : risque de cancer cutané non mélanome à dose cumulée, avec recommandation explicite de photoprotection.",
      },
    ],
  },
  {
    match: /metformine|glucophage|stagid/i,
    nom: "Metformine",
    classe: "Antidiabétique biguanide",
    conseil:
      "La metformine bloque l'absorption iléale de la B12 : 10–30 % des patients sont carencés, et les fourmillements sont souvent mis à tort sur le dos de la neuropathie diabétique.",
    pcs: [
      {
        produit: "Vitamine B12 sublinguale",
        phrase: "prévient la carence silencieuse",
        description:
          "Blocage de l'absorption iléale calcium-dépendante : 10–30 % de carencés — dont les fourmillements sont attribués à tort à la neuropathie diabétique.",
      },
    ],
  },
  {
    match: /om[eé]prazole|mopral|esomeprazole|inexium|pantoprazole|lansoprazole|rabeprazole|pariet/i,
    nom: "IPP (oméprazole…)",
    classe: "Inhibiteur de la pompe à protons",
    conseil:
      "Sous IPP, le carbonate de calcium n'est plus absorbé faute d'acidité gastrique — or 90 % des compléments du marché sont au carbonate. Le citrate, lui, reste absorbé.",
    pcs: [
      {
        produit: "Magnésium bisglycinate",
        phrase: "compense la fuite magnésienne",
        description:
          "Hypomagnésémie documentée au long cours sous IPP — forme bisglycinate bien tolérée et biodisponible.",
      },
      {
        produit: "Calcium citrate",
        phrase: "absorbé même sans acidité",
        description:
          "Le carbonate a besoin d'acidité gastrique : sous IPP il ne sert à rien. 90 % des compléments sont au carbonate — le citrate reste absorbé.",
      },
    ],
  },
  {
    match: /vesicare|solif[eé]nacine|ditropan|oxybutynine|tolterodine|fesoterodine/i,
    nom: "Anticholinergique vessie",
    classe: "Antimuscarinique urinaire",
    conseil:
      "Blocage muscarinique → hyposialie → caries radiculaires. Personne ne relie spontanément un traitement urologique au dentiste — c'est exactement le rôle du conseil associé.",
    pcs: [
      {
        produit: "Salive artificielle",
        phrase: "compense l'hyposialie",
        description:
          "Blocage muscarinique → sécheresse buccale marquée : la salive artificielle restaure le confort et la protection.",
      },
      {
        produit: "Dentifrice fluoré haute teneur",
        phrase: "protège les racines exposées",
        description:
          "Hyposialie prolongée → caries radiculaires : le fluor haute teneur protège l'émail fragilisé.",
      },
    ],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "lookup");
    const query = String(body.query || "").trim().slice(0, 120);

    // ── Liste — les 5 médicaments vedettes de la démo ──
    if (mode === "list") {
      return json({ medications: DEMO_CURATED.map((d) => d.nom) });
    }

    // ── Autocomplete — uniquement les médicaments ayant des PC curés ──
    if (mode === "suggest") {
      if (query.length < 2) return json({ suggestions: [] });
      const { data } = await supabase
        .from("medicament_curated_pcs")
        .select("medicaments!inner(nom_commercial)")
        .ilike("medicaments.nom_commercial", `${query}%`)
        .limit(10);
      const seen = new Set<string>();
      const suggestions = (data || [])
        .map((m: any) => stripLab(m.medicaments?.nom_commercial))
        .filter((n: string) => {
          const k = (n || "").toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 5);
      return json({ suggestions });
    }

    if (query.length < 2) return json({ found: false, message: "Requête trop courte" });

    // ── Find medication (progressive fuzzy) ──
    let medicament: any = null;
    const attempts = [query, `%${query}%`];
    const core = extractCore(query);
    if (core && core !== query) attempts.push(`%${core}%`);
    const firstWord = core.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3) attempts.push(`%${firstWord}%`);

    for (const pattern of attempts) {
      const { data } = await supabase
        .from("medicaments")
        .select("*, molecules(*)")
        .ilike("nom_commercial", pattern)
        .limit(1)
        .maybeSingle();
      if (data) {
        medicament = data;
        break;
      }
    }

    if (!medicament) {
      const { data: mol } = await supabase
        .from("molecules")
        .select("*")
        .ilike("nom_molecule", `%${core || query}%`)
        .limit(1)
        .maybeSingle();
      if (!mol) return json({ found: false, message: "Médicament non trouvé dans la base clinique" });
      medicament = { nom_commercial: query, molecules: mol, atc_code: mol.atc_code };
    }

    // ── Raccourci démo : les 5 médicaments vedettes utilisent leurs PC curés ──
    const haystack = `${medicament.nom_commercial || ""} ${query} ${medicament.molecules?.nom_molecule || ""}`;
    const demoEntry = DEMO_CURATED.find((d) => d.match.test(haystack));
    if (demoEntry) {
      return json({
        found: true,
        medicament: {
          nom: demoEntry.nom,
          classe: demoEntry.classe,
          molecule: medicament.molecules?.nom_molecule || undefined,
          code_atc: medicament.atc_code || medicament.molecules?.atc_code || undefined,
          conseil_associe: demoEntry.conseil,
          recommendations: demoEntry.pcs.map((p, i) => ({
            produit: p.produit,
            categorie: "Conseil associé",
            priorite: 100 - i,
            phrase_conseil: p.phrase,
            description: p.description,
          })),
        },
      });
    }

    const molecule = medicament.molecules;
    const atcCode = medicament.atc_code || molecule?.atc_code;

    // ── Pathologies ──
    const pathologieIds = new Set<string>();
    if (molecule?.id) {
      const { data } = await supabase
        .from("molecule_pathologie")
        .select("pathologie_id")
        .eq("molecule_id", molecule.id);
      (data || []).forEach((r: any) => r.pathologie_id && pathologieIds.add(r.pathologie_id));
    }
    if (medicament?.id) {
      const { data } = await supabase
        .from("medicament_pathologie")
        .select("pathologie_id")
        .eq("medicament_id", medicament.id);
      (data || []).forEach((r: any) => r.pathologie_id && pathologieIds.add(r.pathologie_id));
    }

    // ── Complementary products ──
    let produits: any[] = [];

    // 1) Curated PCs (highest priority source)
    if (medicament?.id) {
      const { data: curated } = await supabase
        .from("medicament_curated_pcs")
        .select("pc_1, pc_2, pertinence_pc1, pertinence_pc2, phrase_conseil_pc1, phrase_conseil_pc2")
        .eq("medicament_id", medicament.id)
        .maybeSingle();
      if (curated) {
        const pairs = [
          { name: curated.pc_1, phrase: curated.phrase_conseil_pc1, pertinence: curated.pertinence_pc1 },
          { name: curated.pc_2, phrase: curated.phrase_conseil_pc2, pertinence: curated.pertinence_pc2 },
        ].filter((p) => p.name && String(p.name).trim());
        produits = pairs.map((p, i) => ({
          produit: String(p.name).trim(),
          categorie: "Conseil associé",
          priorite: 100 - i,
          phrase_conseil: (p.phrase || "").trim() || undefined,
          description: (p.pertinence || "").trim() || undefined,
        }));
      }

      // 2) Validated PCs bound to the medication
      const { data: mpv } = await supabase
        .from("medicament_pc_valide")
        .select("score, pc:produits_complementaires(produit, categorie, description, phrase_conseil, pathologies(nom_pathologie))")
        .eq("medicament_id", medicament.id)
        .order("score", { ascending: false })
        .limit(10);
      produits = [
        ...produits,
        ...(mpv || [])
          .filter((r: any) => r.pc)
          .map((r: any) => ({ ...r.pc, priorite: Math.max(r.score || 0, 90) })),
      ];

      const { data } = await supabase
        .from("produits_complementaires")
        .select("produit, categorie, description, priorite, phrase_conseil, pathologies(nom_pathologie)")
        .eq("medicament_id", medicament.id)
        .order("priorite", { ascending: false })
        .limit(10);
      produits = [...produits, ...(data || []).map((p: any) => ({ ...p, priorite: Math.max(p.priorite || 0, 85) }))];
    }

    // 3) Pathology-based PCs
    if (pathologieIds.size > 0) {
      const { data } = await supabase
        .from("produits_complementaires")
        .select("produit, categorie, description, priorite, phrase_conseil, pathologies(nom_pathologie)")
        .in("pathologie_id", [...pathologieIds])
        .order("priorite", { ascending: false })
        .limit(20);
      produits = [...produits, ...(data || [])];
    }

    // 4) ATC-class fallback — other medications sharing the same ATC code
    if (produits.length === 0 && atcCode) {
      const { data: siblings } = await supabase
        .from("medicaments")
        .select("id")
        .eq("atc_code", atcCode)
        .limit(20);
      const ids = (siblings || []).map((s: any) => s.id).filter((id: string) => id !== medicament.id);
      if (ids.length > 0) {
        const { data: curatedSib } = await supabase
          .from("medicament_curated_pcs")
          .select("pc_1, phrase_conseil_pc1, pertinence_pc1")
          .in("medicament_id", ids)
          .limit(5);
        produits = (curatedSib || [])
          .filter((c: any) => c.pc_1)
          .map((c: any, i: number) => ({
            produit: String(c.pc_1).trim(),
            categorie: "Conseil associé",
            priorite: 90 - i,
            phrase_conseil: (c.phrase_conseil_pc1 || "").trim() || undefined,
            description: (c.pertinence_pc1 || "").trim() || undefined,
          }));
      }
    }


    const seen = new Set<string>();
    const recommendations = produits
      .filter((p: any) => {
        if (hasLab(p.produit || "")) return false;
        const k = (p.produit || "").toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        // Démo : uniquement des suggestions impressionnantes (actifs chimiques /
        // effets secondaires) — pas de pillulier, compresses, accessoires…
        if (!isImpressive(p)) return false;
        seen.add(k);
        return true;
      })
      .sort((a: any, b: any) => (b.priorite || 0) - (a.priorite || 0))
      .slice(0, 5)
      .map((p: any) => ({
        produit: p.produit,
        categorie: p.categorie || "Conseil",
        description: p.description || undefined,
        priorite: p.priorite || 70,
        pathologie: p.pathologies?.nom_pathologie || undefined,
        phrase_conseil: p.phrase_conseil || undefined,
      }));

    // ── Counseling advice from the pathology protocol ──
    let conseil = "";
    if (pathologieIds.size > 0) {
      const { data } = await supabase
        .from("conseils_associes")
        .select("conseil, description")
        .in("pathologie_id", [...pathologieIds])
        .order("priorite", { ascending: false })
        .limit(1);
      const c = data?.[0];
      if (c) conseil = [c.conseil, c.description].filter(Boolean).join(" — ");
    }

    // ── Therapeutic class label ──
    let classe = molecule?.classe_therapeutique || "";
    if (!classe && atcCode) {
      const { data: cls } = await supabase
        .from("classe_atc")
        .select("nom_classe")
        .eq("atc_code", atcCode)
        .maybeSingle();
      classe = cls?.nom_classe || "";
    }

    return json({
      found: true,
      medicament: {
        nom: stripLab(medicament.nom_commercial),
        classe: classe || "Classe non renseignée",
        molecule: molecule?.nom_molecule || undefined,
        code_atc: atcCode || undefined,
        conseil_associe: conseil || undefined,
        recommendations,
      },
    });
  } catch (error) {
    console.error("demo-med-lookup error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
