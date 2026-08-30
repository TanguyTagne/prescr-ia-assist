// learn-pc-cip — enregistre une association EAN/CIP ↔ PC apprise d'un clic
// pharmacien, via service role, avec validation serveur.
// Remplace l'insert direct client (table partagée entre pharmacies).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth : utilisateur authentifié requis
  const auth = req.headers.get("authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pc_label = String(body?.pc_label ?? "").trim();
    const pc_label_norm = String(body?.pc_label_norm ?? "").trim();
    const categorie = body?.categorie ? String(body.categorie).trim().slice(0, 200) : null;
    const code = String(body?.code ?? "").trim();

    // Validation stricte
    if (!pc_label || pc_label.length > 200 || !pc_label_norm || pc_label_norm.length > 200) {
      return new Response(JSON.stringify({ error: "pc_label invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[0-9]{7,13}$/.test(code)) {
      return new Response(JSON.stringify({ error: "code invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("pc_cip_mapping").insert({
      pc_label,
      pc_label_norm,
      categorie,
      code,
      type_code: code.length === 13 ? "ean13" : "cip",
      source: "learned_from_click",
      statut: "pending",
      occurrences: 1,
    });

    if (error && !/duplicate|unique/i.test(error.message || "")) {
      console.error("learn-pc-cip insert error:", error.message);
      return new Response(JSON.stringify({ error: "Insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("learn-pc-cip error:", msg);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
