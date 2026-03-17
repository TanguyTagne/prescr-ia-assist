import { useState, useRef, useCallback } from "react";
import { Search, FileText, Keyboard, Camera, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { pdfToImageBase64 } from "@/lib/pdfToImage";
import { toast } from "sonner";

interface PrescriptionInputProps {
  onAnalyze: (text: string) => void;
  onAnalyzeImage: (imageBase64: string) => void;
}

const PrescriptionInput = ({ onAnalyze, onAnalyzeImage }: PrescriptionInputProps) => {
  const [mode, setMode] = useState<"quick" | "text" | "image">("quick");
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

  const handleScannerFile = useCallback(async (file: File) => {
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
      if (imagePreview) onAnalyzeImage(imagePreview);
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

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const modes = [
    { id: "quick" as const, label: "Saisie", icon: Keyboard },
    { id: "text" as const, label: "Texte", icon: FileText },
    { id: "image" as const, label: "Photo", icon: Camera },
    ...(isFolderApiSupported ? [{ id: "scanner" as const, label: "Scanner", icon: FolderSearch }] : []),
  ];

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Mode switcher — compact pills */}
      <div className="flex gap-1">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-3 w-3" />
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
          className="h-9 text-sm px-3 border border-border focus:border-primary"
          autoFocus
        />
      )}

      {/* Text input */}
      {mode === "text" && (
        <textarea
          placeholder="Collez le contenu de l'ordonnance ici..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[60px] max-h-[100px] text-sm px-3 py-2 rounded-md border border-border focus:border-primary focus:outline-none bg-background resize-none"
          autoFocus
        />
      )}

      {/* Image / PDF mode */}
      {mode === "image" && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={handleFileInput} className="hidden" />
          {isProcessingFile ? (
            <div className="rounded-lg border border-border p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Conversion...</span>
              <Progress value={60} className="flex-1 h-1.5" />
            </div>
          ) : !imagePreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-lg border border-dashed transition-all flex items-center gap-3 py-4 px-4 ${
                isDragging ? "border-primary bg-accent" : "border-border hover:border-primary/50"
              }`}
            >
              <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-xs">Glissez ou cliquez — photo ou PDF</p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img src={imagePreview} alt="Aperçu" className="w-full max-h-[120px] object-contain bg-secondary" />
              <button onClick={clearImage} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scanner auto mode */}
      {mode === "scanner" && (
        <div>
          {!isWatching ? (
            <div
              onClick={startWatching}
              className="cursor-pointer rounded-lg border border-dashed border-border hover:border-primary/50 transition-all flex items-center gap-3 py-4 px-4"
            >
              <FolderSearch className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-xs font-medium">Sélectionner le dossier du scanner</p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary/30 bg-accent/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FolderSearch className="h-4 w-4 text-primary" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                <span className="text-xs font-medium flex-1">Surveillance : {folderName}</span>
                <Button variant="outline" size="sm" onClick={stopWatching} className="text-[10px] h-6 px-2">Stop</Button>
              </div>
              {isProcessingFile && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  <Progress value={70} className="flex-1 h-1.5" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {!(mode === "scanner" && isWatching) && (
        <Button
          onClick={handleSubmit}
          size="sm"
          className="w-full h-9 text-sm font-semibold pharmacy-gradient border-0"
          disabled={
            isProcessingFile ||
            (mode === "image" ? !imagePreview : mode === "scanner" ? false : !(mode === "quick" ? quickInput : textInput).trim())
          }
        >
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Analyser l'ordonnance
        </Button>
      )}
    </div>
  );
};

export default PrescriptionInput;
