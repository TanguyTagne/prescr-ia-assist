import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import Seo from "@/components/Seo";

export default function Merci() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const pending = searchParams.get("pending") === "sepa";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <Seo title="Merci — Asclion" description="Votre paiement a bien été reçu." path="/merci" noindex />
      <Card className="max-w-lg w-full text-center">
        <CardHeader>
          {pending ? (
            <Clock className="h-12 w-12 text-primary mx-auto" />
          ) : (
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          )}
          <CardTitle className="mt-4">
            {pending ? "Prélèvement en cours de confirmation" : "Paiement bien reçu"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <p className="text-sm text-muted-foreground">
              Votre prélèvement SEPA est en cours de confirmation par votre banque (quelques jours ouvrés).
              Votre compte Asclion sera créé automatiquement dès la confirmation finale — vous recevrez alors
              un e-mail avec votre lien de définition de mot de passe, la vidéo d'installation et le bloc de validation.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Merci pour votre confiance. Votre compte Asclion sera activé sous 24 à 48 h :
              vous recevrez un e-mail avec votre lien de définition de mot de passe,
              la vidéo d'installation et le bloc de validation.
            </p>
          )}
          {!sessionId && !pending && (
            <p className="text-xs text-muted-foreground">
              Si vous avez déjà payé, cet écran n'affecte en rien votre activation — elle est déclenchée automatiquement côté serveur.
            </p>
          )}
          <Button asChild variant="outline">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
