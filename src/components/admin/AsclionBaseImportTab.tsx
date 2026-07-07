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
  const [uploading, setUploading] = useState(false);
  const [uploadingPhrases, setUploadingPhrases] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingPhrases, setImportingPhrases] = useState(false);
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

  const uploadCsv = async (file: File) => {
    setUploading(true);
    setLog([]);
    setProgress(null);
    push(`→ Envoi du CSV enrichi : ${file.name}`);
    try {
      const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const { data, error } = await supabase.functions.invoke("import-asclion-base", {
        body: { mode: "upload", contentBase64, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      push(`✓ CSV poussé dans imports/${FILE} (${data.rows ?? "?"} lignes)`);
      push(`✓ Pertinence détectée : ${data.has_pertinence ? "oui" : "non"}`);
      push(`✓ Phrases conseil détectées : ${data.has_phrase_conseil ? "oui" : "non"}`);
      toast.success("CSV enrichi poussé");
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ push CSV : ${e.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        push(`lot offset=${offset} → ${data.meds_upserted} méds, ${data.pcs_upserted} PCs, ${data.pcs_with_pertinence ?? 0} pertinences, ${data.pcs_with_phrase_conseil ?? 0} phrases (échec: ${data.meds_failed}/${data.pcs_failed})`);
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

  const runPhrasesImport = async () => {
    setImportingPhrases(true);
    setLog([]);
    // Les phrases sont beaucoup plus lentes (plusieurs requêtes DB par ligne),
    // on prend des lots plus petits pour ne pas dépasser le timeout de 150s.
    const PHRASES_PAGE = 150;
    push(`→ Import des phrases conseil depuis ${PHRASES_FILE} (lots de ${PHRASES_PAGE})`);
    let offset = 0;
    let total = 0;
    try {
      for (let i = 0; i < 500; i++) {
        const { data, error } = await supabase.functions.invoke(
          "import-asclion-base",
          { body: { mode: "import_phrases", offset, limit: PHRASES_PAGE } },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        total = data.total_in_csv;
        const processed = data.processed ?? PHRASES_PAGE;
        push(`lot offset=${offset} → ${data.phrases_updated} lignes appliquées, ${data.phrases_skipped} ignorées (${processed} traitées)`);
        setProgress({ done: Math.min(offset + processed, total), total });
        if (data.done || data.next_offset == null) {
          push(`✓ Import phrases terminé : ${total} lignes traitées`);
          toast.success("Phrases conseil importées");
          break;
        }
        offset = data.next_offset;
      }
    } catch (e: any) {
      toast.error(e.message);
      push(`✗ phrases conseil : ${e.message}`);
    } finally {
      setImportingPhrases(false);
    }
  };

  const busy = wiping || uploading || uploadingPhrases || importing || importingPhrases;

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
          Fichier source : <code>imports/{FILE}</code>. Pousse d'abord le CSV enrichi, puis vide et importe la base par tranches de {PAGE} lignes. Les colonnes <strong>pertinence_pc1/2</strong> et <strong>phrase_conseil_pc1/2</strong> sont importées avec les PCs.
        </p>
        <p className="text-sm text-muted-foreground">
          Si les phrases sont dans un fichier séparé, pousse-le aussi ici : colonnes acceptées <strong>medicament/nom_commercial/id</strong> + <strong>pc/pc_1/pc_2</strong> + <strong>phrase_conseil</strong> ou <strong>phrase_conseil_pc1/2</strong>. Il met à jour les phrases des PCs déjà importés.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadCsv(file);
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
          <Button onClick={() => fileInputRef.current?.click()} disabled={busy} variant="secondary" className="gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            0. Pousser CSV enrichi
          </Button>
          <Button onClick={() => phrasesInputRef.current?.click()} disabled={busy} variant="secondary" className="gap-1.5">
            {uploadingPhrases ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            0bis. Pousser phrases conseil
          </Button>
          <Button onClick={wipe} disabled={busy} variant="destructive" className="gap-1.5">
            {wiping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            1. Vider la base
          </Button>
          <Button onClick={runImport} disabled={busy} className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            2. Importer le CSV
          </Button>
          <Button onClick={runPhrasesImport} disabled={busy} variant="secondary" className="gap-1.5">
            {importingPhrases ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            2bis. Importer phrases conseil
          </Button>
          <Button
            onClick={async () => {
              setImporting(true);
              push("→ Import mapping PC → CIP/EAN (auto-acceptation scan)");
              try {
                const { data, error } = await supabase.functions.invoke("import-pc-cip-mapping");
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                push(`✓ ${data.inserted}/${data.parsed} codes liés aux PCs (erreurs: ${data.errors})`);
                toast.success(`${data.inserted} codes PC importés`);
              } catch (e: any) {
                toast.error(e.message);
                push(`✗ mapping PC : ${e.message}`);
              } finally {
                setImporting(false);
              }
            }}
            disabled={busy}
            variant="secondary"
            className="gap-1.5"
          >
            3. Importer mapping PC → CIP/EAN
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
