import { useState } from "react";
import { Flag, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type SignalementType = "medicament_different" | "pc_inadapte";

interface ReportButtonProps {
  type: SignalementType;
  medicamentNom: string;
  pcNom?: string;
  pcCategorie?: string;
  context?: Record<string, any>;
}

const ReportButton = ({ type, medicamentNom, pcNom, pcCategorie, context }: ReportButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [vraiNom, setVraiNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isMedReport = type === "medicament_different";
  const cipScanned = (context as any)?.cip_scanned as string | undefined;

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Connexion requise pour signaler");
      return;
    }
    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single();

      if (!profile?.pharmacy_id) {
        toast.error("Aucune pharmacie associée");
        return;
      }

      const enrichedContext = {
        ...(context || {}),
        ...(vraiNom.trim() ? { vrai_nom_indique_par_pharmacien: vraiNom.trim() } : {}),
      };

      const { error } = await supabase.from("signalements" as any).insert({
        pharmacy_id: profile.pharmacy_id,
        user_id: user.id,
        type,
        medicament_nom: medicamentNom,
        pc_nom: pcNom || null,
        pc_categorie: pcCategorie || null,
        commentaire: comment.trim() || null,
        context: enrichedContext,
      });

      if (error) throw error;
      toast.success(
        isMedReport
          ? "Merci ! Le mauvais référencement sera corrigé sous 24h."
          : "Signalement envoyé. Merci !",
        { duration: 3000 },
      );
      setOpen(false);
      setComment("");
      setVraiNom("");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const title = isMedReport
    ? "Mauvais médicament identifié ?"
    : "Signaler un PC inadapté";

  return (
    <>
      {isMedReport ? (
        // Bouton visible "Mauvais médicament ?" pour le cas critique
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={title}
          title={title}
          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/30"
        >
          <AlertTriangle className="h-3 w-3" />
          <span>pas le bon médicament ?</span>
        </button>
      ) : (
        // Bouton drapeau discret pour les PCs
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={title}
          title={title}
          className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <Flag className="h-3 w-3" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-2 text-xs space-y-0.5">
              <div>
                <span className="text-muted-foreground">Asclion a identifié :</span>{" "}
                <span className="font-medium">{medicamentNom}</span>
              </div>
              {cipScanned && (
                <div>
                  <span className="text-muted-foreground">CIP scanné :</span>{" "}
                  <span className="font-mono">{cipScanned}</span>
                </div>
              )}
              {pcNom && (
                <div>
                  <span className="text-muted-foreground">PC :</span>{" "}
                  <span className="font-medium">{pcNom}</span>
                </div>
              )}
            </div>

            {isMedReport && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Quel est le vrai médicament que vous venez de scanner ?
                </label>
                <Input
                  placeholder="Ex: Cérulyse, Doliprane 1000mg…"
                  value={vraiNom}
                  onChange={(e) => setVraiNom(e.target.value.slice(0, 100))}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Si vous le connaissez. Nous corrigerons la base en moins de 24h.
                </p>
              </div>
            )}

            <Textarea
              placeholder={isMedReport ? "Commentaire (optionnel)…" : "Précisez le problème (optionnel)…"}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">
              Votre signalement sera transmis à l'équipe Asclion pour amélioration de la base.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportButton;
