import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, Loader2, Trash2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const FILE = "asclion-medicaments-pertinence-enrichi.csv";
const PHRASES_FILE = "asclion-phrases-conseil.csv";
const PAGE = 1000;

export default function AsclionBaseImportTab() {
  const [wiping, setWiping] = useState(false);
  const [uploadingPhrases, setUploadingPhrases] = useState(false);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phrasesInputRef = useRef<HTMLInputElement | null>(null);

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

  const uploadPhrasesCsv = async (file: File) => {
    setUploadingPhrases(true);
    setLog([]);
    setProgress(null);
    push(`→ Envoi du fichier phrases conseil : ${file.name}`);
    try {
      const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const { data, error } = await supabase.functions.invoke("import-asclion-base", {
        body: { mode: "upload_phrases", contentBase64, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      push(`✓ Fichier phrases poussé dans imports/${PHRASES_FILE} (${data.rows ?? "?"} lignes)`);
      push(`✓ Clé médicament détectée : ${data.has_med_key ? "oui" : "non"}`);
      push(`✓ Clé PC détectée : ${data.has_pc_key ? "oui" : "non"}`);
      push(`✓ Phrases conseil détectées : ${data.has_phrase_conseil ? "oui" : "non"}`);
      toast.success("Fichier phrases conseil poussé");
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ push phrases : ${e.message}`);
    } finally {
      setUploadingPhrases(false);
      if (phrasesInputRef.current) phrasesInputRef.current.value = "";
    }
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
    push(`→ Import médicaments + PCs + phrases + vigilance depuis ${FILE} (lots de ${PAGE})`);
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase.functions.invoke("import-asclion-base", {
        body: { mode: "import", offset, limit: PAGE },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      total = data.total_in_csv;
      push(
        `lot offset=${offset} → ${data.meds_upserted} méds, ${data.pcs_upserted} PCs, ${data.pcs_with_phrase_conseil ?? 0} phrases, ${data.pcs_with_vigilance ?? 0} vigilances (échec: ${data.meds_failed}/${data.pcs_failed})`,
      );
      setProgress({ done: Math.min(offset + PAGE, total), total });
      if (data.done || data.next_offset == null) {
        push(`✓ Import base terminé : ${total} lignes traitées`);
        return;
      }
      offset = data.next_offset;
    }
  };

  const runPhrasesImport = async () => {
    // Les phrases sont beaucoup plus lentes (plusieurs requêtes DB par ligne).
    const PHRASES_PAGE = 150;
    let offset = 0;
    let total = 0;
    push(`→ Import du fichier phrases conseil séparé (lots de ${PHRASES_PAGE})`);
    for (let i = 0; i < 500; i++) {
      const { data, error } = await supabase.functions.invoke("import-asclion-base", {
        body: { mode: "import_phrases", offset, limit: PHRASES_PAGE },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      total = data.total_in_csv;
      const processed = data.processed ?? PHRASES_PAGE;
      push(`lot offset=${offset} → ${data.phrases_updated} appliquées, ${data.phrases_skipped} ignorées`);
      setProgress({ done: Math.min(offset + processed, total), total });
      if (data.done || data.next_offset == null) {
        push(`✓ Phrases conseil terminées : ${total} lignes`);
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

  /** Import global : CSV enrichi (méds + PCs + pertinences + phrases + vigilance),
   *  puis phrases séparées si présentes, puis mapping PC → CIP. */
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
        await runPhrasesImport();
      } catch (e: any) {
        push(`• Fichier phrases séparé ignoré (${e.message})`);
      }

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

  const busy = wiping || uploadingPhrases || importing;

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
          Un seul bouton : choisis le CSV enrichi et tout est importé d'un coup — médicaments,{" "}
          <strong>pc_1 / pc_2</strong> (1 seul PC si une seule colonne remplie),{" "}
          <strong>pertinence_pc1/2</strong>, <strong>phrase_conseil_pc1/2</strong>,{" "}
          <strong>vigilance / phrase_vigilance / pertinence_vigilance</strong>, puis les phrases du fichier
          séparé (si déjà poussé) et le mapping PC → CIP/EAN.
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
          <input
            ref={phrasesInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadPhrasesCsv(file);
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
          <Button onClick={() => phrasesInputRef.current?.click()} disabled={busy} variant="outline" className="gap-1.5">
            {uploadingPhrases ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Pousser fichier phrases séparé (option)
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

