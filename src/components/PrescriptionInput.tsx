import { useState, useRef, useCallback } from "react";
import { Search, FileText, Keyboard, Camera, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (mode === "image") {
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

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const modes = [
    { id: "quick" as const, label: "Saisie rapide", icon: Keyboard },
    { id: "text" as const, label: "Coller un texte", icon: FileText },
    { id: "image" as const, label: "Photo ordonnance", icon: Camera },
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

      {/* Input */}
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

      {mode === "image" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />

          {!imagePreview ? (
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
                <p className="font-semibold text-base">Glissez une photo d'ordonnance ici</p>
                <p className="text-sm text-muted-foreground mt-1">ou cliquez pour sélectionner un fichier</p>
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

      <Button
        onClick={handleSubmit}
        size="lg"
        className="w-full h-14 text-lg font-semibold pharmacy-gradient border-0"
        disabled={
          mode === "image"
            ? !imagePreview
            : !(mode === "quick" ? quickInput : textInput).trim()
        }
      >
        <Search className="h-5 w-5 mr-2" />
        Analyser l'ordonnance
      </Button>
    </div>
  );
};

export default PrescriptionInput;
