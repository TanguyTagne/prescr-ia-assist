import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_PREFIX = "asclion-";
const ALLOWED_EXT = /\.(csv|tsv|txt)$/i;

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await anon.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: claims.claims.sub,
      _role: "admin",
    });
    if (!isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const url = new URL(req.url);
    const file = url.searchParams.get("file") ?? "asclion-medicaments-avec-pcs.csv";

    // Path traversal & allowlist validation
    if (
      file.includes("..") ||
      file.includes("/") ||
      file.includes("\\") ||
      !file.startsWith(ALLOWED_PREFIX) ||
      !ALLOWED_EXT.test(file)
    ) {
      return json({ error: "Invalid file name" }, 400);
    }

    const { data, error } = await admin.storage.from("imports").download(file);
    if (error || !data) {
      console.error("peek-import-csv download error:", error);
      return json({ error: "File not found" }, 404);
    }

    const text = await data.text();
    const lines = text.split("\n").slice(0, 8);
    return json({
      size: text.length,
      total_lines: text.split("\n").length,
      preview: lines,
    });
  } catch (e) {
    console.error("peek-import-csv error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
