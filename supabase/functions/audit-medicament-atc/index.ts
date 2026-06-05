// Audit ATC <-> Médicament : pour chaque médicament avec un code ATC,
// demande à Gemini si la classe ATC correspond bien au nom commercial.
// Stocke les anomalies dans medicament_atc_audit.
//
// Usage : POST { batch_size?: number, offset?: number, only_missing?: boolean }
//   - batch_size : nb de meds à analyser (défaut 50, max 100)
//   - offset     : pour pagination
//   - only_missing : ne traite que les meds pas encore audités (défaut true)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const AI_TIMEOUT_MS = 35_000;

interface Med { id: string; nom_commercial: string; atc_code: string; class_name?: string | null; }

async function classifyBatch(meds: Med[], model: string = DEFAULT_MODEL): Promise<any[] | null> {
  const sys = `Tu es pharmacologue clinique. Pour chaque médicament fourni (nom commercial + classe ATC actuelle),
tu dois dire si la classe ATC est COHÉRENTE avec le nom commercial/la molécule.

Réponds STRICTEMENT en JSON :
{"results":[{"id":"...","mismatch":true|false,"suggested_atc":"<code 5 chars ou null>","suggested_class":"<nom court>","confidence":"high|medium|low","reason":"<1 phrase>"}]}

Règles :
- mismatch=true seulement si la classe ATC actuelle est CLAIREMENT erronée (ex: Gelaspan=substitut plasmatique mais classé en G04 urologie)
- Si tu n'es pas sûr (génériques, noms ambigus), mets mismatch=false, confidence=low
- suggested_atc = code ATC niveau 5 correct, sinon null`;

  const user = "Médicaments à auditer :\n" + meds.map((m) => `- id=${m.id} | nom="${m.nom_commercial}" | atc=${m.atc_code} (${m.class_name ?? "?"})`).join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!r.ok) {
      console.error("[classifyBatch] HTTP", r.status, await r.text().then((t) => t.slice(0, 300)));
      return null;
    }
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt);
    return parsed.results || [];
  } catch (e) {
    console.error("[classifyBatch] error", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin requis" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedBatchSize = Number(body.batch_size) || 50;
    const offset = Math.max(Number(body.offset) || 0, 0);
    const onlyMissing = body.only_missing !== false;
    const mode = String(body.mode || "scan"); // "scan" | "rerun_uncertain"
    const model = String(body.model || DEFAULT_MODEL);
    const batchSize = mode === "rerun_uncertain"
      ? Math.min(Math.max(requestedBatchSize, 1), 8)
      : Math.min(Math.max(requestedBatchSize, 10), 100);

    // ===== MODE rerun_uncertain : ré-audite les low/medium avec un modèle plus puissant =====
    if (mode === "rerun_uncertain") {
      const confidences: string[] = Array.isArray(body.confidences) && body.confidences.length
        ? body.confidences
        : ["low", "medium"];
      const { data: uncertain, error: unErr } = await supabase
        .from("medicament_atc_audit")
        .select("medicament_id, nom_commercial, current_atc, current_class_name")
        .in("confidence", confidences)
        .eq("reviewed", false)
        .order("updated_at", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (unErr) throw unErr;
      const items = (uncertain || []).map((u: any) => ({
        id: u.medicament_id,
        nom_commercial: u.nom_commercial,
        atc_code: u.current_atc,
        class_name: u.current_class_name,
      }));
      if (items.length === 0) {
        return new Response(JSON.stringify({ processed: 0, mismatches: 0, anomalies: 0, next_offset: offset, done: true, mode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const CHUNK = 2;
      let mm = 0;
      let processed = 0;
      const start = Date.now();
      let stopped = false;
      const RERUN_BUDGET_MS = 70_000;
      for (let i = 0; i < items.length; i += CHUNK) {
        if (Date.now() - start > RERUN_BUDGET_MS - AI_TIMEOUT_MS) { stopped = true; break; }
        const chunk = items.slice(i, i + CHUNK);
        const results = await classifyBatch(chunk, model);
        if (!results) continue;
        const rows = results.map((r: any) => {
          const med = chunk.find((c) => c.id === r.id);
          if (!med) return null;
          if (r.mismatch) mm++;
          return {
            medicament_id: med.id,
            nom_commercial: med.nom_commercial,
            current_atc: med.atc_code,
            current_class_name: med.class_name,
            suggested_atc: r.suggested_atc || null,
            suggested_class_name: r.suggested_class || null,
            mismatch: !!r.mismatch,
            confidence: r.confidence || "low",
            reasoning: `[${model}] ${r.reason || ""}`,
          };
        }).filter(Boolean);
        if (rows.length > 0) {
          const { error: upErr } = await supabase.from("medicament_atc_audit").upsert(rows, { onConflict: "medicament_id" });
          if (upErr) console.error("rerun upsert", upErr);
        }
        processed += chunk.length;
      }
      return new Response(JSON.stringify({
        processed, mismatches: mm, anomalies: mm,
        next_offset: stopped ? offset + processed : offset + items.length,
        stopped_early: stopped,
        done: !stopped && items.length < batchSize,
        mode, model,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Pull meds with ATC.
    // Loop pages until we collect a full batch of unaudited meds (skips already-audited ranges).
    let cursor = offset;
    let toAudit: any[] = [];
    let lastPageSize = 0;
    let scanned = 0;
    const MAX_SCAN = 5000;
    const scanStart = Date.now();
    while (toAudit.length < batchSize && scanned < MAX_SCAN) {
      const { data: page, error: medsErr } = await supabase
        .from("medicaments")
        .select("id, nom_commercial, atc_code, classe_atc:atc_code(nom_classe)")
        .not("atc_code", "is", null)
        .order("nom_commercial")
        .range(cursor, cursor + batchSize - 1);
      if (medsErr) throw medsErr;
      lastPageSize = page?.length || 0;
      if (!page || page.length === 0) {
        return new Response(JSON.stringify({ done: true, processed: 0, mismatches: 0, anomalies: 0, next_offset: cursor }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let candidates = page;
      if (onlyMissing) {
        const { data: already } = await supabase
          .from("medicament_atc_audit")
          .select("medicament_id")
          .in("medicament_id", page.map((m: any) => m.id));
        const skip = new Set((already || []).map((a: any) => a.medicament_id));
        candidates = page.filter((m: any) => !skip.has(m.id));
      }
      toAudit.push(...candidates.slice(0, batchSize - toAudit.length));
      cursor += batchSize;
      scanned += batchSize;
      if (lastPageSize < batchSize || Date.now() - scanStart > 20_000) break;
    }
    if (toAudit.length === 0) {
      return new Response(JSON.stringify({ processed: 0, mismatches: 0, anomalies: 0, next_offset: cursor, skipped: scanned, done: lastPageSize < batchSize }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Process in chunks of 25, sequentially for safer ATC verification.
    const CHUNK = 25;
    const CONCURRENCY = 1;
    const findings: any[] = [];
    let mismatches = 0;

    const chunks: any[][] = [];
    for (let i = 0; i < toAudit.length; i += CHUNK) {
      chunks.push(toAudit.slice(i, i + CHUNK).map((m: any) => ({
        id: m.id,
        nom_commercial: m.nom_commercial,
        atc_code: m.atc_code,
        class_name: m.classe_atc?.nom_classe || null,
      })));
    }

    const processChunk = async (chunk: any[]) => {
      const results = await classifyBatch(chunk, model);
      if (!results) return;
      const rows = results.map((r: any) => {
        const med = chunk.find((c) => c.id === r.id);
        if (!med) return null;
        if (r.mismatch) mismatches++;
        return {
          medicament_id: med.id,
          nom_commercial: med.nom_commercial,
          current_atc: med.atc_code,
          current_class_name: med.class_name,
          suggested_atc: r.suggested_atc || null,
          suggested_class_name: r.suggested_class || null,
          mismatch: !!r.mismatch,
          confidence: r.confidence || "low",
          reasoning: r.reason || null,
        };
      }).filter(Boolean);
      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from("medicament_atc_audit")
          .upsert(rows, { onConflict: "medicament_id" });
        if (upErr) console.error("upsert error", upErr);
        findings.push(...rows);
      }
    };

    const startTs = Date.now();
    const TIME_BUDGET_MS = 90_000;
    let processedCount = 0;
    let stoppedEarly = false;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      if (Date.now() - startTs > TIME_BUDGET_MS) { stoppedEarly = true; break; }
      const wave = chunks.slice(i, i + CONCURRENCY);
      await Promise.all(wave.map(processChunk));
      processedCount += wave.reduce((s, c) => s + c.length, 0);
    }

    const nextOffset = stoppedEarly ? offset : cursor;
    return new Response(JSON.stringify({
      processed: processedCount,
      mismatches,
      anomalies: mismatches,
      next_offset: nextOffset,
      stopped_early: stoppedEarly,
      done: !stoppedEarly && lastPageSize < batchSize,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });


  } catch (e) {
    console.error("audit-medicament-atc error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
