import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin requis" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email) {
      return new Response(JSON.stringify({ error: "Aucune adresse email sur ce compte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from("admin_2fa_codes")
      .upsert({ user_id: user.id, code_hash, expires_at, attempts: 0 });
    if (upsertErr) throw upsertErr;

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquante");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#ffffff">
        <h2 style="color:#111;margin:0 0 12px">Code de connexion Asclion Admin</h2>
        <p style="color:#444;margin:0 0 20px">Votre code de vérification à deux facteurs :</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 24px;background:#f4f4f5;border-radius:8px;text-align:center;color:#111">${code}</div>
        <p style="color:#666;margin:20px 0 0;font-size:13px">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez votre mot de passe.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Asclion Admin <onboarding@resend.dev>",
        to: user.email,
        subject: `Code Asclion Admin : ${code}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      return new Response(JSON.stringify({ error: "Envoi email échoué" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, email: user.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-admin-2fa-code error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
