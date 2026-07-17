// Monthly recap email per pharmacy.
// Body: { pharmacy_id?: uuid, month?: "YYYY-MM-01", dry_run?: boolean, preview?: boolean }
// - No body / cron: iterate all active pharmacies, previous month
// - preview=true : returns { html, subject, stats } without sending (used by admin UI)
// - dry_run=true : compute + return summary but no email sent
//
// CA estimate: nb PC acceptés × PRIX_MOYEN_PARAPHARMACIE.
// Calibrage 2026-07 : 10€ (fourchette observée : cosmétique 15€, vitamine 8€, antalgique OTC 6€, DM 20€).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIX_MOYEN_PC_EUR = 10;
const FROM_EMAIL = "Asclion <onboarding@resend.dev>";
const ADMIN_BCC = "tanguytagne12@gmail.com";

// Asclion brand palette (aligned with src/index.css : --primary 173 58% 32%)
const BRAND = {
  primary: "#227a71",       // hsl(173 58% 32%)
  primaryDark: "#1a5f57",
  primaryLight: "#e0f2ef",  // hsl(173 40% 92%)
  teal: "#339999",          // hsl(180 50% 40%)
  warm: "#e89547",          // hsl(30 80% 55%)
  ink: "#1e2b30",           // hsl(200 25% 14%)
  muted: "#5b6e76",         // hsl(200 12% 40%)
  border: "#dbe4e0",        // hsl(150 15% 88%)
  bg: "#f5faf7",            // hsl(150 20% 98%)
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function frMonth(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
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
  caEstime: number;
  topProducts: { name: string; accepted: number }[];
  bestDay: { date: string; count: number } | null;
  rank: { position: number; total: number; topPercent: number } | null;
}

function renderHtml(s: RecapStats): string {
  const topRows = s.topProducts.length === 0
    ? `<tr><td colspan="2" style="padding:18px;text-align:center;color:${BRAND.muted};font-size:14px">Pas encore de best-sellers ce mois-ci</td></tr>`
    : s.topProducts.map((p, i) => `
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid ${BRAND.border};color:${BRAND.ink};font-weight:600;font-size:14px">
            <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:${BRAND.primaryLight};color:${BRAND.primary};border-radius:50%;font-size:12px;font-weight:700;margin-right:12px">${i + 1}</span>${esc(p.name)}
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid ${BRAND.border};text-align:right;color:${BRAND.muted};font-size:13px;white-space:nowrap">${p.accepted} accepté${p.accepted > 1 ? "s" : ""}</td>
        </tr>`).join("");

  // Ranking block
  const rankBlock = (() => {
    if (!s.rank || s.rank.total < 2) return "";
    const { position, total, topPercent } = s.rank;
    const isTop = topPercent <= 50;
    if (isTop) {
      return `
      <div style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.teal} 100%);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;color:#ffffff">
        <div style="font-size:32px;margin-bottom:8px">🏆</div>
        <div style="font-size:13px;color:#d7f0ec;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Classement du réseau</div>
        <div style="font-size:22px;font-weight:700;line-height:1.3;margin-bottom:6px">Vous êtes dans le top ${topPercent}%<br/>des meilleurs utilisateurs Asclion&nbsp;!</div>
        <div style="font-size:14px;color:#d7f0ec">Félicitations 🎉</div>
      </div>`;
    }
    return `
      <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:22px;text-align:center;margin-bottom:24px">
        <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px">Classement</div>
        <div style="font-size:18px;font-weight:700;color:${BRAND.ink}">Top ${topPercent}% du réseau Asclion</div>
      </div>`;
  })();

  const bestDayBlock = s.bestDay
    ? `
      <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:22px;margin-bottom:24px;display:block">
        <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px">Votre meilleur jour</div>
        <div style="font-size:20px;font-weight:700;color:${BRAND.ink};text-transform:capitalize">${esc(s.bestDay.date)}</div>
        <div style="font-size:14px;color:${BRAND.primary};font-weight:600;margin-top:4px">${s.bestDay.count} PC accepté${s.bestDay.count > 1 ? "s" : ""} sur la journée</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Récap Asclion</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.ink}">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">

    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:12px;letter-spacing:2px;color:${BRAND.primary};text-transform:uppercase;margin-bottom:8px;font-weight:600">Récap mensuel</div>
      <div style="font-size:34px;font-weight:700;color:${BRAND.primary};letter-spacing:-0.5px">Asclion</div>
    </div>

    <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(30,43,48,0.05);margin-bottom:24px;border:1px solid ${BRAND.border}">
      <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${esc(s.monthLabel)}</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.3px">${esc(s.pharmacyName)}</h1>
      <p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.5">Voici votre performance Asclion sur le mois écoulé.</p>
    </div>

    <div style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.teal} 100%);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;color:#ffffff;box-shadow:0 10px 30px -12px rgba(34,122,113,0.4)">
      <div style="font-size:13px;color:#d7f0ec;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">CA additionnel estimé</div>
      <div style="font-size:48px;font-weight:700;letter-spacing:-1px;line-height:1">${fmtEur(s.caEstime)}</div>
      <div style="font-size:13px;color:#d7f0ec;margin-top:12px">généré grâce aux recommandations Asclion</div>
    </div>

    ${rankBlock}

    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:12px 0;margin-bottom:24px">
      <tr>
        <td style="width:50%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;padding:20px;text-align:center;vertical-align:top">
          <div style="font-size:28px;font-weight:700;color:${BRAND.primary}">${fmtInt(s.analyses)}</div>
          <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Analyses</div>
        </td>
        <td style="width:50%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;padding:20px;text-align:center;vertical-align:top">
          <div style="font-size:28px;font-weight:700;color:${BRAND.primary}">${fmtInt(s.pcAcceptes)}</div>
          <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">PC acceptés</div>
        </td>
      </tr>
    </table>

    ${bestDayBlock}

    <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:8px 0;margin-bottom:24px">
      <div style="padding:20px 24px 12px">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:${BRAND.ink}">Vos best-sellers</h2>
        <p style="margin:4px 0 0;font-size:13px;color:${BRAND.muted}">Top 5 produits complémentaires du mois</p>
      </div>
      <table style="width:100%;border-collapse:collapse">${topRows}</table>
    </div>

    <div style="background:${BRAND.primaryLight};border-radius:12px;padding:16px 20px;margin-bottom:32px">
      <p style="margin:0;font-size:12px;color:${BRAND.primaryDark};line-height:1.6">
        <strong>Méthode</strong> — CA estimé sur base d'un prix moyen parapharmacie de ${PRIX_MOYEN_PC_EUR}€ par PC accepté.
        Classement calculé sur le nombre de PC acceptés parmi les pharmacies actives du réseau.
      </p>
    </div>

    <div style="text-align:center;padding:24px 0;border-top:1px solid ${BRAND.border}">
      <div style="font-size:13px;color:${BRAND.muted};margin-bottom:4px">Asclion — copilote parapharmacie</div>
      <div style="font-size:12px;color:${BRAND.muted}">
        <a href="https://asclion.com" style="color:${BRAND.primary};text-decoration:none;font-weight:600">asclion.com</a>
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
  const [{ data: feedback }, { count: analysesCount }] = await Promise.all([
    supabase.from("pc_feedback").select("pc_nom, action, created_at")
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
    supabase.from("analysis_history").select("*", { count: "exact", head: true })
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
  ]);

  const acceptedList = (feedback ?? []).filter((f: any) => f.action === "accepted");
  const pcAcceptes = acceptedList.length;

  const acceptedByName = new Map<string, number>();
  const acceptedByDay = new Map<string, number>();
  for (const f of acceptedList) {
    const name = String((f as any).pc_nom ?? "").trim();
    if (name) acceptedByName.set(name, (acceptedByName.get(name) ?? 0) + 1);
    const dayKey = String((f as any).created_at ?? "").slice(0, 10);
    if (dayKey) acceptedByDay.set(dayKey, (acceptedByDay.get(dayKey) ?? 0) + 1);
  }

  const topProducts = [...acceptedByName.entries()]
    .map(([name, accepted]) => ({ name, accepted }))
    .sort((a, b) => b.accepted - a.accepted)
    .slice(0, 5);

  let bestDay: RecapStats["bestDay"] = null;
  if (acceptedByDay.size > 0) {
    const [dayKey, count] = [...acceptedByDay.entries()].sort((a, b) => b[1] - a[1])[0];
    bestDay = { date: frDate(new Date(dayKey + "T00:00:00Z")), count };
  }

  return {
    pharmacyName,
    monthLabel: frMonth(monthStart),
    analyses: analysesCount ?? 0,
    pcAcceptes,
    caEstime: pcAcceptes * PRIX_MOYEN_PC_EUR,
    topProducts,
    bestDay,
    rank: null, // filled by caller
  };
}

/**
 * Returns a Map<pharmacy_id, {position, total, topPercent}> ranking active
 * pharmacies by number of PC accepted on the given month.
 */
async function computeNetworkRanking(
  supabase: ReturnType<typeof createClient>,
  monthStart: Date,
  monthEnd: Date,
): Promise<Map<string, { position: number; total: number; topPercent: number }>> {
  const { data } = await supabase.from("pc_feedback")
    .select("pharmacy_id, action")
    .eq("action", "accepted")
    .gte("created_at", monthStart.toISOString())
    .lt("created_at", monthEnd.toISOString());

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as any[]) {
    const pid = row.pharmacy_id;
    if (!pid) continue;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.length;
  const out = new Map<string, { position: number; total: number; topPercent: number }>();
  sorted.forEach(([pid, _], idx) => {
    const position = idx + 1;
    const topPercent = Math.max(1, Math.round((position / total) * 100));
    out.set(pid, { position, total, topPercent });
  });
  return out;
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
    const { pharmacy_id, month, dry_run, preview, send_to } = body ?? {};

    let target: Date;
    if (month) {
      target = new Date(month);
    } else {
      const now = new Date();
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    }
    const monthStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1));

    const ranking = await computeNetworkRanking(supabase, monthStart, monthEnd);

    // Preview / send_to override: single pharmacy (or best pharmacy with activity if none passed)
    if (preview || send_to) {
      let pharm: any = null;
      if (pharmacy_id) {
        const { data } = await supabase.from("pharmacies").select("id, name").eq("id", pharmacy_id).maybeSingle();
        pharm = data;
      } else {
        // pick the pharmacy with most activity this month for a meaningful sample
        const topId = [...ranking.entries()].sort((a, b) => a[1].position - b[1].position)[0]?.[0];
        if (topId) {
          const { data } = await supabase.from("pharmacies").select("id, name").eq("id", topId).maybeSingle();
          pharm = data;
        }
        if (!pharm) {
          const { data } = await supabase.from("pharmacies").select("id, name").limit(1).maybeSingle();
          pharm = data;
        }
      }
      if (!pharm) return new Response(JSON.stringify({ error: "Pharmacy not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const stats = await computeStats(supabase, pharm.id, pharm.name, monthStart, monthEnd);
      stats.rank = ranking.get(pharm.id) ?? null;
      const html = renderHtml(stats);
      const subject = `Votre récap Asclion — ${stats.monthLabel}`;

      let sent: any = null;
      if (send_to) {
        sent = await sendResend([send_to], subject, html);
      }

      return new Response(JSON.stringify({ ok: true, stats, html, subject, sent, sent_to: send_to ?? null, pharmacy: { id: pharm.id, name: pharm.name } }), {
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
        stats.rank = ranking.get(p.id) ?? null;

        // Ne rien envoyer si aucune activité
        if (stats.analyses === 0 && stats.pcAcceptes === 0) {
          results.push({ pharmacy_id: p.id, skipped: "no_activity" });
          continue;
        }

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
