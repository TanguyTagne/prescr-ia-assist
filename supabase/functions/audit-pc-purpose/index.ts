// Audit PC ↔ Médicament : classifie chaque PC par finalité clinique
// puis re-valide les liens en se basant sur les classes ATC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-2.5-flash";

interface PcRow {
  id: string;
  produit: string;
  categorie: string | null;
  description: string | null;
  phrase_conseil: string | null;
  finalite: string | null;
  trigger_atc_prefixes: string[] | null;
}

async function classifyPc(pc: PcRow): Promise<{ finalite: string; atc: string[] } | null> {
  const sys = `Tu es un pharmacien clinicien. Pour chaque produit complémentaire (PC) proposé en officine, tu détermines :
1. sa FINALITÉ clinique parmi exactement :
   - "side_effect" : réduit / prévient un effet indésirable d'un traitement
   - "treatment_support" : accompagne / améliore l'efficacité d'un traitement
   - "symptom_relief" : soulage un symptôme indépendamment d'un traitement (rare, OTC pur)
2. Les CLASSES ATC (préfixes 3 à 5 caractères) qui justifient ce PC.
   Exemples : ["M01A"] pour AINS, ["N02A"] pour opioïdes, ["J01"] pour antibiotiques systémiques,
   ["C10AA"] pour statines, ["R03BA","R03AK"] pour corticoïdes inhalés.
   Si "symptom_relief", retourne [].
Réponds STRICTEMENT en JSON: {"finalite":"...","atc":["..."]}.`;

  const user = `PC: ${pc.produit}
Catégorie: ${pc.categorie ?? "n/a"}
Description: ${pc.description ?? "n/a"}
Phrase conseil: ${pc.phrase_conseil ?? "n/a"}`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error(`[classifyPc] HTTP ${r.status} for ${pc.produit}: ${txt.slice(0, 200)}`);
      return null;
    }
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt);
    if (!["side_effect", "treatment_support", "symptom_relief"].includes(parsed.finalite)) {
      console.error(`[classifyPc] bad finalite for ${pc.produit}: ${txt.slice(0, 200)}`);
      return null;
    }
    const atc = Array.isArray(parsed.atc) ? parsed.atc.filter((x: any) => typeof x === "string").map((x: string) => x.toUpperCase().trim()).slice(0, 8) : [];
    return { finalite: parsed.finalite, atc };
  } catch (e) {
    console.error(`[classifyPc] exception for ${pc.produit}:`, e);
    return null;
  }
}

async function generatePcForOrphan(med: { nom_commercial: string; atc_code: string | null; classe?: string | null }): Promise<any[] | null> {
  const sys = `Tu es un pharmacien clinicien. Pour le médicament fourni, propose 2 produits complémentaires (PC) qui sont :
- soit "side_effect" (réduit un effet indésirable connu de la classe)
- soit "treatment_support" (accompagne / améliore l'efficacité)
Évite les médicaments sur ordonnance, vaccins, ou DM hospitaliers. Privilégie OTC, compléments, dispositifs grand public.
Réponds en JSON: {"pcs":[{"produit":"...","categorie":"...","description":"...","phrase_conseil":"...","finalite":"side_effect|treatment_support","atc":["..."]}]}`;
  const user = `Médicament: ${med.nom_commercial}
ATC: ${med.atc_code ?? "?"}`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? "{}");
    return Array.isArray(parsed.pcs) ? parsed.pcs.slice(0, 2) : null;
  } catch {
    return null;
  }
}

function chunked<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin guard
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const authClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await authClient.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode ?? "classify"; // 'classify' | 'revalidate' | 'fill_orphans' | 'all'
  const limit = body?.limit ?? 500;

  const { data: run } = await svc.from("pc_audit_runs").insert({ status: "running" }).select("*").single();
  const runId = run!.id;
  const stats = { pcs_classified: 0, links_created: 0, links_rejected: 0, orphans_filled: 0, new_pcs_created: 0 };

  console.log(`[audit-pc] starting mode=${mode} limit=${limit} runId=${runId}`);

  // Run the heavy work in background; return immediately so the client doesn't time out (150s limit).
  const work = async () => {
   try {
    // === PHASE 1: classify PCs without finalite ===
    if (mode === "classify" || mode === "all") {
      const { data: pcs, error: pcErr } = await svc
        .from("produits_complementaires")
        .select("id,produit,categorie,description,phrase_conseil,finalite,trigger_atc_prefixes")
        .is("finalite", null)
        .limit(limit);
      console.log(`[phase1] pcs to classify: ${pcs?.length ?? 0}, err: ${pcErr?.message ?? "none"}`);

      for (const batch of chunked(pcs ?? [], 10)) {
        const results = await Promise.all(batch.map(p => classifyPc(p as PcRow)));
        const updates = batch.map((p, i) => {
          const r = results[i];
          if (!r) return null;
          return svc.from("produits_complementaires")
            .update({ finalite: r.finalite, trigger_atc_prefixes: r.atc, finalite_audited_at: new Date().toISOString() })
            .eq("id", p.id);
        }).filter(Boolean);
        await Promise.all(updates as any);
        stats.pcs_classified += results.filter(Boolean).length;
      }
      console.log(`[phase1] classified: ${stats.pcs_classified}`);
    }

    // === PHASE 2: revalidate med <-> pc links ===
    if (mode === "revalidate" || mode === "all") {
      const fetchAll = async (table: string, cols: string, filter?: (q: any) => any) => {
        const all: any[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          let q: any = svc.from(table).select(cols).range(from, from + pageSize - 1);
          if (filter) q = filter(q);
          const { data, error } = await q;
          if (error) { console.error(`[fetchAll ${table}]`, error.message); break; }
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
        }
        return all;
      };

      const [meds, pcsAll, medPatho] = await Promise.all([
        fetchAll("medicaments", "id,nom_commercial,atc_code"),
        fetchAll("produits_complementaires", "id,pathologie_id,finalite,trigger_atc_prefixes,priorite,medicament_id", q => q.not("finalite", "is", null)),
        fetchAll("medicament_pathologie", "medicament_id,pathologie_id,score_pertinence"),
      ]);
      console.log(`[phase2] meds=${meds.length} pcsAll=${pcsAll.length} medPatho=${medPatho.length}`);

      const pcsByPatho = new Map<string, any[]>();
      for (const pc of pcsAll) {
        if (!pc.pathologie_id) continue;
        const arr = pcsByPatho.get(pc.pathologie_id) ?? [];
        arr.push(pc);
        pcsByPatho.set(pc.pathologie_id, arr);
      }
      const pathosByMed = new Map<string, { pathologie_id: string; score: number }[]>();
      for (const mp of medPatho) {
        const arr = pathosByMed.get(mp.medicament_id) ?? [];
        arr.push({ pathologie_id: mp.pathologie_id, score: mp.score_pertinence ?? 50 });
        pathosByMed.set(mp.medicament_id, arr);
      }

      const { error: delErr } = await svc.from("medicament_pc_valide").delete().eq("source", "audit_v1");
      if (delErr) console.error(`[phase2] delete err:`, delErr.message);

      const toInsert: any[] = [];
      let rejected = 0;
      for (const med of meds) {
        const atc = (med.atc_code ?? "").toUpperCase();
        const pathos = pathosByMed.get(med.id) ?? [];
        const seen = new Set<string>();

        for (const pc of pcsAll.filter((p: any) => p.medicament_id === med.id)) {
          if (seen.has(pc.id)) continue;
          seen.add(pc.id);
          toInsert.push({ medicament_id: med.id, pc_id: pc.id, finalite: pc.finalite, score: pc.priorite ?? 70, source: "audit_v1" });
        }

        for (const { pathologie_id, score } of pathos) {
          for (const pc of pcsByPatho.get(pathologie_id) ?? []) {
            if (seen.has(pc.id)) continue;
            const prefixes: string[] = pc.trigger_atc_prefixes ?? [];
            const atcMatch = prefixes.length > 0 && atc && prefixes.some(pr => atc.startsWith(pr));
            const symptomMatch = pc.finalite === "symptom_relief" && score >= 60;
            if (atcMatch || symptomMatch) {
              seen.add(pc.id);
              toInsert.push({ medicament_id: med.id, pc_id: pc.id, finalite: pc.finalite, score, source: "audit_v1" });
            } else {
              rejected++;
            }
          }
        }
      }

      console.log(`[phase2] toInsert=${toInsert.length} rejected=${rejected}`);
      for (const batch of chunked(toInsert, 500)) {
        const { error } = await svc.from("medicament_pc_valide").upsert(batch, { onConflict: "medicament_id,pc_id" });
        if (error) console.error(`[phase2] upsert err:`, error.message);
        else stats.links_created += batch.length;
      }
      stats.links_rejected = rejected;
      console.log(`[phase2] links_created=${stats.links_created}`);
    }

    // === PHASE 3: fill orphans (meds with 0 valid PC) ===
    if (mode === "fill_orphans" || mode === "all") {
      const { data: meds } = await svc.from("medicaments").select("id,nom_commercial,atc_code");
      const { data: validLinks } = await svc.from("medicament_pc_valide").select("medicament_id");
      const covered = new Set((validLinks ?? []).map((l: any) => l.medicament_id));
      const orphans = (meds ?? []).filter((m: any) => !covered.has(m.id) && m.atc_code).slice(0, Math.min(limit, 200));

      for (const batch of chunked(orphans, 5)) {
        const proposals = await Promise.all(batch.map(m => generatePcForOrphan(m as any)));
        for (let i = 0; i < batch.length; i++) {
          const med = batch[i]; const pcs = proposals[i];
          if (!pcs) continue;
          for (const p of pcs) {
            const { data: newPc, error } = await svc.from("produits_complementaires").insert({
              produit: p.produit,
              categorie: p.categorie ?? "Complément",
              description: p.description,
              phrase_conseil: p.phrase_conseil,
              finalite: p.finalite,
              trigger_atc_prefixes: Array.isArray(p.atc) ? p.atc : [],
              priorite: 75,
              medicament_id: med.id,
              type_produit: "complement",
              est_eligible_cross_sell: true,
              finalite_audited_at: new Date().toISOString(),
            }).select("id").single();
            if (error || !newPc) continue;
            stats.new_pcs_created++;
            await svc.from("medicament_pc_valide").upsert({
              medicament_id: med.id, pc_id: newPc.id, finalite: p.finalite, score: 75, source: "audit_v1",
            }, { onConflict: "medicament_id,pc_id" });
          }
          stats.orphans_filled++;
        }
      }
    }

    await svc.from("pc_audit_runs").update({ ...stats, status: "done", finished_at: new Date().toISOString() }).eq("id", runId);
    console.log(`[audit-pc] done runId=${runId}`, stats);
   } catch (e: any) {
    console.error(`[audit-pc] error runId=${runId}:`, e?.message ?? e);
    await svc.from("pc_audit_runs").update({ status: "error", error: String(e?.message ?? e), finished_at: new Date().toISOString() }).eq("id", runId);
   }
  };

  // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work());
  } else {
    work();
  }

  return new Response(JSON.stringify({ ok: true, run_id: runId, status: "running", mode }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
