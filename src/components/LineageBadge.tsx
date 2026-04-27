import { ShieldCheck, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LineageInfo } from "@/hooks/useProductLineage";

interface LineageBadgeProps {
  productName: string;
  info: LineageInfo | undefined;
}

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
};

/**
 * Petit badge cliquable affiché sous chaque produit complémentaire.
 * Donne au pharmacien la source officielle du conseil et la traçabilité.
 *
 * Affiche toujours un badge — même sans `info`, on indique la base clinique
 * Asclion validée pour ne jamais laisser un produit sans rattachement visible.
 */
const LineageBadge = ({ productName, info }: LineageBadgeProps) => {
  const hasSource = !!info?.source_code;
  const sourceLabel = info?.source_code || "Base clinique Asclion";
  const validatedDate = formatDate(info?.validated_at ?? null);
  const synchroDate = formatDate(info?.source_derniere_synchro ?? null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Voir la source du conseil pour ${productName}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          Source : {sourceLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 text-xs space-y-2 p-3"
      >
        <div className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Traçabilité du conseil</p>
            <p className="text-muted-foreground leading-snug">
              Produit : <span className="text-foreground">{productName}</span>
            </p>
          </div>
        </div>

        <div className="space-y-1 border-t pt-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Source</span>
            <span className="font-medium text-right">
              {info?.source_nom || sourceLabel}
            </span>
          </div>
          {info?.source_licence && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Licence</span>
              <span className="font-medium text-right">{info.source_licence}</span>
            </div>
          )}
          {synchroDate && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Données à jour au</span>
              <span className="font-medium">{synchroDate}</span>
            </div>
          )}
          {info?.source_reference && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Référence</span>
              <span className="font-medium text-right">{info.source_reference}</span>
            </div>
          )}
          {validatedDate && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Règle validée le</span>
              <span className="font-medium">{validatedDate}</span>
            </div>
          )}
          {info?.rule_version != null && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Version règle</span>
              <span className="font-medium">v{info.rule_version}</span>
            </div>
          )}
        </div>

        {!hasSource && (
          <p className="text-[10px] text-muted-foreground italic border-t pt-2 leading-snug">
            Source officielle non encore renseignée pour cette règle. Conseil
            issu de la base clinique Asclion validée par pharmacien référent.
          </p>
        )}

        <p className="text-[10px] text-muted-foreground italic border-t pt-2 leading-snug">
          Outil d'aide à la dispensation — la décision finale appartient au
          pharmacien.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default LineageBadge;
