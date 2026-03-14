import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // List files in downloads bucket to find latest .exe
    const { data: files, error: listError } = await supabase.storage
      .from("downloads")
      .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    if (listError) throw listError;

    const exeFile = files?.find((f) => f.name.endsWith(".exe"));
    if (!exeFile) {
      return new Response(JSON.stringify({ error: "Aucun installeur disponible" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("downloads")
      .getPublicUrl(exeFile.name);

    // Redirect to the public URL
    return new Response(null, {
      status: 302,
      headers: {
        Location: urlData.publicUrl,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
