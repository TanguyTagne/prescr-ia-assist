// One-shot: imports curated PCs (medicament_id, pc_1, pc_2, pc_3) into medicament_curated_pcs.
// POST the CSV (with header row) as text/plain body.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const text = await req.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    lines.shift(); // header

    const rows: { medicament_id: string; pc_1: string | null; pc_2: string | null; pc_3: string | null }[] = [];
    for (const line of lines) {
      const cells: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === "," && !inQ) { cells.push(cur); cur = ""; continue; }
        cur += c;
      }
      cells.push(cur);
      const [mid, p1, p2, p3] = cells;
      if (!mid) continue;
      rows.push({
        medicament_id: mid.trim(),
        pc_1: p1?.trim() || null,
        pc_2: p2?.trim() || null,
        pc_3: p3?.trim() || null,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const chunk = 500;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      const { error } = await supabase
        .from("medicament_curated_pcs")
        .upsert(batch, { onConflict: "medicament_id" });
      if (error) errors.push(`batch@${i}: ${error.message}`);
      else inserted += batch.length;
    }

    return new Response(JSON.stringify({ total: rows.length, inserted, errors }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
