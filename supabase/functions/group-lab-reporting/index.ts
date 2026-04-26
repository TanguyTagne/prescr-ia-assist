import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jsonError("Non autorisé", 401);

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonError("Non autorisé", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    let groupementId = url.searchParams.get("groupement_id");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles").select("managed_groupement_id").eq("id", user.id).maybeSingle();
      if (!profile?.managed_groupement_id) return jsonError("Accès groupement requis", 403);
      groupementId = profile.managed_groupement_id;
    }
    if (!groupementId) return jsonError("groupement_id requis", 400);

    // Get group mapping (which products/labos are prioritized)
    const { data: mapping } = await supabase
      .from("group_product_mapping")
      .select("*")
      .eq("groupement_id", groupementId)
      .eq("active", true);

    const { data: pharmacies } = await supabase
      .from("pharmacies").select("id, name").eq("groupement_id", groupementId);
    const pharmaIds = (pharmacies || []).map((p: any) => p.id);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    if (pharmaIds.length === 0 || !mapping || mapping.length === 0) {
      return new Response(JSON.stringify({
        period: { since: since.toISOString(), days: 30 },
        labs: [], pharmacies: pharmacies || [], mapping_count: mapping?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: feedback } = await supabase
      .from("pc_feedback")
      .select("pharmacy_id, action, pc_nom, pc_categorie, created_at")
      .in("pharmacy_id", pharmaIds)
      .gte("created_at", since.toISOString());

    // Aggregate by labo
    const labMap: Record<string, {
      laboratoire: string;
      products: Record<string, { proposed: number; accepted: number; categorie?: string }>;
      total_proposed: number;
      total_accepted: number;
    }> = {};

    (mapping || []).forEach((m: any) => {
      const lab = m.laboratoire_partenaire || "Sans labo";
      if (!labMap[lab]) {
        labMap[lab] = { laboratoire: lab, products: {}, total_proposed: 0, total_accepted: 0 };
      }
      if (!labMap[lab].products[m.produit_prioritaire]) {
        labMap[lab].products[m.produit_prioritaire] = { proposed: 0, accepted: 0, categorie: m.categorie };
      }
    });

    (feedback || []).forEach((f: any) => {
      Object.values(labMap).forEach((lab) => {
        const product = lab.products[f.pc_nom];
        if (product) {
          product.proposed++;
          lab.total_proposed++;
          if (f.action === "accepted") {
            product.accepted++;
            lab.total_accepted++;
          }
        }
      });
    });

    const labs = Object.values(labMap).map((lab) => ({
      laboratoire: lab.laboratoire,
      total_proposed: lab.total_proposed,
      total_accepted: lab.total_accepted,
      conversion_rate: lab.total_proposed > 0
        ? Math.round((lab.total_accepted / lab.total_proposed) * 100)
        : 0,
      products: Object.entries(lab.products).map(([name, v]) => ({
        produit: name,
        categorie: v.categorie,
        proposed: v.proposed,
        accepted: v.accepted,
        conversion: v.proposed > 0 ? Math.round((v.accepted / v.proposed) * 100) : 0,
      })).sort((a, b) => b.proposed - a.proposed),
    })).sort((a, b) => b.total_proposed - a.total_proposed);

    return new Response(JSON.stringify({
      period: { since: since.toISOString(), days: 30 },
      labs,
      pharmacies_count: pharmacies?.length || 0,
      mapping_count: mapping?.length || 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("group-lab-reporting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function jsonError(msg: string, status: number) {
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
