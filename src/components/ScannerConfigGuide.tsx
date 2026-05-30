import { useMemo, useState, useEffect } from "react";
import { ScanLine, FileText, ExternalLink, AlertCircle, CheckCircle2, Image as ImageIcon, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { code128ToSvg } from "@/lib/code128";
import {
  SCANNER_FAMILIES,
  STATUS_LABEL,
  type ScannerFamily,
  type ScannerStep,
} from "@/lib/scannerConfigCodes";

/** Renders one scannable barcode — either a generated Code 128 or a captured PNG. */
const StepBarcode = ({ step, slug }: { step: ScannerStep; slug: string }) => {
  // useMemo MUST be called unconditionally (React hooks rule).
  const svg = useMemo(
    () =>
      step.format === "code128" && step.payload
        ? code128ToSvg(step.payload, { moduleWidth: 3, height: 110, textSize: 16 })
        : null,
    [step.format, step.payload],
  );

  if (svg) {
    return (
      <div
        className="inline-block bg-white p-4 rounded-lg border text-black"
        // SVG is fully sanitized (we built it ourselves) — safe to inject.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  if (step.format === "image" && step.imageFile) {
    return <StepImage slug={slug} step={step} />;
  }

  return null;
};

/** Loads a PNG from /public/scanner-codes/{slug}/. Falls back to a clear placeholder. */
const StepImage = ({ slug, step }: { slug: string; step: ScannerStep }) => {
  const [missing, setMissing] = useState(false);
  // Reset whenever slug/file changes (modal switched to another model)
  useEffect(() => setMissing(false), [slug, step.imageFile]);

  const src = `/scanner-codes/${slug}/${step.imageFile}`;
  if (missing) {
    return (
      <div className="text-amber-800 bg-amber-50 border border-amber-200 px-3 py-4 rounded flex gap-2 items-start text-xs max-w-md">
        <ImageIcon className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Image à capturer depuis le manuel constructeur</p>
          <p className="font-mono text-[10px] break-all opacity-80">
            → déposer : public/scanner-codes/{slug}/{step.imageFile}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="inline-block bg-white p-4 rounded-lg border">
      <img
        src={src}
        alt={`Code-barres : ${step.title}`}
        className="max-h-32 max-w-full"
        onError={() => setMissing(true)}
      />
    </div>
  );
};

const ScannerFamilyCard = ({ family, onOpen }: { family: ScannerFamily; onOpen: () => void }) => {
  const status = STATUS_LABEL[family.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full glass-card rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all space-y-2 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {family.brand}
          </p>
          <h3 className="font-semibold text-sm leading-tight">{family.familyName}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {family.models.length} modèles compatibles
          </p>
        </div>
        {family.marketShare && (
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
            {family.marketShare}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{family.shortDesc}</p>
      <div className="flex items-center justify-between pt-1">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-full ${status.tone}`}>
          {family.status === "verified" && <CheckCircle2 className="h-3 w-3" />}
          {family.status === "beta" && <AlertCircle className="h-3 w-3" />}
          {family.status === "manual" && <ImageIcon className="h-3 w-3" />}
          {status.label}
        </span>
        <ScanLine className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
};

const ScannerStepsDialog = ({
  family,
  open,
  onOpenChange,
}: {
  family: ScannerFamily | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  if (!family) return null;
  const status = STATUS_LABEL[family.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{family.brand}</p>
              <DialogTitle className="text-lg">{family.familyName}</DialogTitle>
            </div>
            <Badge variant="outline" className={status.tone}>
              {status.label}
            </Badge>
          </div>
          <DialogDescription className="text-xs leading-relaxed pt-1">{family.shortDesc}</DialogDescription>
        </DialogHeader>

        <div className="text-xs bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="font-medium">Modèles couverts par cette séquence :</p>
          <ul className="text-muted-foreground space-y-0.5 ml-3 list-disc">
            {family.models.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>

        {family.status !== "verified" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {family.status === "manual"
                ? "Les codes-barres officiels sont propriétaires : à capturer une fois depuis le PDF constructeur, puis à déposer dans /public/scanner-codes/" + family.slug + "/. Une seule capture sert pour toute la famille."
                : "Séquence dérivée du langage PAP Honeywell. À valider sur le premier poste pharmacien avant déploiement large."}
            </p>
          </div>
        )}

        <div className="space-y-6 pt-2">
          {family.steps.map((step) => (
            <div key={step.order} className="space-y-3 pb-6 border-b last:border-0">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {step.order}
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">{step.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
              <div className="pl-10">
                <StepBarcode step={step} slug={family.slug} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={family.manualUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5" />
              Manuel constructeur
              {family.manualPage ? ` (p. ${family.manualPage})` : ""}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>
          <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
            <Printer className="h-3.5 w-3.5" />
            Imprimer cette fiche
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const ScannerConfigGuide = () => {
  const [selected, setSelected] = useState<ScannerFamily | null>(null);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const byBrand: Record<string, ScannerFamily[]> = {};
    for (const f of SCANNER_FAMILIES) {
      (byBrand[f.brand] ??= []).push(f);
    }
    return byBrand;
  }, []);

  const verifiedCount = SCANNER_FAMILIES.filter((f) => f.status === "verified").length;
  const totalCount = SCANNER_FAMILIES.length;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground leading-relaxed bg-secondary/50 rounded-lg p-3 space-y-1">
        <p>
          Sélectionne la famille de douchette → la séquence de configuration apparaît à l'écran.
          Une seule séquence couvre toute la famille (Honeywell General Purpose, Datalogic Gryphon,
          etc.). Pointe la douchette sur chaque code dans l'ordre.
        </p>
        <p>
          Le guide sert à <strong>réinitialiser proprement</strong> la douchette et à <strong>garantir
          le clavier français AZERTY</strong>. Asclion capture ensuite chaque scan en parallèle du
          LGO via 6 chemins passifs simultanés — aucun mode spécial n'est requis sur le scanner.
        </p>
        <p className="font-medium">
          État du parc : {verifiedCount}/{totalCount} familles vérifiées en officine.
        </p>
      </div>

      {Object.entries(grouped).map(([brand, families]) => (
        <div key={brand} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 px-1">{brand}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {families.map((f) => (
              <ScannerFamilyCard
                key={f.slug}
                family={f}
                onOpen={() => {
                  setSelected(f);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <ScannerStepsDialog family={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default ScannerConfigGuide;
