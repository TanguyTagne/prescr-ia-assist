import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  checkout_started: "Paiement commencé",
  payment_pending: "Paiement en attente",
  paid_pending_validation: "Payé — à valider",
  activation_requested: "Activation demandée",
  active: "Actif",
  payment_issue: "Incident paiement",
  cancel_at_period_end: "Résil. fin de période",
  expired: "Expiré",
  cancelled: "Résilié",
};

interface OfficeRow {
  id: string;
  office_name: string;
  billing_name: string | null;
  siret: string;
  billing_address: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  registers_count: number | null;
  robot_declared: boolean;
  robot_brand: string | null;
  robot_model: string | null;
  source: string | null;
  utm_campaign: string | null;
  pharmacy_id: string | null;
  user_id: string | null;
  created_at: string;
}

interface SubRow {
  id: string;
  office_id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  amount_total_cents: number;
  payment_method: string | null;
  current_period_end: string | null;
  annual_renewal_due_at: string | null;
  annual_reminder_sent_at: string | null;
  environment: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const eur = (cents: number) => `${(cents / 100).toLocaleString("fr-FR")} €`;

export default function SubscriptionsTab() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [offices, setOffices] = useState<Record<string, OfficeRow>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [note, setNote] = useState("");
  const [followUps, setFollowUps] = useState({ j14: "", j30: "" });
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: subRows }, { data: officeRows }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("subscription_offices").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setSubs((subRows ?? []) as SubRow[]);
    const map: Record<string, OfficeRow> = {};
    for (const o of (officeRows ?? []) as OfficeRow[]) map[o.id] = o;
    setOffices(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (sub: SubRow) => {
    setSelected(sub);
    const office = offices[sub.office_id];
    if (office) {
      setFollowUps({
        j14: (office as unknown as { followup_j14_at?: string | null }).followup_j14_at ?? "",
        j30: (office as unknown as { followup_j30_at?: string | null }).followup_j30_at ?? "",
      });
    }
    const { data } = await supabase
      .from("subscription_events")
      .select("id, event_type, payload, created_at")
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as EventRow[]);
  };

  const action = async (body: Record<string, unknown>, okMsg: string) => {
    setActing(true);
    const { data, error } = await supabase.functions.invoke("subscription-admin-actions", { body });
    setActing(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Action impossible");
      return;
    }
    toast.success(okMsg);
    await load();
    if (selected) {
      const updated = (await supabase.from("subscriptions").select("*").eq("id", selected.id).single()).data;
      if (updated) setSelected(updated as SubRow);
    }
  };

  const office = selected ? offices[selected.office_id] : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Souscriptions</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune souscription pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Officine</th>
                  <th className="py-2 pr-3">Offre</th>
                  <th className="py-2 pr-3">Montant</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Échéance</th>
                  <th className="py-2 pr-3">Env</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const o = offices[s.office_id];
                  return (
                    <tr key={s.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(s)}>
                      <td className="py-2 pr-3 font-medium">{o?.office_name ?? "—"}</td>
                      <td className="py-2 pr-3">{s.plan} / {s.billing_cycle}</td>
                      <td className="py-2 pr-3">{eur(s.amount_total_cents)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={s.status === "active" ? "default" : s.status.includes("issue") || s.status === "cancelled" ? "destructive" : "secondary"}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{o?.source ?? "—"}{o?.utm_campaign ? ` (${o.utm_campaign})` : ""}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {(s.current_period_end ?? s.annual_renewal_due_at)
                          ? new Date((s.current_period_end ?? s.annual_renewal_due_at) as string).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{s.environment === "sandbox" ? "test" : "live"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && office && (
            <>
              <DialogHeader>
                <DialogTitle>{office.office_name} — {selected.plan} / {selected.billing_cycle}</DialogTitle>
              </DialogHeader>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <p><span className="text-muted-foreground">Raison sociale :</span> {office.billing_name ?? "—"}</p>
                <p><span className="text-muted-foreground">SIRET :</span> {office.siret}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Adresse :</span> {office.billing_address ?? "—"}</p>
                <p><span className="text-muted-foreground">Contact :</span> {office.contact_first_name} {office.contact_last_name}</p>
                <p><span className="text-muted-foreground">E-mail :</span> {office.contact_email}</p>
                <p><span className="text-muted-foreground">Téléphone :</span> {office.contact_phone ?? "—"}</p>
                <p><span className="text-muted-foreground">Caisses :</span> {office.registers_count ?? "—"}</p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Robot :</span>{" "}
                  {office.robot_declared ? `Oui — ${office.robot_brand ?? "?"} ${office.robot_model ?? ""} (compatibilité à étudier)` : "Non"}
                </p>
                <p><span className="text-muted-foreground">Paiement :</span> {selected.payment_method ?? "—"} · {eur(selected.amount_total_cents)}</p>
                <p><span className="text-muted-foreground">Créée le :</span> {new Date(selected.created_at).toLocaleString("fr-FR")}</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {selected.status === "paid_pending_validation" && (
                  <Button size="sm" disabled={acting} onClick={() => action({ action: "activate", subscriptionId: selected.id }, "Souscription activée, e-mail envoyé")}>
                    Activer
                  </Button>
                )}
                {selected.status === "active" && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "suspend", subscriptionId: selected.id }, "Souscription suspendue")}>
                    Suspendre
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "mark_transfer_paid", subscriptionId: selected.id }, "Virement marqué payé")}>
                  Marquer virement payé
                </Button>
                {selected.billing_cycle === "annual" && !selected.annual_reminder_sent_at && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "send_annual_reminder", subscriptionId: selected.id }, "Rappel annuel envoyé")}>
                    Envoyer rappel annuel
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-xs text-muted-foreground">Suivi J+14</label>
                  <Input type="date" value={followUps.j14} onChange={(e) => setFollowUps((f) => ({ ...f, j14: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Suivi J+30</label>
                  <Input type="date" value={followUps.j30} onChange={(e) => setFollowUps((f) => ({ ...f, j30: e.target.value }))} />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="col-span-2"
                  disabled={acting}
                  onClick={() => action({ action: "update_office", subscriptionId: selected.id, followupJ14: followUps.j14 || null, followupJ30: followUps.j30 || null }, "Suivis enregistrés")}
                >
                  Enregistrer les suivis
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <Textarea placeholder="Note interne…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={acting || note.trim().length === 0}
                  onClick={async () => {
                    await action({ action: "add_note", subscriptionId: selected.id, note: note.trim() }, "Note ajoutée");
                    setNote("");
                  }}
                >
                  Ajouter la note
                </Button>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Historique des paiements et événements</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {events.length === 0 && <p className="text-xs text-muted-foreground">Aucun événement.</p>}
                  {events.map((e) => (
                    <div key={e.id} className="text-xs flex justify-between gap-2 border-b pb-1">
                      <span className="font-mono">{e.event_type}</span>
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
