// Generate 2 pediatric-safe PCs (symptom-relief + treatment-support) for each pediatric medication
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Tu es pharmacien-conseil expert en pédiatrie. Pour un médicament destiné aux nourrissons/enfants, propose 2 produits complémentaires STRICTEMENT pédiatriques (jamais aspirine, jamais ibuprofène 400, jamais paracétamol 1000, jamais IPP, jamais huiles essentielles <3 ans, jamais magnésium >100 mg).

Réponds UNIQUEMENT en JSON strict :
{
  "pc_symptome": { "produit": "<nom commercial pédiatrique précis>", "categorie": "<catégorie courte>", "description": "<10-15 mots, bénéfice patient>", "phrase_conseil": "<15-25 mots, mi-commercial mi-technique>" },
  "pc_accompagnement": { "produit": "...", "categorie": "...", "description": "...", "phrase_conseil": "..." }
}

Le PC "symptome" doit RÉDUIRE un effet secondaire ou un symptôme du traitement.
Le PC "accompagnement" doit AMÉLIORER l'efficacité ou le confort du traitement.
Privilégie : Stérimar bébé, Physiomer nourrisson, Bepanthen, Mustela, Calmosine, Biogaia ProTectis, Pediakid, Doliprane sirop, ZymaD gouttes, Movicol enfant, Mouche-bébé Prorhinel, sérum physiologique unidose.`;

async function callGpt55(med: { nom: string; atc: string | null }) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Médicament pédiatrique : ${med.nom}${med.atc ? ` (ATC ${med.atc})` : ""}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: u } = await authClient.auth.getUser();
  if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
  }

  // Pick pediatric meds that have not been filled yet
  const { data: meds, error } = await svc
    .from("medicaments")
    .select("id, nom_commercial, atc_code, cible_age")
    .in("cible_age", ["nourrisson", "enfant"]);
  if (error) throw error;

  const targets: any[] = [];
  for (const m of meds || []) {
    const { data: exists } = await svc
      .from("produits_complementaires")
      .select("id")
      .eq("medicament_id", m.id)
      .eq("source_code", "gpt55_peds_fill")
      .limit(1);
    if (!exists || exists.length === 0) targets.push(m);
  }

  const results: any[] = [];
  for (const m of targets) {
    try {
      const out = await callGpt55({ nom: m.nom_commercial, atc: m.atc_code });
      const rows: any[] = [];
      for (const key of ["pc_symptome", "pc_accompagnement"]) {
        const p = out[key];
        if (!p?.produit) continue;
        rows.push({
          medicament_id: m.id,
          produit: p.produit,
          categorie: p.categorie || "Pédiatrique",
          description: p.description || null,
          phrase_conseil: p.phrase_conseil || null,
          priorite: 92,
          source_code: "gpt55_peds_fill",
          source_reference: m.nom_commercial,
          cible_age: m.cible_age === "nourrisson" ? ["nourrisson", "enfant"] : ["enfant"],
          type_produit: key === "pc_symptome" ? "symptom_relief" : "treatment_support",
        });
      }
      if (rows.length) {
        const { error: insErr } = await svc.from("produits_complementaires").insert(rows);
        if (insErr) throw insErr;
      }
      results.push({ med: m.nom_commercial, ok: true, count: rows.length });
    } catch (e) {
      results.push({ med: m.nom_commercial, ok: false, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      total: targets.length,
      success: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
