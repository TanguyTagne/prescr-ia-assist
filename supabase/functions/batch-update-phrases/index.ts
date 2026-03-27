import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { updates } = await req.json(); // [{id, phrase}]
    if (!Array.isArray(updates)) throw new Error("updates must be an array");

    let done = 0;
    let errors: string[] = [];

    for (const item of updates) {
      const { error } = await supabase
        .from("produits_complementaires")
        .update({ phrase_conseil: item.phrase })
        .eq("id", item.id);
      if (error) {
        errors.push(`${item.id}: ${error.message}`);
      } else {
        done++;
      }
    }

    return new Response(JSON.stringify({ done, errors: errors.length, error_details: errors.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
