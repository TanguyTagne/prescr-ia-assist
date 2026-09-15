import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import SiteHeader from "@/components/SiteHeader";
import { Bot, CheckCircle2 } from "lucide-react";

type PriceId = "asclion_classic_monthly" | "asclion_premium_monthly" | "asclion_classic_yearly" | "asclion_premium_yearly";

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
    priceId: "asclion_classic_yearly",
    name: "Classique annuel",
    cycle: "annual",
    priceLabel: "990 € HT/an payé d'avance",
    setupLabel: "Mise en place offerte",
    totalLabel: "990 € HT dus aujourd'hui — 12 mois, sans renouvellement automatique",
    savingLabel: "297 € HT économisés la première année vs mensuel + mise en place ; 198 € HT les années suivantes",
    recommended: true,
    features: [
      "Catalogue de 30 000+ médicaments avec PC recommandé",
      "Suggestions, sécurité et amélioration continue",
      "Formation visio et suivis à J+14 et J+30 inclus",
      "Rappel un mois avant l'échéance ; renouvellement uniquement sur votre confirmation",
    ],
  },
  {
    priceId: "asclion_premium_yearly",
    name: "Premium annuel",
    cycle: "annual",
    priceLabel: "1 490 € HT/an payé d'avance",
    setupLabel: "Mise en place offerte",
    totalLabel: "1 490 € HT dus aujourd'hui — 12 mois, sans renouvellement automatique",
    savingLabel: "397 € HT économisés la première année vs mensuel + mise en place ; 298 € HT les années suivantes",
    features: [
      "Tout Classique, plus l'audit initial du stock",
      "Suggestions sur mesure selon votre stock",
      "Actualisation hebdomadaire du stock",
      "Rappel un mois avant l'échéance ; renouvellement uniquement sur votre confirmation",
    ],
  },
  {
    priceId: "asclion_classic_monthly",
    name: "Classique mensuel",
    cycle: "monthly",
    priceLabel: "99 € HT/mois",
    setupLabel: "+ 99 € HT de mise en place (une fois)",
    totalLabel: "198 € HT dus aujourd'hui, puis 99 € HT/mois",
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
    totalLabel: "248 € HT dus aujourd'hui, puis 149 € HT/mois",
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
  const planParam = searchParams.get("plan") || "";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<PlanDef | null>(() => {
    const map: Record<string, PriceId> = {
      classic_monthly: "asclion_classic_monthly",
      premium_monthly: "asclion_premium_monthly",
      classic_yearly: "asclion_classic_yearly",
      premium_yearly: "asclion_premium_yearly",
    };
    const pid = map[planParam];
    return pid ? PLANS.find((p) => p.priceId === pid) ?? null : null;
  });
  const [form, setForm] = useState<OfficeForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);

  const configured = isPaymentsConfigured();
  // Stripe.js est chargé dès l'arrivée sur la page (pas au moment du paiement).
  const stripePromise = useMemo(() => (configured ? getStripe() : null), [configured]);

  // Préconnexion aux domaines Stripe pour supprimer la latence DNS/TLS.
  useEffect(() => {
    if (!configured) return;
    const links: HTMLLinkElement[] = [];
    for (const href of ["https://js.stripe.com", "https://api.stripe.com", "https://m.stripe.network"]) {
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = href;
      l.crossOrigin = "anonymous";
      document.head.appendChild(l);
      links.push(l);
    }
    return () => links.forEach((l) => l.remove());
  }, [configured]);

  // Session de paiement démarrée avant l'affichage de l'étape 3 : quand le
  // formulaire Stripe se monte, la réponse est déjà là (ou presque).
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);

  const set = (patch: Partial<OfficeForm>) => setForm((f) => ({ ...f, ...patch }));

  const formValid =
    form.officeName.trim().length > 1 &&
    /^\d{9}(\d{5})?$/.test(form.siret.replace(/\s/g, "")) &&
    form.billingAddress.trim().length > 4 &&
    form.contactFirstName.trim().length > 0 &&
    form.contactLastName.trim().length > 0 &&
    /.+@.+\..+/.test(form.contactEmail) &&
    form.acceptedTerms &&
    form.acceptedRecurring &&
    (!form.robotDeclared || (form.robotBrand.trim().length > 0 && form.robotModel.trim().length > 0));

  const submitCompatibilityReview = async () => {
    if (!plan) return;
    setChecking(true);
    setFormError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
        body: {
          priceId: plan.priceId,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/merci`,
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
            robotDeclared: true,
            robotBrand: form.robotBrand.trim(),
            robotModel: form.robotModel.trim(),
            source,
            utmCampaign,
            acceptedTerms: form.acceptedTerms,
            acceptedRecurring: form.acceptedRecurring,
          },
        },
      });
      if (error || !data?.compatibilityReview) {
        throw new Error((data as any)?.error || error?.message || "Envoi impossible");
      }
      setReviewSent(true);
    } catch (e: any) {
      setFormError(e?.message || "Envoi impossible, réessayez.");
    } finally {
      setChecking(false);
    }
  };

  const requestClientSecret = async (): Promise<string> => {
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
      throw new Error((data as any)?.error || error?.message || "Impossible d'ouvrir le paiement");
    }
    return data.clientSecret as string;
  };

  // Lance (une seule fois) la création de session ; réutilisée par Stripe au montage.
  const startCheckoutSession = () => {
    if (!sessionPromiseRef.current) {
      setCheckoutError(null);
      sessionPromiseRef.current = requestClientSecret()
        .then((secret) => {
          // Petit délai : le temps que l'iframe Stripe s'affiche réellement.
          setTimeout(() => setCheckoutReady(true), 600);
          return secret;
        })
        .catch((e) => {
          sessionPromiseRef.current = null;
          setCheckoutError(e?.message || "Impossible d'ouvrir le paiement");
          throw e;
        });
    }
    return sessionPromiseRef.current;
  };

  // Référence stable : évite tout remontage du formulaire Stripe.
  const fetchClientSecret = useCallback(() => startCheckoutSession(), []);
  const checkoutOptions = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Souscrire à Asclion — offres et tarifs" path="/souscrire" noindex
        description="Choisissez votre offre Asclion : Classique ou Premium, mensuel ou annuel. Paiement sécurisé, activation sous 24 à 48 h."
      />
      <PaymentTestModeBanner />
      <SiteHeader variant="checkout" />

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
              Paiement par carte ; prélèvement SEPA disponible sur les offres mensuelles (activation après
              confirmation finale de votre banque) ; virement sur facture sur demande. Mensuel : renouvelé chaque
              mois jusqu'à résiliation, effet en fin de période payée, sans remboursement au prorata. Annuel :
              paiement unique pour 12 mois, sans renouvellement automatique — un e-mail de rappel un mois avant
              l'échéance.
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
                  <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
                    <Bot className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Votre robot nécessite une vérification de compatibilité avant souscription.
                      Envoyez la demande ; nous vous répondrons avant de vous proposer le paiement.
                    </span>
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
                  J'accepte les <a href="/cgv" target="_blank" className="underline">conditions générales de vente</a> et la{" "}
                  <a href="/confidentialite" target="_blank" className="underline">politique de confidentialité</a>. *
                </Label>
              </div>
              <div className="sm:col-span-2 flex items-start gap-2">
                <Checkbox
                  id="acceptedRecurring"
                  checked={form.acceptedRecurring}
                  onCheckedChange={(v) => set({ acceptedRecurring: v === true })}
                />
                <Label htmlFor="acceptedRecurring" className="font-normal text-sm">
                  {plan.cycle === "monthly" ? (
                    <>
                      J'accepte le prélèvement récurrent de {plan.priceLabel}, reconduit chaque mois jusqu'à
                      résiliation, avec effet à la fin de la période en cours et sans remboursement au prorata. *
                    </>
                  ) : (
                    <>
                      J'accepte le paiement unique de {plan.priceLabel} pour une durée de 12 mois,{" "}
                      <strong>sans renouvellement automatique</strong>. Un e-mail de rappel me sera envoyé un mois
                      avant l'échéance ; le renouvellement n'interviendra que sur ma confirmation. *
                    </>
                  )}
                </Label>
              </div>
            </div>

            {formError && <p className="text-sm text-destructive mt-4">{formError}</p>}

            {duplicate && (
              <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Une souscription est déjà en cours pour cette officine (même SIRET ou même e-mail). Si vous souscrivez
                pour une seconde officine, continuez. Sinon, retrouvez votre abonnement existant sur{" "}
                <a href="/compte" className="underline font-medium">votre espace client</a> pour éviter un double
                prélèvement.
              </div>
            )}

            {reviewSent ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                <p className="font-semibold">Demande de compatibilité envoyée</p>
                <p className="text-sm text-muted-foreground">
                  Nous étudions la compatibilité de votre robot {form.robotBrand} {form.robotModel} et
                  revenons vers vous avant toute souscription. Aucun paiement n'a été débité.
                </p>
              </div>
            ) : (
              <div className="flex justify-end mt-6">
                {form.robotDeclared ? (
                  <Button
                    size="lg"
                    disabled={!formValid || checking}
                    onClick={submitCompatibilityReview}
                  >
                    {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Envoyer la demande de compatibilité
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={!formValid || !configured || checking}
                    onClick={async () => {
                      if (!configured) {
                        setFormError("Le paiement n'est pas encore configuré sur cet environnement.");
                        return;
                      }
                      // Premier clic : on avertit d'un doublon éventuel sans bloquer.
                      if (!duplicate) {
                        setChecking(true);
                        const { data } = await supabase.functions.invoke("subscription-precheck", {
                          body: { siret: form.siret.replace(/\s/g, ""), email: form.contactEmail.trim() },
                        });
                        setChecking(false);
                        if (data?.existing) {
                          setDuplicate(true);
                          return;
                        }
                      }
                      // Session créée en parallèle de l'affichage : le
                      // formulaire de paiement s'ouvre sans attente visible.
                      startCheckoutSession().catch(() => {});
                      setStep(3);
                    }}
                  >
                    {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {duplicate ? "Continuer quand même" : "Passer au paiement"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && plan && (
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Les informations peuvent changer : on repart sur une session neuve.
                sessionPromiseRef.current = null;
                setCheckoutError(null);
                setStep(2);
              }}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux informations
            </Button>
            <h1 className="text-2xl font-bold">Paiement sécurisé</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {plan.name} — {plan.totalLabel}. Vos données de carte ne transitent jamais par nos serveurs.
            </p>
            {checkoutError ? (
              <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{checkoutError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    sessionPromiseRef.current = null;
                    setCheckoutError(null);
                    startCheckoutSession().catch(() => {});
                  }}
                >
                  Réessayer
                </Button>
              </div>
            ) : (
              <div id="checkout" className="mt-6 relative min-h-[420px]">
                <div className="absolute inset-0 flex items-start justify-center pt-16 text-muted-foreground pointer-events-none">
                  <span className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement du paiement sécurisé…
                  </span>
                </div>
                {stripePromise && (
                  <div className="relative">
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
