import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DemoLead {
  id: string;
  session_id: string;
  nom: string;
  officine: string;
  email: string;
  status: string;
  notes: string | null;
  contacted_at: string | null;
  created_at: string;
}

const ORDO_LABELS: Record<string, string> = {
  "med-generale": "Méd. générale",
  "soins-infirmiers": "Soins infirmiers",
  cardiologie: "Cardiologie",
};

const STATUSES = ["nouveau", "contacté", "converti", "pas intéressé"];

const STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-primary/10 text-primary",
  "contacté": "bg-amber-500/10 text-amber-600",
  "converti": "bg-emerald-500/10 text-emerald-600",
  "pas intéressé": "bg-muted text-muted-foreground",
};

const DemoLeadsTab = () => {
  const [leads, setLeads] = useState<DemoLead[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [leadsRes, sessRes] = await Promise.all([
      supabase.from("demo_leads" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("demo_sessions" as any).select("session_id, ordonnance_id"),
    ]);
    const sm: Record<string, string[]> = {};
    ((sessRes.data as any[]) || []).forEach((s: any) => {
      if (!sm[s.session_id]) sm[s.session_id] = [];
      if (!sm[s.session_id].includes(s.ordonnance_id)) sm[s.session_id].push(s.ordonnance_id);
    });
    setSessionMap(sm);
    setLeads((leadsRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateLead = async (id: string, patch: Partial<DemoLead>) => {
    const { error } = await supabase.from("demo_leads" as any).update(patch).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleStatusChange = (id: string, status: string) => {
    const patch: Partial<DemoLead> = { status };
    if (status === "contacté") patch.contacted_at = new Date().toISOString();
    updateLead(id, patch);
  };

  const exportCSV = () => {
    const rows = [
      ["Date", "Nom", "Officine", "Email", "Ordonnances testées", "Statut", "Contacté le", "Notes"],
      ...leads.map((l) => [
        new Date(l.created_at).toLocaleString("fr-FR"),
        l.nom,
        l.officine,
        l.email,
        (sessionMap[l.session_id] || []).map((o) => ORDO_LABELS[o] || o).join(" / "),
        l.status,
        l.contacted_at ? new Date(l.contacted_at).toLocaleString("fr-FR") : "",
        l.notes || "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{leads.length}</strong> lead{leads.length > 1 ? "s" : ""} collecté{leads.length > 1 ? "s" : ""}
        </div>
        <Button onClick={exportCSV} size="sm" variant="outline" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Officine</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Ordonnances</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const ordos = sessionMap[l.session_id] || [];
                return (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/20 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col leading-tight">
                        <span>
                          {new Date(l.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(l.created_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{l.nom}</td>
                    <td className="px-3 py-2">{l.officine}</td>
                    <td className="px-3 py-2">
                      <a
                        href={`mailto:${l.email}?subject=${encodeURIComponent("Asclion - suite à votre démo")}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {l.email}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {ordos.length === 0 && <span className="text-muted-foreground">—</span>}
                        {ordos.map((o) => (
                          <span
                            key={o}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[10px]"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {ORDO_LABELS[o] || o}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusChange(l.id, e.target.value)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border-0 ${STATUS_COLORS[l.status] || ""}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <input
                        type="text"
                        defaultValue={l.notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (l.notes || "")) {
                            updateLead(l.id, { notes: e.target.value || null });
                          }
                        }}
                        placeholder="—"
                        className="w-full bg-transparent text-xs border-0 focus:outline-none focus:bg-muted/40 px-1 rounded"
                      />
                    </td>
                  </tr>
                );
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun lead pour l'instant.
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

export default DemoLeadsTab;
