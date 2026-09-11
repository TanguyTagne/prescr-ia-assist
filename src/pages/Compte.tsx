import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { isPaymentsConfigured, getStripeEnvironment } from "@/lib/stripe";

const STATUS_LABELS: Record<string, string> = {
  checkout_started: "Paiement commencé",
  payment_pending: "Paiement en attente",
  paid_pending_validation: "Payé — validation en cours",
  activation_requested: "Activation demandée",
  active: "Actif",
  payment_issue: "Incident de paiement",
  cancel_at_period_end: "Résilié — fin de période",
  expired: "Expiré",
  cancelled: "Résilié",
};

const CANCELLABLE = ["active", "payment_issue", "paid_pending_validation", "activation_requested"];

interface SubRow {
  id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
  environment: string;
}

export default function Compte() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("subscription_offices")
        .select("id")
        .eq("user_id", user.id);
      const officeIds = (data ?? []).map((o) => o.id);
      if (officeIds.length === 0) {
        setSubs([]);
        setLoading(false);
        return;
      }
      let query = supabase
        .from("subscriptions")
        .select("id, plan, billing_cycle, status, current_period_end, environment")
        .in("office_id", officeIds);
      // Si les paiements ne sont pas configurés sur ce build, on affiche tout
      // plutôt que de faire planter la page.
      if (isPaymentsConfigured()) query = query.eq("environment", getStripeEnvironment());
      const { data: rows } = await query.order("created_at", { ascending: false });
      setSubs((rows ?? []) as SubRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const cancel = async (id: string) => {
    if (!window.confirm("Confirmer la résiliation ? Votre accès reste ouvert jusqu'à la fin de la période déjà payée.")) return;
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("subscription-cancel", { body: { subscriptionId: id } });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Résiliation impossible");
      return;
    }
    toast.success("Résiliation prise en compte — effet à la fin de la période payée.");
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, status: "cancel_at_period_end" } : x)));
  };

  const openPortal = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("subscription-portal", {
      body: { subscriptionId: id, returnUrl: `${window.location.origin}/compte` },
    });
    setBusy(null);
    if (error || data?.error || !data?.url) {
      toast.error(data?.error || error?.message || "Portail de facturation indisponible");
      return;
    }
    window.open(data.url as string, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground max-w-2xl mx-auto px-4 py-10">
      <Seo title="Mon abonnement — Asclion" description="Gestion de votre abonnement Asclion." path="/compte" noindex />
      <h1 className="text-2xl font-bold">Mon abonnement</h1>

      {subs.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun abonnement associé à ce compte.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mt-6">
          {subs.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {s.plan === "premium" ? "Asclion Premium" : "Asclion Classique"}
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {s.billing_cycle === "monthly" ? "Abonnement mensuel" : "Abonnement annuel"}
                  {s.current_period_end && (
                    <>
                      {" · "}
                      {s.status === "cancel_at_period_end"
                        ? `accès jusqu'au ${new Date(s.current_period_end).toLocaleDateString("fr-FR")}`
                        : `prochaine échéance le ${new Date(s.current_period_end).toLocaleDateString("fr-FR")}`}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={busy === s.id} onClick={() => openPortal(s.id)}>
                  {busy === s.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Gérer ma carte et mes factures
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
                {CANCELLABLE.includes(s.status) && (
                  <Button variant="ghost" disabled={busy === s.id} onClick={() => cancel(s.id)}>
                    Résilier (effet en fin de période payée)
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Les abonnements mensuels et annuels sont reconduits automatiquement. La résiliation prend effet à la fin de la
        période déjà payée, sans remboursement au prorata. Un rappel vous est envoyé 30 jours avant chaque reconduction annuelle.
      </p>
    </div>
  );
}
