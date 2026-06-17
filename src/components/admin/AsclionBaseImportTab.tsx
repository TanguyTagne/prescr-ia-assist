import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const FILE = "asclion-medicaments-pertinence.csv";
const PAGE = 1000;

export default function AsclionBaseImportTab() {
  const [wiping, setWiping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const push = (m: string) => setLog((l) => [...l, m]);

  const wipe = async () => {
    if (!confirm(`⚠️ Cela va SUPPRIMER tous les médicaments + PCs curated. Continuer ?`)) return;
    setWiping(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-asclion-base", { body: { mode: "wipe" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      push(`✓ Wipe terminé : ${data?.deleted ?? "?"} médicaments supprimés`);
      toast.success("Base vidée");
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ Wipe : ${e.message}`);
    } finally {
      setWiping(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    setLog([]);
    push(`→ Import depuis ${FILE} (lots de ${PAGE})`);
    let offset = 0;
    let total = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase.functions.invoke(
          "import-asclion-base",
          { body: { mode: "import", offset, limit: PAGE } },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        total = data.total_in_csv;
        push(`lot offset=${offset} → ${data.meds_upserted} méds, ${data.pcs_upserted} PCs (échec: ${data.meds_failed}/${data.pcs_failed})`);
        setProgress({ done: Math.min(offset + PAGE, total), total });
        if (data.done || data.next_offset == null) {
          push(`✓ Import terminé : ${total} lignes traitées`);
          toast.success("Import terminé");
          break;
        }
        offset = data.next_offset;
      }
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Base définitive Asclion (2 PCs par médicament)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Fichier source : <code>imports/{FILE}</code>. L'import remplace la base : 1) vider, 2) importer par tranches de {PAGE} lignes. Seuls <strong>pc_1</strong> et <strong>pc_2</strong> sont conservés ; pc_3 est ignoré.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={wipe} disabled={wiping || importing} variant="destructive" className="gap-1.5">
            {wiping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            1. Vider la base
          </Button>
          <Button onClick={runImport} disabled={wiping || importing} className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            2. Importer le CSV
          </Button>
        </div>

        {progress && (
          <div className="text-sm">
            Progression : {progress.done} / {progress.total}
          </div>
        )}

        {log.length > 0 && (
          <pre className="bg-muted rounded p-3 text-xs max-h-80 overflow-auto whitespace-pre-wrap">
            {log.join("\n")}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
