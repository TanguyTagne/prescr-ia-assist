import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const session_id = String(body?.session_id ?? "").slice(0, 100);
    const ordonnance_id = String(body?.ordonnance_id ?? "").slice(0, 50);
    const referrer = body?.referrer ? String(body.referrer).slice(0, 500) : null;
    const user_agent = body?.user_agent ? String(body.user_agent).slice(0, 500) : null;
    const tracking_link_id = body?.tracking_link_id && /^[0-9a-f-]{36}$/i.test(String(body.tracking_link_id))
      ? String(body.tracking_link_id) : null;

    if (!session_id || !ordonnance_id) {
      return new Response(JSON.stringify({ error: "session_id and ordonnance_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Geo lookup via Cloudflare/standard headers
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || null;
    const city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("demo_sessions").insert({
      session_id,
      ordonnance_id,
      ip_country: country,
      ip_city: city,
      referrer,
      user_agent,
      tracking_link_id,
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-demo-session error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
