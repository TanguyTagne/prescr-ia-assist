import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// DDL idempotent — safe to run multiple times
const MIGRATIONS = [
  // ── scan_events ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS public.scan_events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    pharmacy_id       UUID        REFERENCES public.pharmacies(id) ON DELETE SET NULL,
    user_id           UUID,
    register_id       TEXT,
    ean_code          TEXT        NOT NULL,
    status            TEXT        NOT NULL
                      CHECK (status IN ('success','no_match','no_pharmacy','error','anti_loop')),
    product_name      TEXT,
    suggestions_count INT         NOT NULL DEFAULT 0,
    error_message     TEXT,
    metadata          JSONB
  )`,
  `CREATE INDEX IF NOT EXISTS scan_events_created_at_idx
     ON public.scan_events (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS scan_events_pharmacy_id_idx
     ON public.scan_events (pharmacy_id)`,
  `CREATE INDEX IF NOT EXISTS scan_events_status_idx
     ON public.scan_events (status)`,
  `ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY`,
  // Trigger: auto-fill user_id from JWT
  `CREATE OR REPLACE FUNCTION public.set_scan_event_user()
   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   BEGIN
     NEW.user_id := auth.uid();
     RETURN NEW;
   END;
   $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'scan_events_set_user'
     ) THEN
       CREATE TRIGGER scan_events_set_user
         BEFORE INSERT ON public.scan_events
         FOR EACH ROW EXECUTE FUNCTION public.set_scan_event_user();
     END IF;
   END $$`,
  // RLS policies (DO block so they're idempotent)
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'scan_events'
         AND policyname = 'Authenticated users can insert scan events'
     ) THEN
       CREATE POLICY "Authenticated users can insert scan events"
         ON public.scan_events
         FOR INSERT TO authenticated
         WITH CHECK (true);
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'scan_events'
         AND policyname = 'Admins can read all scan events'
     ) THEN
       CREATE POLICY "Admins can read all scan events"
         ON public.scan_events
         FOR SELECT TO authenticated
         USING (has_role(auth.uid(), 'admin'::app_role));
     END IF;
   END $$`,
];

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Verify admin ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: userErr } =
      await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Run migrations via Postgres REST ────────────────────────────────────
    // Supabase exposes a /rest/v1/rpc endpoint — we use the pg connection
    // available to edge functions via the SUPABASE_DB_URL env var.
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL not available in this environment");
    }

    // Use the built-in postgres driver available in Supabase edge runtime
    const { default: postgres } = await import("npm:postgres@3");
    const sql = postgres(dbUrl, { max: 1, ssl: "require" });

    const results: string[] = [];
    for (const ddl of MIGRATIONS) {
      try {
        await sql.unsafe(ddl);
        results.push("OK");
      } catch (e) {
        // Log but don't abort — some statements are already applied
        results.push(`SKIP: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await sql.end();

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("ensure-tables error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
