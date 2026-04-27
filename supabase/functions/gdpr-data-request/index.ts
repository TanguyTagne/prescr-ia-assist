import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// UUID conventionnel pour anonymisation (toutes les pharmacies supprimées pointent vers cet UUID)
const DELETED_PHARMACY_UUID = "00000000-0000-0000-0000-000000000001";

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
      return jsonError("Non autorisé", 401);
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonError("Non autorisé", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's pharmacy + admin status
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("pharmacy_id").eq("id", user.id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);

    const body = await req.json().catch(() => ({}));
    const { action, pharmacy_id: targetPharmacyId } = body as {
      action?: "export" | "delete";
      pharmacy_id?: string;
    };

    if (!action || !["export", "delete"].includes(action)) {
      return jsonError("Action invalide (export ou delete)", 400);
    }

    // Pharmacie cible : admin peut spécifier, sinon = celle de l'utilisateur
    const pharmacyId = isAdmin && targetPharmacyId ? targetPharmacyId : profile?.pharmacy_id;
    if (!pharmacyId) return jsonError("Aucune pharmacie associée", 400);

    // Sécurité : non-admin ne peut agir que sur sa propre pharmacie
    if (!isAdmin && pharmacyId !== profile?.pharmacy_id) {
      return jsonError("Accès refusé", 403);
    }

    // Log la demande
    const { data: requestLog } = await supabase
      .from("gdpr_requests")
      .insert({
        pharmacy_id: pharmacyId,
        requested_by: user.id,
        request_type: action,
        status: "processing",
        ip_address: req.headers.get("x-forwarded-for") || null,
      })
      .select()
      .single();

    if (action === "export") {
      // Récupère toutes les données de la pharmacie
      const [analyses, feedback, sales, registers, reminders, lgoConfig, mapping, prefs, quotas] = await Promise.all([
        supabase.from("analysis_history").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("pc_feedback").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("sales_transactions" as any).select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("pharmacy_registers").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("patient_reminders").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("pharmacy_lgo_config" as any).select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("product_mapping" as any).select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("pharmacy_preferences").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("pharmacy_quotas").select("*").eq("pharmacy_id", pharmacyId),
      ]);

      const exportPayload = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          pharmacy_id: pharmacyId,
          requested_by: user.id,
          format: "JSON",
          rgpd_article: "Article 20 - Droit à la portabilité",
        },
        analyses: analyses.data || [],
        product_feedback: feedback.data || [],
        sales: sales.data || [],
        registers: registers.data || [],
        reminders: reminders.data || [],
        lgo_config: lgoConfig.data || [],
        product_mapping: mapping.data || [],
        preferences: prefs.data || [],
        quotas: quotas.data || [],
      };

      // Mise à jour log
      await supabase
        .from("gdpr_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result_summary: {
            analyses_count: exportPayload.analyses.length,
            feedback_count: exportPayload.product_feedback.length,
            sales_count: exportPayload.sales.length,
          },
        })
        .eq("id", requestLog?.id);

      return new Response(JSON.stringify(exportPayload), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="asclion-export-${pharmacyId}-${Date.now()}.json"`,
        },
      });
    }

    if (action === "delete") {
      // Anonymisation (soft delete) : on conserve les KPIs anonymisés mais on coupe le lien
      const summary: Record<string, number> = {};

      // Anonymise hashes patients dans analysis_history
      const { count: anonymizedAnalyses } = await supabase
        .from("analysis_history")
        .update({
          patient_hash: "DELETED",
          patient_name: null,
          metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
        } as any)
        .eq("pharmacy_id", pharmacyId)
        .select("id", { count: "exact", head: true });
      summary.analyses_anonymized = anonymizedAnalyses || 0;

      // Supprime rappels patient (PII directe)
      const { count: deletedReminders } = await supabase
        .from("patient_reminders")
        .delete()
        .eq("pharmacy_id", pharmacyId)
        .select("id", { count: "exact", head: true });
      summary.reminders_deleted = deletedReminders || 0;

      // Pause la pharmacie (status = 'disabled')
      await supabase
        .from("pharmacies")
        .update({ status: "disabled" })
        .eq("id", pharmacyId);
      summary.pharmacy_disabled = 1;

      await supabase
        .from("gdpr_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result_summary: summary,
        })
        .eq("id", requestLog?.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Données anonymisées avec succès. La pharmacie a été désactivée.",
          summary,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return jsonError("Action non supportée", 400);
  } catch (e) {
    console.error("gdpr-data-request error:", e);
    return jsonError(e instanceof Error ? e.message : "Erreur", 500);
  }

  function jsonError(msg: string, status: number) {
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
