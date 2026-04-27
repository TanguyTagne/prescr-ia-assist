import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Panneau "Mes données" — accessible aux pharmaciens et admins.
 * Permet l'export complet (RGPD Art. 20) et la suppression (Art. 17).
 */
const MesDonneesPanel = () => {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr-data-request`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "export" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec de l'export");
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `asclion-mes-donnees-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success("Export téléchargé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr-data-request`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "delete" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Échec");
      toast.success("Données anonymisées avec succès");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Mes données</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exercez vos droits RGPD (portabilité, effacement) en un clic.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Download className="h-6 w-6 text-primary mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Exporter mes données (Article 20 RGPD)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Téléchargez un fichier JSON contenant l'intégralité des données associées à votre
              pharmacie : analyses, feedback produits, ventes, registres, préférences.
            </p>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exporter (JSON)
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-destructive/30">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-destructive mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1 text-destructive">
              Supprimer mes données (Article 17 RGPD)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Les données nominatives seront anonymisées (hashes patients, rappels).
              La pharmacie sera désactivée et l'accès au logiciel suspendu. Les KPIs anonymisés
              sont conservés à des fins statistiques agrégées.
              <strong className="block mt-2 text-destructive">
                Cette action est irréversible.
              </strong>
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Demander la suppression
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toutes les données nominatives seront anonymisées et votre accès suspendu.
                    Cette action est définitive et opposable au titre du RGPD.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MesDonneesPanel;
