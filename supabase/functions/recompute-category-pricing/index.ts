/**
 * recompute-category-pricing — Recalcule les prix moyens pondérés par
 * catégorie à partir de pc_pricing (prix exacts) et des volumes.
 *
 * À lancer mensuellement (cron) ou manuellement depuis l'admin :
 *   POST /recompute-category-pricing
 *   Authorization: Bearer <admin_token>
 *
 * Formule par catégorie :
 *   prix_pondéré = Σ(prix_unitaire × volume) / Σ(volume)
 *
 * Garantit que la moyenne reflète le mix réel des ventes (plus de
 * Doliprane que de Lévothyrox), pas une moyenne arithmétique biaisée.
 */
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

  // Auth admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin requis" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Récupère tous les prix exacts avec leur catégorie et volume ──────
    const { data: prices, error: pricesErr } = await supabase
      .from("pc_pricing")
      .select("categorie, prix_unitaire_ttc, volume_pondere");

    if (pricesErr) throw new Error("Erreur lecture pc_pricing: " + pricesErr.message);

    // ── Agrégation par catégorie ─────────────────────────────────────────
    const byCat: Record<string, { sum_prix_x_vol: number; sum_vol: number; nb: number }> = {};
    for (const row of (prices || []) as any[]) {
      const cat = row.categorie?.trim();
      const prix = Number(row.prix_unitaire_ttc) || 0;
      const vol = Number(row.volume_pondere) || 0;
      if (!cat || prix <= 0) continue;
      // Volume minimum 1 pour éviter division par 0 — si pas de data volume,
      // on traite comme volume neutre
      const effectiveVol = vol > 0 ? vol : 1;
      byCat[cat] = byCat[cat] || { sum_prix_x_vol: 0, sum_vol: 0, nb: 0 };
      byCat[cat].sum_prix_x_vol += prix * effectiveVol;
      byCat[cat].sum_vol += effectiveVol;
      byCat[cat].nb += 1;
    }

    // ── Upsert dans pc_category_pricing ──────────────────────────────────
    const rows = Object.entries(byCat).map(([cat, s]) => ({
      categorie: cat,
      prix_moyen_pondere: Math.round((s.sum_prix_x_vol / s.sum_vol) * 100) / 100,
      nb_pcs_referenced: s.nb,
      volume_total: s.sum_vol,
      method: "volume_weighted",
      computed_at: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({
        success: false, error: "Aucune donnée prix dans pc_pricing",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: upsertErr } = await supabase
      .from("pc_category_pricing")
      .upsert(rows, { onConflict: "categorie" });

    if (upsertErr) throw new Error("Erreur upsert: " + upsertErr.message);

    return new Response(JSON.stringify({
      success: true,
      categories_updated: rows.length,
      details: rows.sort((a, b) => b.volume_total - a.volume_total),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("recompute-category-pricing fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
