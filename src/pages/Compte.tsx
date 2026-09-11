import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { getStripeEnvironment } from "@/lib/stripe";

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
  const [cancelling, setCancelling] = useState<string | null>(null);

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
      const { data: rows } = await supabase
        .from("subscriptions")
        .select("id, plan, billing_cycle, status, current_period_end, environment")
        .in("office_id", officeIds)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false });
      setSubs((rows ?? []) as SubRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const cancel = async (id: string) => {
    setCancelling(id);
    const { data, error } = await supabase.functions.invoke("subscription-cancel", {
      body: { subscriptionId: id },
    });
    setCancelling(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Résiliation impossible");
      return;
    }
    toast.success("Résiliation prise en compte — effet à la fin de la période payée.");
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, status: "cancel_at_period_end" } : x)));
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
                  {s.billing_cycle === "monthly" ? "Abonnement mensuel" : "Offre annuelle — sans renouvellement automatique"}
                  {s.current_period_end && (
                    <> · jusqu'au {new Date(s.current_period_end).toLocaleDateString("fr-FR")}</>
                  )}
                </CardDescription>
              </CardHeader>
              {s.billing_cycle === "monthly" && s.status === "active" && (
                <CardContent>
                  <Button
                    variant="outline"
                    disabled={cancelling === s.id}
                    onClick={() => cancel(s.id)}
                  >
                    {cancelling === s.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Résilier (effet en fin de période payée)
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
