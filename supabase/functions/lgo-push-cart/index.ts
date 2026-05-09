import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's pharmacy
    const { data: profile } = await supabase
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", user.id)
      .single();

    if (!profile?.pharmacy_id) {
      return new Response(JSON.stringify({ error: "Pharmacie non trouvée" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get LGO config
    const { data: lgoConfig } = await supabase
      .from("pharmacy_lgo_config")
      .select("*")
      .eq("pharmacy_id", profile.pharmacy_id)
      .eq("enabled", true)
      .single();

    if (!lgoConfig) {
      return new Response(JSON.stringify({ error: "LGO non configuré", lgo_available: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { products } = await req.json();
    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: "Produits requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Push to LGO API
    const lgoPayload = {
      action: "add_to_cart",
      pharmacy_id: profile.pharmacy_id,
      products: products.map((p: any) => ({
        name: p.name,
        cip_code: p.cip_code || null,
        quantity: p.quantity || 1,
        category: p.category || null,
      })),
      timestamp: new Date().toISOString(),
    };

    let lgoResponse = null;
    let lgoSuccess = false;

    if (lgoConfig.api_base_url && lgoConfig.api_base_url.length > 5) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        const lgoApiKey = lgoConfig.api_key ?? lgoConfig.api_key_encrypted;
        if (lgoConfig.auth_method === "api_key" && lgoApiKey) {
          headers["X-API-Key"] = lgoApiKey;
        } else if (lgoConfig.auth_method === "bearer" && lgoApiKey) {
          headers["Authorization"] = `Bearer ${lgoApiKey}`;
        }

        const resp = await fetch(`${lgoConfig.api_base_url}/cart/add`, {
          method: "POST",
          headers,
          body: JSON.stringify(lgoPayload),
        });

        lgoResponse = await resp.json().catch(() => null);
        lgoSuccess = resp.ok;
      } catch (e) {
        console.error("LGO push error:", e);
        lgoResponse = { error: e instanceof Error ? e.message : "Erreur LGO" };
      }
    }

    // Log the push attempt
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      pharmacy_id: profile.pharmacy_id,
      event_type: "lgo_push_cart",
      metadata: {
        products_count: products.length,
        lgo_type: lgoConfig.lgo_type,
        success: lgoSuccess,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        lgo_pushed: lgoSuccess,
        lgo_type: lgoConfig.lgo_type,
        lgo_response: lgoResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("lgo-push-cart error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
