// Monthly recap email per pharmacy.
// Body: { pharmacy_id?: uuid, month?: "YYYY-MM-01", dry_run?: boolean, preview?: boolean }
// - No body / cron: iterate all active pharmacies, previous month
// - preview=true : returns { html, subject, stats } without sending (used by admin UI)
// - dry_run=true : compute + return summary but no email sent
//
// CA estimate: nb PC acceptés × PRIX_MOYEN_PARAPHARMACIE.
// Panier moyen parapharmacie France ~15€, mais un PC = 1 unité (pas le panier complet).
// Calibrage 2026-07 : 10€ (fourchette observée : cosmétique 15€, vitamine 8€, antalgique OTC 6€, DM 20€).
// À raffiner avec pc_pricing quand la couverture prix sera >70%.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIX_MOYEN_PC_EUR = 10;
const FROM_EMAIL = "Asclion <recap@asclion.com>"; // /!\ nécessite domaine asclion.com vérifié dans Resend
const ADMIN_BCC = "tanguytagne12@gmail.com";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function frMonth(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

interface RecapStats {
  pharmacyName: string;
  monthLabel: string;
  analyses: number;
  pcAcceptes: number;
  ventesTrackees: number;
  caEstime: number;
  topProducts: { name: string; score: number; accepted: number; sold: number }[];
}

function renderHtml(s: RecapStats): string {
  const topRows = s.topProducts.length === 0
    ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;font-size:14px">Pas encore de best-sellers ce mois-ci</td></tr>`
    : s.topProducts.map((p, i) => `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-weight:600">
            <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#0f172a;color:#fff;border-radius:50%;font-size:11px;margin-right:10px">${i + 1}</span>${esc(p.name)}
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;font-size:14px">${p.accepted} acceptés</td>
          <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;font-size:14px">${p.sold} vendus</td>
        </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Récap Asclion</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">

    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:14px;letter-spacing:2px;color:#64748b;text-transform:uppercase;margin-bottom:8px">Récap mensuel</div>
      <div style="font-size:32px;font-weight:700;color:#0f172a;letter-spacing:-0.5px">Asclion</div>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,0.06),0 20px 40px -20px rgba(15,23,42,0.1);margin-bottom:24px">
      <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${esc(s.monthLabel)}</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">${esc(s.pharmacyName)}</h1>
      <p style="margin:0;color:#475569;font-size:15px;line-height:1.5">Voici votre performance Asclion sur le mois écoulé.</p>
    </div>

    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;color:#fff">
      <div style="font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">CA additionnel estimé</div>
      <div style="font-size:48px;font-weight:700;letter-spacing:-1px;line-height:1">${fmtEur(s.caEstime)}</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:12px">généré grâce aux recommandations Asclion</div>
    </div>

    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:12px 0;margin-bottom:24px">
      <tr>
        <td style="width:33.33%;background:#fff;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
          <div style="font-size:28px;font-weight:700;color:#0f172a">${fmtInt(s.analyses)}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Analyses</div>
        </td>
        <td style="width:33.33%;background:#fff;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
          <div style="font-size:28px;font-weight:700;color:#0f172a">${fmtInt(s.pcAcceptes)}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">PC acceptés</div>
        </td>
        <td style="width:33.33%;background:#fff;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
          <div style="font-size:28px;font-weight:700;color:#0f172a">${fmtInt(s.ventesTrackees)}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Ventes tracées</div>
        </td>
      </tr>
    </table>

    <div style="background:#fff;border-radius:16px;padding:8px 0;margin-bottom:24px;box-shadow:0 1px 3px rgba(15,23,42,0.06)">
      <div style="padding:20px 24px 12px">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:#0f172a">Vos best-sellers</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b">Top 5 produits complémentaires du mois</p>
      </div>
      <table style="width:100%;border-collapse:collapse">${topRows}</table>
    </div>

    <div style="background:#f1f5f9;border-radius:12px;padding:16px 20px;margin-bottom:32px">
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6">
        <strong style="color:#334155">Méthode</strong> — CA estimé sur base d'un prix moyen parapharmacie de ${PRIX_MOYEN_PC_EUR}€ par PC accepté.
        Best-sellers classés par score mixte (acceptations + ventes réelles).
        Les ventes tracées proviennent de vos remontées LGO.
      </p>
    </div>

    <div style="text-align:center;padding:24px 0;border-top:1px solid #e2e8f0">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">Asclion — copilote parapharmacie</div>
      <div style="font-size:12px;color:#94a3b8">
        <a href="https://asclion.com" style="color:#64748b;text-decoration:none">asclion.com</a>
      </div>
    </div>

  </div>
</body></html>`;
}

async function computeStats(
  supabase: ReturnType<typeof createClient>,
  pharmacyId: string,
  pharmacyName: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<RecapStats> {
  const [{ data: analyses }, { data: feedback }, { data: sales }] = await Promise.all([
    supabase.from("analysis_history").select("id", { count: "exact", head: true })
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
    supabase.from("pc_feedback").select("pc_nom, action")
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
    supabase.from("sales_transactions").select("items")
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
  ]);

  const analysesCount = (analyses as any)?.length ?? 0; // fallback if count not returned as expected
  // Re-query count properly
  const { count: analysesCountReal } = await supabase.from("analysis_history").select("*", { count: "exact", head: true })
    .eq("pharmacy_id", pharmacyId)
    .gte("created_at", monthStart.toISOString())
    .lt("created_at", monthEnd.toISOString());

  const acceptedList = (feedback ?? []).filter((f: any) => f.action === "accepted");
  const pcAcceptes = acceptedList.length;

  // Ventes trackées : nombre d'items vendus dans sales_transactions
  let ventesTrackees = 0;
  const soldByName = new Map<string, number>();
  for (const s of (sales ?? [])) {
    const items = Array.isArray((s as any).items) ? (s as any).items : [];
    for (const it of items) {
      ventesTrackees++;
      const name = String(it?.name ?? it?.nom ?? it?.pc_nom ?? "").trim();
      if (name) soldByName.set(name, (soldByName.get(name) ?? 0) + 1);
    }
  }

  // Acceptés par PC
  const acceptedByName = new Map<string, number>();
  for (const f of acceptedList) {
    const name = String((f as any).pc_nom ?? "").trim();
    if (!name) continue;
    acceptedByName.set(name, (acceptedByName.get(name) ?? 0) + 1);
  }

  // Score mixé : accepted*1 + sold*2 (les ventes réelles pèsent plus)
  const allNames = new Set([...acceptedByName.keys(), ...soldByName.keys()]);
  const topProducts = [...allNames].map((name) => {
    const accepted = acceptedByName.get(name) ?? 0;
    const sold = soldByName.get(name) ?? 0;
    return { name, accepted, sold, score: accepted + sold * 2 };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    pharmacyName,
    monthLabel: frMonth(monthStart),
    analyses: analysesCountReal ?? analysesCount ?? 0,
    pcAcceptes,
    ventesTrackees,
    caEstime: pcAcceptes * PRIX_MOYEN_PC_EUR,
    topProducts,
  };
}

async function sendResend(to: string[], subject: string, html: string, bcc?: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, bcc, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { pharmacy_id, month, dry_run, preview } = body ?? {};

    let target: Date;
    if (month) {
      target = new Date(month);
    } else {
      const now = new Date();
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    }
    const monthStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1));

    // Preview: single pharmacy, no send
    if (preview && pharmacy_id) {
      const { data: pharm } = await supabase.from("pharmacies").select("id, name").eq("id", pharmacy_id).maybeSingle();
      if (!pharm) return new Response(JSON.stringify({ error: "Pharmacy not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const stats = await computeStats(supabase, (pharm as any).id, (pharm as any).name, monthStart, monthEnd);
      const html = renderHtml(stats);
      return new Response(JSON.stringify({ ok: true, stats, html, subject: `Votre récap Asclion — ${stats.monthLabel}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List pharmacies to process
    let query = supabase.from("pharmacies").select("id, name, status");
    if (pharmacy_id) query = query.eq("id", pharmacy_id);
    else query = query.or("status.eq.active,status.is.null");
    const { data: pharmacies, error: phErr } = await query;
    if (phErr) throw phErr;

    const results: any[] = [];
    for (const p of (pharmacies ?? []) as any[]) {
      try {
        const stats = await computeStats(supabase, p.id, p.name, monthStart, monthEnd);

        // Ne rien envoyer si aucune activité
        if (stats.analyses === 0 && stats.pcAcceptes === 0 && stats.ventesTrackees === 0) {
          results.push({ pharmacy_id: p.id, skipped: "no_activity" });
          continue;
        }

        // Emails des profils rattachés
        const { data: profiles } = await supabase.from("profiles").select("email").eq("pharmacy_id", p.id);
        const emails = [...new Set((profiles ?? []).map((x: any) => x.email).filter(Boolean))];

        if (emails.length === 0) {
          results.push({ pharmacy_id: p.id, skipped: "no_email" });
          continue;
        }

        if (dry_run) {
          results.push({ pharmacy_id: p.id, name: p.name, would_send_to: emails, stats });
          continue;
        }

        const html = renderHtml(stats);
        const subject = `Votre récap Asclion — ${stats.monthLabel}`;
        await sendResend(emails, subject, html, ADMIN_BCC);
        results.push({ pharmacy_id: p.id, name: p.name, sent_to: emails, ca: stats.caEstime });
      } catch (e) {
        console.error("recap failed for", p.id, e);
        results.push({ pharmacy_id: p.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      month: monthStart.toISOString().slice(0, 10),
      processed: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-monthly-recap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
