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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin role
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: claims.claims.sub,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, pharmacy_id, lgo_type } = await req.json();

    if (!email || !password || !pharmacy_id) {
      return new Response(JSON.stringify({ error: "Email, mot de passe et pharmacie requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with admin API (auto-confirms email).
    // If a user with that email already exists, reuse it and just rebind to the
    // new pharmacy instead of failing — this lets admins re-link an existing
    // pharmacist account to a freshly created pharmacy row.
    let userId: string | null = null;
    let reused = false;

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr) {
      const code = (createErr as any)?.code;
      const status = (createErr as any)?.status;
      const alreadyExists =
        code === "email_exists" ||
        status === 422 ||
        /already been registered|already exists/i.test(createErr.message || "");

      if (!alreadyExists) throw createErr;

      // Look up existing user by email via the admin listUsers endpoint
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;
      const existing = list?.users?.find(
        (u) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (!existing) throw createErr;

      userId = existing.id;
      reused = true;

      // Reset password to the one provided by the admin so they can hand it
      // over to the pharmacist.
      await supabase.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { ...(existing.user_metadata || {}), full_name },
      });
    } else {
      userId = newUser.user.id;
    }

    // Update profile with pharmacy_id (works for new and reused users)
    await supabase
      .from("profiles")
      .update({ pharmacy_id, full_name })
      .eq("id", userId);

    // Assign preparateur role (idempotent via unique constraint)
    await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "preparateur" })
      .select()
      .then(({ error }) => {
        // ignore duplicate-key violations on (user_id, role)
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      });

    // Create LGO config placeholder if lgo_type provided
    if (lgo_type) {
      const { data: existing } = await supabase
        .from("pharmacy_lgo_config")
        .select("id")
        .eq("pharmacy_id", pharmacy_id)
        .single();

      if (!existing) {
        await supabase.from("pharmacy_lgo_config").insert({
          pharmacy_id,
          lgo_type,
          api_base_url: "",
          enabled: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, reused }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-pharmacy-account error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});