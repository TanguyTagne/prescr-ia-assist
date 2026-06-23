import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface RgpdEntry {
  id: string;
  nom_traitement: string;
  finalite: string;
  base_legale: string;
  categories_donnees: string;
  categories_personnes: string;
  destinataires: string;
  transferts_hors_ue: string;
  duree_conservation: string;
  mesures_securite: string;
  notes: string | null;
  active: boolean;
  ordre: number;
}

const RgpdTab = () => {
  const [entries, setEntries] = useState<RgpdEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rgpd_processing_register" as any)
      .select("*")
      .order("ordre", { ascending: true });
    if (error) {
      toast.error("Erreur de chargement du registre");
    } else {
      setEntries((data as unknown as RgpdEntry[]) || []);
    }
    setLoading(false);
  };

  const exportCsv = () => {
    const headers = [
      "Traitement",
      "Finalité",
      "Base légale",
      "Données traitées",
      "Personnes concernées",
      "Destinataires",
      "Transferts hors UE",
      "Durée de conservation",
      "Mesures de sécurité",
    ];
    const rows = entries.map((e) => [
      e.nom_traitement,
      e.finalite,
      e.base_legale,
      e.categories_donnees,
      e.categories_personnes,
      e.destinataires,
      e.transferts_hors_ue || "Aucun",
      e.duree_conservation,
      e.mesures_securite,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asclion-registre-rgpd-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Registre exporté");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Registre des traitements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Article 30 RGPD — Document opposable obligatoire pour tout responsable de traitement.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id} className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">{entry.nom_traitement}</h3>
              </div>
              <Badge variant={entry.active ? "default" : "secondary"}>
                {entry.active ? "Actif" : "Inactif"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Finalité" value={entry.finalite} />
              <Field label="Base légale" value={entry.base_legale} />
              <Field label="Données traitées" value={entry.categories_donnees} />
              <Field label="Personnes concernées" value={entry.categories_personnes} />
              <Field label="Destinataires" value={entry.destinataires} />
              <Field label="Transferts hors UE" value={entry.transferts_hors_ue || "Aucun"} />
              <Field label="Durée de conservation" value={entry.duree_conservation} />
              <Field label="Mesures de sécurité" value={entry.mesures_securite} />
            </div>

            {entry.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">{entry.notes}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
      {label}
    </div>
    <div>{value}</div>
  </div>
);

export default RgpdTab;
