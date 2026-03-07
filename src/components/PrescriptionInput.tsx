import { useState, useRef, useCallback } from "react";
import { Search, FileText, Keyboard, Camera, X, ImageIcon, FolderSearch, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { pdfToImageBase64 } from "@/lib/pdfToImage";
import { useFolderWatcher } from "@/hooks/useFolderWatcher";
import { toast } from "sonner";

interface PrescriptionInputProps {
  onAnalyze: (text: string) => void;
  onAnalyzeImage: (imageBase64: string) => void;
}

const PrescriptionInput = ({ onAnalyze, onAnalyzeImage }: PrescriptionInputProps) => {
  const [mode, setMode] = useState<"quick" | "text" | "image" | "scanner">("quick");
  const [quickInput, setQuickInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessingFile(true);
    try {
      let base64: string;
      if (file.type === "application/pdf") {
        base64 = await pdfToImageBase64(file);
      } else if (file.type.startsWith("image/")) {
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      } else {
        toast.error("Format non supporté. Utilisez une image ou un PDF.");
        return;
      }
      setImagePreview(base64);
    } catch (err) {
      console.error("File processing error:", err);
      toast.error("Erreur lors du traitement du fichier");
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  // Scanner folder watcher
  const handleScannerFile = useCallback(async (file: File) => {
    // Play notification sound
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}

    toast.info(`📄 Ordonnance détectée : ${file.name}`);

    setIsProcessingFile(true);
    try {
      let base64: string;
      if (file.type === "application/pdf") {
        base64 = await pdfToImageBase64(file);
      } else {
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      // Auto-trigger analysis
      onAnalyzeImage(base64);
    } catch (err) {
      console.error("Scanner file error:", err);
      toast.error("Erreur lors du traitement du scan");
    } finally {
      setIsProcessingFile(false);
    }
  }, [onAnalyzeImage]);

  const { isSupported: isFolderApiSupported, isWatching, folderName, startWatching, stopWatching } = useFolderWatcher({
    onNewFile: handleScannerFile,
  });

  const handleSubmit = () => {
    if (mode === "image" || mode === "scanner") {
      if (imagePreview) {
        onAnalyzeImage(imagePreview);
      }
      return;
    }
    const value = mode === "quick" ? quickInput : textInput;
    if (value.trim()) onAnalyze(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const modes = [
    { id: "quick" as const, label: "Saisie rapide", icon: Keyboard },
    { id: "text" as const, label: "Coller un texte", icon: FileText },
    { id: "image" as const, label: "Photo / PDF", icon: Camera },
    ...(isFolderApiSupported ? [{ id: "scanner" as const, label: "Scanner auto", icon: FolderSearch }] : []),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode switcher */}
      <div className="flex gap-2 flex-wrap">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Quick input */}
      {mode === "quick" && (
        <Input
          placeholder="Ex : Amoxicilline, Doliprane, Oméprazole..."
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-14 text-lg px-4 border-2 border-border focus:border-primary"
          autoFocus
        />
      )}

      {/* Text input */}
      {mode === "text" && (
        <Textarea
          placeholder="Collez le contenu de l'ordonnance ici..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] text-base px-4 py-3 border-2 border-border focus:border-primary"
          autoFocus
        />
      )}

      {/* Image / PDF mode */}
      {mode === "image" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />

          {isProcessingFile ? (
            <div className="rounded-xl border-2 border-border p-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Conversion du fichier...</p>
              <Progress value={60} className="w-48 h-2" />
            </div>
          ) : !imagePreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center py-12 px-6 gap-3 ${
                isDragging
                  ? "border-primary bg-accent scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center">
                <ImageIcon className="h-7 w-7 text-accent-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-base">Glissez une photo ou un PDF d'ordonnance</p>
                <p className="text-sm text-muted-foreground mt-1">Images (JPG, PNG) et fichiers PDF acceptés</p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border-2 border-border bg-secondary">
              <img
                src={imagePreview}
                alt="Aperçu de l'ordonnance"
                className="w-full max-h-[300px] object-contain bg-secondary"
              />
              <button
                onClick={clearImage}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="px-4 py-3 bg-accent/50 text-sm text-accent-foreground flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Image chargée — prête pour l'analyse IA
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scanner auto mode */}
      {mode === "scanner" && (
        <div className="space-y-3">
          {!isWatching ? (
            <div
              onClick={startWatching}
              className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 transition-all flex flex-col items-center justify-center py-12 px-6 gap-3"
            >
              <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center">
                <FolderSearch className="h-7 w-7 text-accent-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-base">Sélectionner le dossier du scanner</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PrescrIA surveillera ce dossier et analysera automatiquement chaque nouveau scan
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-primary/30 bg-accent/30 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <FolderSearch className="h-5 w-5 text-primary" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Surveillance active</p>
                  <p className="text-xs text-muted-foreground">Dossier : {folderName}</p>
                </div>
                <Button variant="outline" size="sm" onClick={stopWatching} className="text-xs h-8">
                  Arrêter
                </Button>
              </div>

              <div className="bg-secondary rounded-lg p-3 text-sm text-muted-foreground flex items-start gap-2">
                <Volume2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p>Scannez une ordonnance — PrescrIA la détectera automatiquement et affichera les résultats avec un signal sonore.</p>
              </div>

              {isProcessingFile && (
                <div className="mt-3 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  <p className="text-sm font-medium">Analyse en cours...</p>
                  <Progress value={70} className="flex-1 h-2" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit button — hide in scanner auto mode when watching */}
      {!(mode === "scanner" && isWatching) && (
        <Button
          onClick={handleSubmit}
          size="lg"
          className="w-full h-14 text-lg font-semibold pharmacy-gradient border-0"
          disabled={
            isProcessingFile ||
            (mode === "image"
              ? !imagePreview
              : mode === "scanner"
              ? false
              : !(mode === "quick" ? quickInput : textInput).trim())
          }
        >
          <Search className="h-5 w-5 mr-2" />
          Analyser l'ordonnance
        </Button>
      )}
    </div>
  );
};

export default PrescriptionInput;
