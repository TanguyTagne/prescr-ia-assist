import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Flag, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Signalement {
  id: string;
  pharmacy_id: string;
  user_id: string;
  type: "medicament_different" | "pc_inadapte";
  medicament_nom: string;
  pc_nom: string | null;
  pc_categorie: string | null;
  commentaire: string | null;
  status: "nouveau" | "en_cours" | "resolu" | "rejete";
  admin_notes: string | null;
  created_at: string;
  context: any;
}

const STATUS_LABELS: Record<Signalement["status"], string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
  rejete: "Rejeté",
};

const SignalementsTab = () => {
  const [items, setItems] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Signalement["status"] | "all">("nouveau");
  const [pharmacies, setPharmacies] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signalements" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      toast.error("Erreur de chargement");
    } else {
      setItems((data as any) || []);
      const ids = Array.from(new Set(((data as any) || []).map((d: any) => d.pharmacy_id)));
      if (ids.length) {
        const { data: phs } = await supabase.from("pharmacies").select("id,name").in("id", ids as any);
        const map: Record<string, string> = {};
        (phs || []).forEach((p: any) => (map[p.id] = p.name));
        setPharmacies(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: Signalement["status"]) => {
    const { error } = await supabase
      .from("signalements" as any)
      .update({ status, resolved_at: status === "resolu" || status === "rejete" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast.error("Erreur");
      return;
    }
    toast.success("Mis à jour");
    load();
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const counts = {
    nouveau: items.filter((i) => i.status === "nouveau").length,
    en_cours: items.filter((i) => i.status === "en_cours").length,
    resolu: items.filter((i) => i.status === "resolu").length,
    rejete: items.filter((i) => i.status === "rejete").length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={filter === "nouveau" ? "default" : "outline"} size="sm" onClick={() => setFilter("nouveau")}>
          Nouveaux ({counts.nouveau})
        </Button>
        <Button variant={filter === "en_cours" ? "default" : "outline"} size="sm" onClick={() => setFilter("en_cours")}>
          En cours ({counts.en_cours})
        </Button>
        <Button variant={filter === "resolu" ? "default" : "outline"} size="sm" onClick={() => setFilter("resolu")}>
          Résolus ({counts.resolu})
        </Button>
        <Button variant={filter === "rejete" ? "default" : "outline"} size="sm" onClick={() => setFilter("rejete")}>
          Rejetés ({counts.rejete})
        </Button>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          Tous ({items.length})
        </Button>
        <Button variant="ghost" size="icon" onClick={load} className="h-8 w-8 ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">Aucun signalement.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start gap-2 flex-wrap">
                <Badge
                  className={
                    s.type === "medicament_different"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }
                >
                  <Flag className="h-3 w-3 mr-1" />
                  {s.type === "medicament_different" ? "Médicament différent" : "PC inadapté"}
                </Badge>
                <Badge variant="outline">{STATUS_LABELS[s.status]}</Badge>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {pharmacies[s.pharmacy_id] || "—"} •{" "}
                  {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>

              <div className="text-sm">
                <div>
                  <span className="text-muted-foreground">Médicament :</span>{" "}
                  <span className="font-medium">{s.medicament_nom}</span>
                </div>
                {s.pc_nom && (
                  <div>
                    <span className="text-muted-foreground">PC concerné :</span>{" "}
                    <span className="font-medium">{s.pc_nom}</span>
                    {s.pc_categorie && (
                      <span className="text-xs text-muted-foreground"> ({s.pc_categorie})</span>
                    )}
                  </div>
                )}
                {s.commentaire && (
                  <div className="mt-1 text-xs text-foreground/80 italic">"{s.commentaire}"</div>
                )}
              </div>

              {s.status !== "resolu" && s.status !== "rejete" && (
                <div className="flex gap-1.5 pt-1">
                  {s.status === "nouveau" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateStatus(s.id, "en_cours")}>
                      <Clock className="h-3 w-3" />
                      Prendre en charge
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateStatus(s.id, "resolu")}>
                    <Check className="h-3 w-3" />
                    Résolu
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateStatus(s.id, "rejete")}>
                    <X className="h-3 w-3" />
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignalementsTab;
