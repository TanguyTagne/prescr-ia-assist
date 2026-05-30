import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const [submitting, setSubmitting] = useState(false);

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

      const { error } = await supabase.from("signalements" as any).insert({
        pharmacy_id: profile.pharmacy_id,
        user_id: user.id,
        type,
        medicament_nom: medicamentNom,
        pc_nom: pcNom || null,
        pc_categorie: pcCategorie || null,
        commentaire: comment.trim() || null,
        context: context || {},
      });

      if (error) throw error;
      toast.success("Signalement envoyé. Merci !");
      setOpen(false);
      setComment("");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    type === "medicament_different"
      ? "Signaler un médicament différent"
      : "Signaler un PC inadapté";

  return (
    <>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-2 text-xs space-y-0.5">
              <div><span className="text-muted-foreground">Médicament :</span> <span className="font-medium">{medicamentNom}</span></div>
              {pcNom && <div><span className="text-muted-foreground">PC :</span> <span className="font-medium">{pcNom}</span></div>}
            </div>
            <Textarea
              placeholder="Précisez le problème (optionnel)…"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
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
