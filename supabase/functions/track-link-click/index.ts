import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const detectDevice = (ua: string): string => {
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const slug = String(body?.slug ?? "").trim().slice(0, 50);
    const session_id = String(body?.session_id ?? "").slice(0, 100);
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link } = await supabase
      .from("tracking_links")
      .select("id, destination, is_active, expires_at")
      .eq("slug", slug)
      .maybeSingle();

    if (!link || !link.is_active || (link.expires_at && new Date(link.expires_at) < new Date())) {
      return new Response(JSON.stringify({ ok: false, destination: "/" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || null;
    const city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || null;
    const referrer = body?.referrer ? String(body.referrer).slice(0, 500) : null;
    const ua = req.headers.get("user-agent") || "";

    // Unique = no prior click from this session for this link
    let isUnique = false;
    if (session_id) {
      const { count } = await supabase
        .from("tracking_clicks")
        .select("id", { count: "exact", head: true })
        .eq("link_id", link.id)
        .eq("session_id", session_id);
      isUnique = (count ?? 0) === 0;
    }

    await supabase.from("tracking_clicks").insert({
      link_id: link.id,
      session_id: session_id || null,
      ip_country: country, ip_city: city,
      referrer, user_agent: ua.slice(0, 500),
      device_type: detectDevice(ua),
      is_unique: isUnique,
    });

    // Bump counters
    const { data: cur } = await supabase.from("tracking_links")
      .select("clicks_count, unique_clicks_count").eq("id", link.id).maybeSingle();
    await supabase.from("tracking_links").update({
      clicks_count: (cur?.clicks_count ?? 0) + 1,
      unique_clicks_count: (cur?.unique_clicks_count ?? 0) + (isUnique ? 1 : 0),
      updated_at: new Date().toISOString(),
    }).eq("id", link.id);

    return new Response(JSON.stringify({
      ok: true,
      link_id: link.id,
      destination: link.destination || "/",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("track-link-click error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
