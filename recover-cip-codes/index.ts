import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = req.headers.get("authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: corsHeaders });
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: corsHeaders });
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Admin requis" }), { status: 403, headers: corsHeaders });

  try {
    // 1. Charger tous les médicaments sans CIP
    const { data: meds } = await supabase
      .from("medicaments").select("id, nom_commercial").is("cip_code", null).limit(20000);
    if (!meds?.length) return new Response(JSON.stringify({ message: "Rien à récupérer", count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // 2. CIPs déjà pris
    const { data: takenRaw } = await supabase
      .from("medicaments").select("cip_code").not("cip_code", "is", null).limit(30000);
    const usedCips = new Set((takenRaw || []).map((r: any) => r.cip_code as string));

    // 3. Toutes les entrées medicament_cip
    const { data: cipEntries } = await supabase
      .from("medicament_cip").select("cip13, medicament_nom").limit(50000);
    if (!cipEntries?.length) throw new Error("medicament_cip vide");

    // Trier par longueur DESC = préférer le nom le plus spécifique en premier
    cipEntries.sort((a: any, b: any) => b.medicament_nom.length - a.medicament_nom.length);

    // 4. Calculer le mapping : pour chaque médicament sans CIP, trouver le meilleur CIP disponible
    const updates: Array<{ id: string; cip: string }> = [];
    for (const med of meds) {
      const nomLower = med.nom_commercial.toLowerCase().trim();
      for (const entry of cipEntries) {
        const prefix = (entry.medicament_nom as string).toLowerCase().trim();
        if (nomLower.startsWith(prefix) && !usedCips.has(entry.cip13)) {
          updates.push({ id: med.id, cip: entry.cip13 });
          usedCips.add(entry.cip13);
          break;
        }
      }
    }

    // 5. Appliquer en batches de 100 en parallèle
    let updated = 0;
    const BATCH = 100;
    for (let i = 0; i < updates.length; i += BATCH) {
      const results = await Promise.all(
        updates.slice(i, i + BATCH).map(({ id, cip }) =>
          supabase.from("medicaments").update({ cip_code: cip }).eq("id", id).is("cip_code", null)
        ),
      );
      updated += results.filter((r: any) => !r.error).length;
    }

    return new Response(JSON.stringify({
      success: true,
      sans_cip_total: meds.length,
      mappes: updates.length,
      mis_a_jour: updated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("recover-cip-codes error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
