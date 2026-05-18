import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

interface FeedbackRow {
  id: string;
  pharmacy_id: string;
  medicament_nom: string;
  pc_nom: string;
  pc_categorie: string | null;
  created_at: string;
}

interface PharmacyGroup {
  pharmacy_id: string;
  pharmacy_name: string;
  total: number;
  pcs: Map<string, { count: number; last: string; categorie: string | null; meds: Set<string> }>;
  recent: FeedbackRow[];
}

const AcceptedPcsTab = () => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PharmacyGroup[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [pharmRes, feedbackRes] = await Promise.all([
      supabase.from("pharmacies").select("id, name"),
      supabase
        .from("pc_feedback")
        .select("id, pharmacy_id, medicament_nom, pc_nom, pc_categorie, created_at")
        .eq("action", "accepted")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const pharmMap = new Map<string, string>(
      (pharmRes.data || []).map((p: any) => [p.id, p.name]),
    );
    const byPharm = new Map<string, PharmacyGroup>();

    for (const fb of (feedbackRes.data || []) as FeedbackRow[]) {
      let g = byPharm.get(fb.pharmacy_id);
      if (!g) {
        g = {
          pharmacy_id: fb.pharmacy_id,
          pharmacy_name: pharmMap.get(fb.pharmacy_id) || fb.pharmacy_id.slice(0, 8),
          total: 0,
          pcs: new Map(),
          recent: [],
        };
        byPharm.set(fb.pharmacy_id, g);
      }
      g.total++;
      const existing = g.pcs.get(fb.pc_nom);
      if (existing) {
        existing.count++;
        existing.meds.add(fb.medicament_nom);
      } else {
        g.pcs.set(fb.pc_nom, {
          count: 1,
          last: fb.created_at,
          categorie: fb.pc_categorie,
          meds: new Set([fb.medicament_nom]),
        });
      }
      if (g.recent.length < 20) g.recent.push(fb);
    }

    setGroups(
      Array.from(byPharm.values()).sort((a, b) => b.total - a.total),
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        pcs: new Map(
          Array.from(g.pcs.entries()).filter(
            ([pc]) => pc.toLowerCase().includes(q) || g.pharmacy_name.toLowerCase().includes(q),
          ),
        ),
      }))
      .filter(
        (g) => g.pcs.size > 0 || g.pharmacy_name.toLowerCase().includes(q),
      );
  }, [groups, filter]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">PC acceptés par pharmacie</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tous les produits complémentaires marqués « accepté » (commande / clic) par chaque officine.
        </p>
      </div>

      <Input
        placeholder="Filtrer par PC ou pharmacie…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucun PC accepté pour le moment.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const isOpen = expanded[g.pharmacy_id] ?? true;
            const pcList = Array.from(g.pcs.entries()).sort(
              (a, b) => b[1].count - a[1].count,
            );
            return (
              <Card key={g.pharmacy_id} className="p-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [g.pharmacy_id]: !isOpen,
                    }))
                  }
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">{g.pharmacy_name}</span>
                  </div>
                  <Badge variant="secondary">{g.total} acceptés • {g.pcs.size} PC uniques</Badge>
                </button>

                {isOpen && (
                  <div className="mt-4 border-t pt-3 space-y-2">
                    {pcList.map(([pc, data]) => (
                      <div
                        key={pc}
                        className="flex items-start justify-between gap-3 text-sm py-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{pc}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {data.categorie ? `${data.categorie} • ` : ""}
                            Suite à : {Array.from(data.meds).slice(0, 3).join(", ")}
                            {data.meds.size > 3 ? `, +${data.meds.size - 3}` : ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline">{data.count}×</Badge>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(data.last).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          Rafraîchir
        </Button>
      </div>
    </div>
  );
};

export default AcceptedPcsTab;
