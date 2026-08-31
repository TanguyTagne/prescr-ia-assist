import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PAGE = 1000;

export default function AsclionBaseImportTab() {
  const [wiping, setWiping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const push = (m: string) => setLog((l) => [...l, m]);

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

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
    let offset = 0;
    let total = 0;
    push(`→ Import médicaments + PCs + phrases + vigilance depuis le CSV maître (lots de ${PAGE})`);
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase.functions.invoke("import-asclion-base", {
        body: { mode: "import", offset, limit: PAGE },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      total = data.total_in_csv;
      if (offset === 0) push(`✓ Source maître : imports/${data.source_file}`);
      push(
        `lot offset=${offset} → ${data.meds_upserted} méds, ${data.pcs_upserted} PCs, ${data.pcs_with_phrase_conseil ?? 0} phrases, ${data.pcs_with_vigilance ?? 0} vigilances (échec: ${data.meds_failed}/${data.pcs_failed})`,
      );
      if ((data.orphan_phrase_rows ?? 0) > 0) {
        push(`⚠ ${data.orphan_phrase_rows} ligne(s) ont une phrase mais aucun nom de PC reconnu : vérifie les en-têtes du CSV`);
      }
      setProgress({ done: Math.min(offset + PAGE, total), total });
      if (data.done || data.next_offset == null) {
        push(`✓ Import base terminé : ${total} lignes traitées`);
        return;
      }
      offset = data.next_offset;
    }
  };

  const runCipMapping = async () => {
    push("→ Import mapping PC → CIP/EAN (auto-acceptation scan)");
    const { data, error } = await supabase.functions.invoke("import-pc-cip-mapping");
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    push(`✓ ${data.inserted}/${data.parsed} codes liés aux PCs (erreurs: ${data.errors})`);
  };

  /** Import global autoritaire : le CSV maître remplace médicaments, PC,
   * phrases et vigilances, puis le mapping PC → CIP est rafraîchi. */
  const runFullImport = async (file?: File) => {
    setImporting(true);
    setLog([]);
    setProgress(null);
    try {
      if (file) {
        push(`→ Envoi du CSV : ${file.name}`);
        const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
        const { data, error } = await supabase.functions.invoke("import-asclion-base", {
          body: { mode: "upload", contentBase64, filename: file.name },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        push(`✓ CSV poussé (${data.rows ?? "?"} lignes)`);
      }

      await runImport();

      try {
        await runCipMapping();
      } catch (e: any) {
        push(`• Mapping PC → CIP ignoré (${e.message})`);
      }

      push("✓ Import complet terminé");
      toast.success("Import complet terminé");
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ ${e.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const busy = wiping || importing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Base définitive Asclion (PCs + phrases conseil + vigilance)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Un seul bouton : choisis le CSV maître et tout est importé d'un coup — médicaments,{" "}
          <strong>pc_1 / pc_2</strong> (1 seul PC si une seule colonne remplie),{" "}
          <strong>pertinence_pc1/2</strong>, <strong>phrase_conseil_pc1/2</strong>,{" "}
          <strong>vigilance / phrase_vigilance / pertinence_vigilance</strong>, puis le mapping PC → CIP/EAN.
          Le CSV maître est toujours le plus récent du bucket <code>imports</code> ; l'import vide la base au démarrage
          pour garantir qu'elle reflète exactement ce fichier.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) runFullImport(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={busy} className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Tout importer depuis un CSV
          </Button>
          <Button onClick={() => runFullImport()} disabled={busy} variant="secondary" className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Réimporter le dernier CSV
          </Button>
          <Button onClick={wipe} disabled={busy} variant="destructive" className="gap-1.5">
            {wiping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Vider la base
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

