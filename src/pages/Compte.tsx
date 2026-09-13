import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { isPaymentsConfigured, getStripeEnvironment } from "@/lib/stripe";

const STATUS_LABELS: Record<string, string> = {
  checkout_started: "Paiement commencé",
  payment_pending: "Paiement en attente",
  paid_pending_validation: "Payé — activation en cours",
  activation_requested: "Activation demandée",
  active: "Actif",
  payment_issue: "Incident de paiement",
  cancel_at_period_end: "Résilié — fin de période",
  expired: "Expiré",
  cancelled: "Résilié",
};

const CANCELLABLE = ["active", "payment_issue", "paid_pending_validation", "activation_requested"];
const CHANGEABLE = ["active", "paid_pending_validation", "activation_requested", "cancel_at_period_end"];
const ENDED = ["expired", "cancelled"];
const PENDING_ACTIVATION = ["paid_pending_validation", "activation_requested"];

const OFFERS: { priceId: string; label: string; plan: string; cycle: string }[] = [
  { priceId: "asclion_classic_monthly", label: "Classique mensuel — 99 € HT/mois", plan: "classic", cycle: "monthly" },
  { priceId: "asclion_premium_monthly", label: "Premium mensuel — 149 € HT/mois", plan: "premium", cycle: "monthly" },
  { priceId: "asclion_classic_yearly", label: "Classique annuel — 990 € HT/an", plan: "classic", cycle: "annual" },
  { priceId: "asclion_premium_yearly", label: "Premium annuel — 1 490 € HT/an", plan: "premium", cycle: "annual" },
];

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
  const [target, setTarget] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const changePlan = async (sub: SubRow) => {
    const priceId = target[sub.id];
    if (!priceId) return;
    const offer = OFFERS.find((o) => o.priceId === priceId)!;
    if (!window.confirm(
      `Passer à « ${offer.label} » ? Le changement est immédiat et la différence est ajustée au prorata sur votre prochaine facture.`,
    )) return;
    setBusy(sub.id);
    const { data, error } = await supabase.functions.invoke("subscription-change-plan", {
      body: { subscriptionId: sub.id, priceId },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Changement de formule impossible");
      return;
    }
    toast.success("Formule mise à jour.");
    setTarget((t) => ({ ...t, [sub.id]: "" }));
    void load();
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
          <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-4">
            <p>Aucun abonnement associé à ce compte.</p>
            <Button asChild><Link to="/souscrire">Souscrire à Asclion</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mt-6">
          {subs.map((s) => {
            const options = OFFERS.filter((o) => !(o.plan === s.plan && o.cycle === s.billing_cycle));
            return (
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
                <CardContent className="space-y-4">
                  {PENDING_ACTIVATION.includes(s.status) && (
                    <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                      <Clock className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>
                        Paiement bien reçu. Votre officine est en cours d'activation par notre équipe (24 à 48 h ouvrées).
                        Vous recevrez un e-mail dès que l'outil sera ouvert.
                      </span>
                    </div>
                  )}

                  {s.status === "payment_issue" && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      Un paiement n'est pas passé. Mettez votre moyen de paiement à jour ci-dessous : votre accès reste
                      ouvert pendant les relances automatiques.
                    </div>
                  )}

                  {ENDED.includes(s.status) && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      Cet abonnement est terminé. Vos données sont conservées : vous pouvez reprendre là où vous en
                      étiez en souscrivant à nouveau.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" disabled={busy === s.id} onClick={() => openPortal(s.id)}>
                      {busy === s.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Gérer ma carte et mes factures
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                    {ENDED.includes(s.status) && (
                      <Button asChild><Link to="/souscrire">Souscrire à nouveau</Link></Button>
                    )}
                    {CANCELLABLE.includes(s.status) && s.billing_cycle === "monthly" && (
                      <Button variant="ghost" disabled={busy === s.id} onClick={() => cancel(s.id)}>
                        Résilier (effet en fin de période payée)
                      </Button>
                    )}
                  </div>

                  {s.billing_cycle === "annual" && !ENDED.includes(s.status) && (
                    <p className="text-sm text-muted-foreground">
                      Offre annuelle : paiement unique pour 12 mois, sans reconduction automatique. Aucun nouveau débit
                      n'aura lieu et votre accès reste ouvert jusqu'à la fin de la période payée.
                    </p>
                  )}

                  {CHANGEABLE.includes(s.status) && s.billing_cycle === "monthly" && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium">Changer de formule</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Effet immédiat. La différence est calculée au prorata et ajustée sur votre prochaine facture.
                      </p>
                      <div className="flex flex-wrap gap-3 mt-3">
                        <Select
                          value={target[s.id] ?? ""}
                          onValueChange={(v) => setTarget((t) => ({ ...t, [s.id]: v }))}
                        >
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Choisir une nouvelle formule" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((o) => (
                              <SelectItem key={o.priceId} value={o.priceId}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="secondary"
                          disabled={!target[s.id] || busy === s.id}
                          onClick={() => changePlan(s)}
                        >
                          {busy === s.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Confirmer le changement
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        L'abonnement mensuel est reconduit automatiquement ; la résiliation prend effet à la fin de la période déjà
        payée, sans remboursement au prorata. L'offre annuelle est un paiement unique pour 12 mois, sans reconduction
        automatique : un rappel vous est envoyé 30 jours avant l'échéance.
      </p>
    </div>
  );
}
