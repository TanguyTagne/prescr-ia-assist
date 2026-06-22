import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe2, FileText, ExternalLink, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DemoSession {
  id: string;
  session_id: string;
  ordonnance_id: string;
  ip_country: string | null;
  ip_city: string | null;
  referrer: string | null;
  user_agent: string | null;
  converted_to_lead: boolean;
  created_at: string;
}

const ORDO_LABELS: Record<string, string> = {
  "med-generale": "Médecine générale",
  "soins-infirmiers": "Soins infirmiers",
  cardiologie: "Cardiologie",
};

const formatReferrer = (r: string | null) => {
  if (!r) return "Direct";
  try {
    const u = new URL(r);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return r.slice(0, 40);
  }
};

const DemoSessionsTab = () => {
  const [sessions, setSessions] = useState<DemoSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("demo_sessions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);
      setSessions((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const total = sessions.length;
  const converted = sessions.filter((s) => s.converted_to_lead).length;
  const uniqueSessions = new Set(sessions.map((s) => s.session_id)).size;
  const conversionRate = uniqueSessions > 0 ? ((converted / uniqueSessions) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Démos lancées</div>
          <div className="text-2xl font-bold">{total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Visiteurs uniques</div>
          <div className="text-2xl font-bold">{uniqueSessions}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Leads collectés</div>
          <div className="text-2xl font-bold text-primary">{converted}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Conversion
          </div>
          <div className="text-2xl font-bold">{conversionRate}%</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Ordonnance</th>
                <th className="px-3 py-2 text-left">Localisation</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Converti</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {ORDO_LABELS[s.ordonnance_id] || s.ordonnance_id}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Globe2 className="h-3 w-3" />
                      {[s.ip_city, s.ip_country].filter(Boolean).join(", ") || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {s.referrer && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      {formatReferrer(s.referrer)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {s.converted_to_lead ? (
                      <span className="text-primary font-semibold">✓ Lead</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Aucune session démo pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default DemoSessionsTab;
