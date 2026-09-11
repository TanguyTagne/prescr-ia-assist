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
  siret: string | null;
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
  validation_completed_at: string | null;
  training_at: string | null;
  followup_d14_at: string | null;
  followup_d30_at: string | null;
  created_at: string;
}

interface SubRow {
  id: string;
  office_id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  paid_at: string | null;
  activated_at: string | null;
  environment: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  processed_at: string;
}

const PLAN_PRICE: Record<string, string> = {
  "classic/monthly": "99 € HT/mois + 99 € HT de mise en place",
  "premium/monthly": "149 € HT/mois + 99 € HT de mise en place",
  "classic/annual": "990 € HT/an — mise en place offerte",
  "premium/annual": "1 490 € HT/an — mise en place offerte",
};

const d10 = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY_OFFICE = {
  office_name: "",
  billing_name: "",
  siret: "",
  billing_address: "",
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  contact_phone: "",
  registers_count: "",
  validation_completed_at: "",
  training_at: "",
  followup_d14_at: "",
  followup_d30_at: "",
};

const EMPTY_SUB = {
  plan: "classic",
  billing_cycle: "monthly",
  status: "active",
  current_period_start: "",
  current_period_end: "",
  paid_at: "",
  activated_at: "",
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    <select
      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  </div>
);

export default function SubscriptionsTab() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [offices, setOffices] = useState<Record<string, OfficeRow>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [note, setNote] = useState("");
  const [officeEdit, setOfficeEdit] = useState({ ...EMPTY_OFFICE });
  const [subEdit, setSubEdit] = useState({ ...EMPTY_SUB });
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: subRows }, { data: officeRows }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("subscription_offices").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setSubs((subRows ?? []) as unknown as SubRow[]);
    const map: Record<string, OfficeRow> = {};
    for (const o of (officeRows ?? []) as unknown as OfficeRow[]) map[o.id] = o;
    setOffices(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (sub: SubRow) => {
    setSelected(sub);
    const office = offices[sub.office_id];
    if (office) {
      setOfficeEdit({
        office_name: office.office_name ?? "",
        billing_name: office.billing_name ?? "",
        siret: office.siret ?? "",
        billing_address: office.billing_address ?? "",
        contact_first_name: office.contact_first_name ?? "",
        contact_last_name: office.contact_last_name ?? "",
        contact_email: office.contact_email ?? "",
        contact_phone: office.contact_phone ?? "",
        registers_count: office.registers_count != null ? String(office.registers_count) : "",
        validation_completed_at: d10(office.validation_completed_at),
        training_at: d10(office.training_at),
        followup_d14_at: d10(office.followup_d14_at),
        followup_d30_at: d10(office.followup_d30_at),
      });
    }
    setSubEdit({
      plan: sub.plan,
      billing_cycle: sub.billing_cycle,
      status: sub.status,
      current_period_start: d10(sub.current_period_start),
      current_period_end: d10(sub.current_period_end),
      paid_at: d10(sub.paid_at),
      activated_at: d10(sub.activated_at),
    });
    const { data } = await supabase
      .from("subscription_events")
      .select("id, event_type, payload, processed_at")
      .eq("subscription_id", sub.id)
      .order("processed_at", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as unknown as EventRow[]);
  };

  const action = async (body: Record<string, unknown>, okMsg: string) => {
    setActing(true);
    const { data, error } = await supabase.functions.invoke("subscription-admin-actions", { body });
    setActing(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Action impossible");
      return;
    }
    if (data?.emailSent === false && data?.tempPassword) {
      // L'e-mail n'a pas pu partir : on affiche les identifiants à transmettre manuellement.
      window.prompt(
        `Compte créé mais e-mail non envoyé (${data.warning ?? ""}). Copiez ces identifiants :`,
        `${data.loginEmail} / ${data.tempPassword}`,
      );
      toast.warning("Compte créé — identifiants à transmettre manuellement");
    } else {
      toast.success(okMsg);
    }
    await load();
    if (selected) {
      const updated = (await supabase.from("subscriptions").select("*").eq("id", selected.id).single()).data;
      if (updated) setSelected(updated as unknown as SubRow);
    }
  };

  const office = selected ? offices[selected.office_id] : null;
  const annualDue = (s: SubRow) => {
    if (s.billing_cycle !== "annual" || !s.paid_at) return null;
    const d = new Date(s.paid_at);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  };

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
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Échéance</th>
                  <th className="py-2 pr-3">Env</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const o = offices[s.office_id];
                  const due = s.current_period_end ?? annualDue(s)?.toISOString() ?? null;
                  return (
                    <tr key={s.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(s)}>
                      <td className="py-2 pr-3 font-medium">{o?.office_name ?? "—"}</td>
                      <td className="py-2 pr-3">{s.plan} / {s.billing_cycle}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={s.status === "active" ? "default" : s.status.includes("issue") || s.status === "cancelled" ? "destructive" : "secondary"}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{o?.source ?? "—"}{o?.utm_campaign ? ` (${o.utm_campaign})` : ""}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {due ? new Date(due).toLocaleDateString("fr-FR") : "—"}
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
                <p><span className="text-muted-foreground">Tarif :</span> {PLAN_PRICE[`${selected.plan}/${selected.billing_cycle}`] ?? "—"}</p>
                <p><span className="text-muted-foreground">Raison sociale :</span> {office.billing_name ?? "—"}</p>
                <p><span className="text-muted-foreground">SIRET :</span> {office.siret ?? "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Adresse :</span> {office.billing_address ?? "—"}</p>
                <p><span className="text-muted-foreground">Contact :</span> {office.contact_first_name} {office.contact_last_name}</p>
                <p><span className="text-muted-foreground">E-mail :</span> {office.contact_email}</p>
                <p><span className="text-muted-foreground">Téléphone :</span> {office.contact_phone ?? "—"}</p>
                <p><span className="text-muted-foreground">Caisses :</span> {office.registers_count ?? "—"}</p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Robot :</span>{" "}
                  {office.robot_declared ? `Oui — ${office.robot_brand ?? "?"} ${office.robot_model ?? ""} (compatibilité à étudier)` : "Non"}
                </p>
                <p><span className="text-muted-foreground">Payée le :</span> {selected.paid_at ? new Date(selected.paid_at).toLocaleString("fr-FR") : "—"}</p>
                <p><span className="text-muted-foreground">Créée le :</span> {new Date(selected.created_at).toLocaleString("fr-FR")}</p>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Stripe : {selected.stripe_customer_id ?? "—"} · {selected.stripe_subscription_id ?? selected.stripe_checkout_session_id ?? "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={acting}
                  onClick={() =>
                    action(
                      { action: "create_credentials", subscriptionId: selected.id },
                      "Identifiants créés et envoyés par e-mail",
                    )
                  }
                >
                  Créer / renvoyer les identifiants
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={acting}
                  onClick={() => {
                    if (!confirm("Désactiver ce compte ? L'accès est coupé, les données sont conservées.")) return;
                    action({ action: "disable_account", subscriptionId: selected.id }, "Compte désactivé");
                  }}
                >
                  Désactiver le compte
                </Button>
                {(selected.status === "paid_pending_validation" || selected.status === "activation_requested") && (
                  <Button size="sm" disabled={acting} onClick={() => action({ action: "activate", subscriptionId: selected.id }, "Souscription activée, e-mail envoyé")}>
                    Activer
                  </Button>
                )}
                {selected.status === "active" && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "suspend", subscriptionId: selected.id }, "Souscription suspendue")}>
                    Suspendre
                  </Button>
                )}
                {["checkout_started", "payment_pending", "payment_issue"].includes(selected.status) && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "mark_transfer_paid", subscriptionId: selected.id }, "Virement marqué payé — compte créé")}>
                    Marquer virement payé
                  </Button>
                )}
                {selected.billing_cycle === "annual" && selected.status === "active" && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => action({ action: "send_reminder", subscriptionId: selected.id }, "Rappel annuel envoyé")}>
                    Envoyer rappel annuel
                  </Button>
                )}
              </div>

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Modifier la fiche</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Officine" value={officeEdit.office_name} onChange={(v) => setOfficeEdit((f) => ({ ...f, office_name: v }))} />
                  <Field label="Raison sociale" value={officeEdit.billing_name} onChange={(v) => setOfficeEdit((f) => ({ ...f, billing_name: v }))} />
                  <Field label="SIRET" value={officeEdit.siret} onChange={(v) => setOfficeEdit((f) => ({ ...f, siret: v }))} />
                  <Field label="Téléphone" value={officeEdit.contact_phone} onChange={(v) => setOfficeEdit((f) => ({ ...f, contact_phone: v }))} />
                  <Field label="Prénom contact" value={officeEdit.contact_first_name} onChange={(v) => setOfficeEdit((f) => ({ ...f, contact_first_name: v }))} />
                  <Field label="Nom contact" value={officeEdit.contact_last_name} onChange={(v) => setOfficeEdit((f) => ({ ...f, contact_last_name: v }))} />
                  <Field label="E-mail (identifiant)" value={officeEdit.contact_email} onChange={(v) => setOfficeEdit((f) => ({ ...f, contact_email: v }))} />
                  <Field label="Caisses" value={officeEdit.registers_count} onChange={(v) => setOfficeEdit((f) => ({ ...f, registers_count: v }))} />
                  <div className="sm:col-span-2">
                    <Field label="Adresse de facturation" value={officeEdit.billing_address} onChange={(v) => setOfficeEdit((f) => ({ ...f, billing_address: v }))} />
                  </div>
                  <Field label="Validation le" type="date" value={officeEdit.validation_completed_at} onChange={(v) => setOfficeEdit((f) => ({ ...f, validation_completed_at: v }))} />
                  <Field label="Formation le" type="date" value={officeEdit.training_at} onChange={(v) => setOfficeEdit((f) => ({ ...f, training_at: v }))} />
                  <Field label="Suivi J+14" type="date" value={officeEdit.followup_d14_at} onChange={(v) => setOfficeEdit((f) => ({ ...f, followup_d14_at: v }))} />
                  <Field label="Suivi J+30" type="date" value={officeEdit.followup_d30_at} onChange={(v) => setOfficeEdit((f) => ({ ...f, followup_d30_at: v }))} />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full mt-3"
                  disabled={acting}
                  onClick={() =>
                    action(
                      {
                        action: "save_office",
                        subscriptionId: selected.id,
                        office: {
                          office_name: officeEdit.office_name.trim(),
                          billing_name: officeEdit.billing_name.trim() || null,
                          siret: officeEdit.siret.trim() || null,
                          billing_address: officeEdit.billing_address.trim() || null,
                          contact_first_name: officeEdit.contact_first_name.trim() || null,
                          contact_last_name: officeEdit.contact_last_name.trim() || null,
                          contact_email: officeEdit.contact_email.trim(),
                          contact_phone: officeEdit.contact_phone.trim() || null,
                          registers_count: officeEdit.registers_count ? Number(officeEdit.registers_count) : null,
                          validation_completed_at: toIso(officeEdit.validation_completed_at),
                          training_at: toIso(officeEdit.training_at),
                          followup_d14_at: toIso(officeEdit.followup_d14_at),
                          followup_d30_at: toIso(officeEdit.followup_d30_at),
                        },
                      },
                      "Fiche enregistrée",
                    )
                  }
                >
                  Enregistrer la fiche
                </Button>
              </div>

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Modifier la souscription</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Formule"
                    value={subEdit.plan}
                    options={[["classic", "Classique"], ["premium", "Premium"]]}
                    onChange={(v) => setSubEdit((f) => ({ ...f, plan: v }))}
                  />
                  <SelectField
                    label="Cycle"
                    value={subEdit.billing_cycle}
                    options={[["monthly", "Mensuel"], ["annual", "Annuel"]]}
                    onChange={(v) => setSubEdit((f) => ({ ...f, billing_cycle: v }))}
                  />
                  <SelectField
                    label="Statut"
                    value={subEdit.status}
                    options={Object.entries(STATUS_LABELS)}
                    onChange={(v) => setSubEdit((f) => ({ ...f, status: v }))}
                  />
                  <Field label="Début de période" type="date" value={subEdit.current_period_start} onChange={(v) => setSubEdit((f) => ({ ...f, current_period_start: v }))} />
                  <Field label="Fin de période" type="date" value={subEdit.current_period_end} onChange={(v) => setSubEdit((f) => ({ ...f, current_period_end: v }))} />
                  <Field label="Payée le" type="date" value={subEdit.paid_at} onChange={(v) => setSubEdit((f) => ({ ...f, paid_at: v }))} />
                  <Field label="Activée le" type="date" value={subEdit.activated_at} onChange={(v) => setSubEdit((f) => ({ ...f, activated_at: v }))} />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full mt-3"
                  disabled={acting}
                  onClick={() =>
                    action(
                      {
                        action: "save_subscription",
                        subscriptionId: selected.id,
                        subscription: {
                          plan: subEdit.plan,
                          billing_cycle: subEdit.billing_cycle,
                          status: subEdit.status,
                          current_period_start: toIso(subEdit.current_period_start),
                          current_period_end: toIso(subEdit.current_period_end),
                          paid_at: toIso(subEdit.paid_at),
                          activated_at: toIso(subEdit.activated_at),
                        },
                      },
                      "Souscription enregistrée",
                    )
                  }
                >
                  Enregistrer la souscription
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
                      <span className="text-muted-foreground">{new Date(e.processed_at).toLocaleString("fr-FR")}</span>
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
