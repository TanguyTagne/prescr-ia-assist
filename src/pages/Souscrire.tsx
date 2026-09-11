import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, ArrowLeft } from "lucide-react";
import Seo from "@/components/Seo";

type PriceId = "asclion_classic_monthly" | "asclion_premium_monthly" | "asclion_classic_annual" | "asclion_premium_annual";

interface PlanDef {
  priceId: PriceId;
  name: string;
  cycle: "monthly" | "annual";
  priceLabel: string;
  setupLabel: string;
  totalLabel: string;
  savingLabel?: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: PlanDef[] = [
  {
    priceId: "asclion_classic_annual",
    name: "Classique annuel",
    cycle: "annual",
    priceLabel: "990 € HT/an",
    setupLabel: "Mise en place offerte",
    totalLabel: "990 € HT la première année",
    savingLabel: "12 mois au prix de 10 — 297 € HT d'économie vs mensuel",
    recommended: true,
    features: [
      "Catalogue de 30 000+ médicaments avec PC recommandé",
      "Suggestions, sécurité et amélioration continue",
      "Formation visio et suivis à J+14 et J+30 offerts",
      "Aucun renouvellement automatique",
    ],
  },
  {
    priceId: "asclion_premium_annual",
    name: "Premium annuel",
    cycle: "annual",
    priceLabel: "1 490 € HT/an",
    setupLabel: "Mise en place offerte",
    totalLabel: "1 490 € HT la première année",
    savingLabel: "397 € HT d'économie vs mensuel — stock actualisé chaque semaine",
    features: [
      "Tout Classique, plus l'audit initial du stock",
      "Suggestions sur mesure selon votre stock",
      "Actualisation hebdomadaire du stock",
      "Aucun renouvellement automatique",
    ],
  },
  {
    priceId: "asclion_classic_monthly",
    name: "Classique mensuel",
    cycle: "monthly",
    priceLabel: "99 € HT/mois",
    setupLabel: "+ 99 € HT de mise en place (une fois)",
    totalLabel: "198 € HT le premier mois",
    features: [
      "Catalogue de 30 000+ médicaments avec PC recommandé",
      "Suggestions, sécurité et amélioration continue",
      "Toute l'officine, caisses non limitées",
      "Résiliable à tout moment (fin de période)",
    ],
  },
  {
    priceId: "asclion_premium_monthly",
    name: "Premium mensuel",
    cycle: "monthly",
    priceLabel: "149 € HT/mois",
    setupLabel: "+ 99 € HT de mise en place (une fois)",
    totalLabel: "248 € HT le premier mois",
    features: [
      "Tout Classique, plus l'audit initial du stock",
      "Suggestions sur mesure selon votre stock",
      "Actualisation mensuelle du stock",
      "Résiliable à tout moment (fin de période)",
    ],
  },
];

interface OfficeForm {
  officeName: string;
  billingName: string;
  siret: string;
  billingAddress: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  registersCount: string;
  robotDeclared: boolean;
  robotBrand: string;
  robotModel: string;
  acceptedTerms: boolean;
  acceptedRecurring: boolean;
}

const EMPTY_FORM: OfficeForm = {
  officeName: "", billingName: "", siret: "", billingAddress: "",
  contactFirstName: "", contactLastName: "", contactEmail: "", contactPhone: "",
  registersCount: "", robotDeclared: false, robotBrand: "", robotModel: "",
  acceptedTerms: false, acceptedRecurring: false,
};

export default function Souscrire() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source") || "";
  const utmCampaign = searchParams.get("utm_campaign") || "";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<PlanDef | null>(null);
  const [form, setForm] = useState<OfficeForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const configured = isPaymentsConfigured();
  const stripePromise = useMemo(() => (configured ? getStripe() : null), [configured]);

  const set = (patch: Partial<OfficeForm>) => setForm((f) => ({ ...f, ...patch }));

  const formValid =
    form.officeName.trim().length > 1 &&
    /^\d{9}(\d{5})?$/.test(form.siret.replace(/\s/g, "")) &&
    form.billingAddress.trim().length > 4 &&
    form.contactFirstName.trim().length > 0 &&
    form.contactLastName.trim().length > 0 &&
    /.+@.+\..+/.test(form.contactEmail) &&
    form.acceptedTerms &&
    (plan?.cycle !== "monthly" || form.acceptedRecurring) &&
    (!form.robotDeclared || (form.robotBrand.trim().length > 0 && form.robotModel.trim().length > 0));

  const fetchClientSecret = async (): Promise<string> => {
    if (!plan) throw new Error("Aucune offre sélectionnée");
    const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
      body: {
        priceId: plan.priceId,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/merci?session_id={CHECKOUT_SESSION_ID}`,
        office: {
          officeName: form.officeName.trim(),
          billingName: form.billingName.trim(),
          siret: form.siret.replace(/\s/g, ""),
          billingAddress: form.billingAddress.trim(),
          contactFirstName: form.contactFirstName.trim(),
          contactLastName: form.contactLastName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          registersCount: form.registersCount ? parseInt(form.registersCount, 10) : null,
          robotDeclared: form.robotDeclared,
          robotBrand: form.robotBrand.trim(),
          robotModel: form.robotModel.trim(),
          source,
          utmCampaign,
          acceptedTerms: form.acceptedTerms,
          acceptedRecurring: form.acceptedRecurring,
        },
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Impossible d'ouvrir le paiement");
    }
    return data.clientSecret as string;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Souscrire à Asclion — offres et tarifs" path="/souscrire" noindex
        description="Choisissez votre offre Asclion : Classique ou Premium, mensuel ou annuel. Paiement sécurisé, activation sous 24 à 48 h."
      />
      <PaymentTestModeBanner />

      <div className="max-w-5xl mx-auto px-4 py-10">
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold text-center">Choisissez votre offre</h1>
            <p className="text-center text-muted-foreground mt-2">
              Tous les prix sont HT, TVA en sus selon la réglementation en vigueur. Toute l'officine, caisses non limitées.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-8">
              {PLANS.map((p) => (
                <Card
                  key={p.priceId}
                  className={`cursor-pointer transition-shadow hover:shadow-lg relative ${plan?.priceId === p.priceId ? "ring-2 ring-primary" : ""} ${p.recommended ? "border-primary" : ""}`}
                  onClick={() => setPlan(p)}
                >
                  {p.recommended && (
                    <Badge className="absolute -top-3 left-4">Recommandé</Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {p.name}
                      {plan?.priceId === p.priceId && <Check className="h-5 w-5 text-primary" />}
                    </CardTitle>
                    <CardDescription>{p.priceLabel} · {p.setupLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">{p.totalLabel}</p>
                    {p.savingLabel && <p className="text-xs text-primary mt-1">{p.savingLabel}</p>}
                    <ul className="mt-3 space-y-1.5">
                      {p.features.map((f) => (
                        <li key={f} className="text-sm text-muted-foreground flex gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" /> {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6 max-w-2xl mx-auto">
              Paiement par carte sur toutes les offres ; prélèvement SEPA disponible sur les offres mensuelles
              (le compte est activé après confirmation finale du prélèvement). Virement sur facture possible sur demande.
              Offres annuelles : aucun renouvellement automatique, aucune résiliation anticipée remboursable.
            </p>

            <div className="flex justify-center mt-6">
              <Button size="lg" disabled={!plan} onClick={() => setStep(2)}>
                Continuer
              </Button>
            </div>
          </>
        )}

        {step === 2 && plan && (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux offres
            </Button>
            <h1 className="text-2xl font-bold">Informations de l'officine</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Offre sélectionnée : <strong>{plan.name}</strong> — {plan.priceLabel}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div className="sm:col-span-2">
                <Label htmlFor="officeName">Nom de l'officine *</Label>
                <Input id="officeName" value={form.officeName} onChange={(e) => set({ officeName: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="billingName">Raison sociale / facturation</Label>
                <Input id="billingName" value={form.billingName} onChange={(e) => set({ billingName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="siret">SIRET *</Label>
                <Input id="siret" value={form.siret} onChange={(e) => set({ siret: e.target.value })} placeholder="14 chiffres" />
              </div>
              <div>
                <Label htmlFor="registersCount">Nombre indicatif de caisses</Label>
                <Input id="registersCount" type="number" min={1} max={50} value={form.registersCount} onChange={(e) => set({ registersCount: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="billingAddress">Adresse de facturation *</Label>
                <Input id="billingAddress" value={form.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactFirstName">Prénom du titulaire / contact admin *</Label>
                <Input id="contactFirstName" value={form.contactFirstName} onChange={(e) => set({ contactFirstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactLastName">Nom *</Label>
                <Input id="contactLastName" value={form.contactLastName} onChange={(e) => set({ contactLastName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactEmail">E-mail professionnel *</Label>
                <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactPhone">Téléphone</Label>
                <Input id="contactPhone" value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
              </div>

              <div className="sm:col-span-2 flex items-start gap-2">
                <Checkbox
                  id="robotDeclared"
                  checked={form.robotDeclared}
                  onCheckedChange={(v) => set({ robotDeclared: v === true })}
                />
                <Label htmlFor="robotDeclared" className="font-normal">
                  Mon officine utilise un robot de délivrance (compatibilité étudiée au cas par cas avant activation)
                </Label>
              </div>
              {form.robotDeclared && (
                <>
                  <div>
                    <Label htmlFor="robotBrand">Marque du robot *</Label>
                    <Input id="robotBrand" value={form.robotBrand} onChange={(e) => set({ robotBrand: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="robotModel">Modèle *</Label>
                    <Input id="robotModel" value={form.robotModel} onChange={(e) => set({ robotModel: e.target.value })} />
                  </div>
                </>
              )}

              <div className="sm:col-span-2 flex items-start gap-2">
                <Checkbox
                  id="acceptedTerms"
                  checked={form.acceptedTerms}
                  onCheckedChange={(v) => set({ acceptedTerms: v === true })}
                />
                <Label htmlFor="acceptedTerms" className="font-normal text-sm">
                  J'accepte les <a href="/cgu" target="_blank" className="underline">conditions générales de vente</a> et la{" "}
                  <a href="/confidentialite" target="_blank" className="underline">politique de confidentialité</a>. *
                </Label>
              </div>
              {plan.cycle === "monthly" && (
                <div className="sm:col-span-2 flex items-start gap-2">
                  <Checkbox
                    id="acceptedRecurring"
                    checked={form.acceptedRecurring}
                    onCheckedChange={(v) => set({ acceptedRecurring: v === true })}
                  />
                  <Label htmlFor="acceptedRecurring" className="font-normal text-sm">
                    J'accepte le prélèvement récurrent mensuel de {plan.priceLabel.replace(" HT/mois", "")} € HT, résiliable à tout moment avec effet à la fin de la période en cours. *
                  </Label>
                </div>
              )}
            </div>

            {formError && <p className="text-sm text-destructive mt-4">{formError}</p>}

            <div className="flex justify-end mt-6">
              <Button
                size="lg"
                disabled={!formValid || !configured}
                onClick={() => {
                  if (!configured) {
                    setFormError("Le paiement n'est pas encore configuré sur cet environnement.");
                    return;
                  }
                  setStep(3);
                }}
              >
                Passer au paiement
              </Button>
            </div>
          </div>
        )}

        {step === 3 && plan && (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux informations
            </Button>
            <h1 className="text-2xl font-bold">Paiement sécurisé</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {plan.name} — {plan.totalLabel}. Vos données de carte ne transitent jamais par nos serveurs.
            </p>
            <div id="checkout" className="mt-6">
              {stripePromise ? (
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement du paiement…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
