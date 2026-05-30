import { useMemo, useState, useEffect } from "react";
import { ScanLine, FileText, ExternalLink, AlertCircle, CheckCircle2, Image as ImageIcon, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { code128ToSvg } from "@/lib/code128";
import {
  SCANNER_MODELS,
  STATUS_LABEL,
  type ScannerModel,
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

const ScannerModelCard = ({ model, onOpen }: { model: ScannerModel; onOpen: () => void }) => {
  const status = STATUS_LABEL[model.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full glass-card rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all space-y-2 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {model.brand}
          </p>
          <h3 className="font-semibold text-sm leading-tight">{model.model}</h3>
        </div>
        {model.marketShare && (
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
            {model.marketShare}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{model.shortDesc}</p>
      <div className="flex items-center justify-between pt-1">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-full ${status.tone}`}>
          {model.status === "verified" && <CheckCircle2 className="h-3 w-3" />}
          {model.status === "beta" && <AlertCircle className="h-3 w-3" />}
          {model.status === "manual" && <ImageIcon className="h-3 w-3" />}
          {status.label}
        </span>
        <ScanLine className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
};

const ScannerStepsDialog = ({
  model,
  open,
  onOpenChange,
}: {
  model: ScannerModel | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  if (!model) return null;
  const status = STATUS_LABEL[model.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{model.brand}</p>
              <DialogTitle className="text-lg">{model.model}</DialogTitle>
            </div>
            <Badge variant="outline" className={status.tone}>
              {status.label}
            </Badge>
          </div>
          <DialogDescription className="text-xs leading-relaxed pt-1">{model.shortDesc}</DialogDescription>
        </DialogHeader>

        {model.status !== "verified" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {model.status === "manual"
                ? "Les codes-barres officiels sont propriétaires : à capturer une fois depuis le PDF constructeur, puis à déposer dans /public/scanner-codes/" + model.slug + "/."
                : "Séquence dérivée du langage PAP Honeywell. À valider sur le premier poste pharmacien avant déploiement large."}
            </p>
          </div>
        )}

        <div className="space-y-6 pt-2">
          {model.steps.map((step) => (
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
                <StepBarcode step={step} slug={model.slug} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={model.manualUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5" />
              Manuel constructeur
              {model.manualPage ? ` (p. ${model.manualPage})` : ""}
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
  const [selected, setSelected] = useState<ScannerModel | null>(null);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const byBrand: Record<string, ScannerModel[]> = {};
    for (const m of SCANNER_MODELS) {
      (byBrand[m.brand] ??= []).push(m);
    }
    return byBrand;
  }, []);

  const verifiedCount = SCANNER_MODELS.filter((m) => m.status === "verified").length;
  const totalCount = SCANNER_MODELS.length;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground leading-relaxed bg-secondary/50 rounded-lg p-3 space-y-1">
        <p>
          Choisis le modèle de douchette → la séquence de codes-barres apparaît à l'écran.
          Tu pointes la douchette sur chaque code dans l'ordre. Le scanner mémorisera le mode
          "dual output" (clavier vers le LGO + COM virtuel vers Asclion).
        </p>
        <p className="font-medium">
          État du parc : {verifiedCount}/{totalCount} modèles vérifiés en officine. Les autres
          sont prêts à tester lors de tes installations.
        </p>
      </div>

      {Object.entries(grouped).map(([brand, models]) => (
        <div key={brand} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80 px-1">{brand}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {models.map((m) => (
              <ScannerModelCard
                key={m.slug}
                model={m}
                onOpen={() => {
                  setSelected(m);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <ScannerStepsDialog model={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default ScannerConfigGuide;
