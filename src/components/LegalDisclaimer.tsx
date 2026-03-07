import { Info } from "lucide-react";

const LegalDisclaimer = () => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted/50">
    <Info className="h-3.5 w-3.5 shrink-0" />
    <span>Les suggestions sont fournies à titre informatif. La décision finale appartient au pharmacien.</span>
  </div>
);

export default LegalDisclaimer;
