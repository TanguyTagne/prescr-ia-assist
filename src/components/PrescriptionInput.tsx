import { useState, useRef, useCallback, useEffect } from "react";
import { Search, FileText, Keyboard, Camera, X, ImageIcon, Loader2, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { pdfToImageBase64 } from "@/lib/pdfToImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MedSuggestion {
  nom: string;
  laboratoire?: string | null;
  source: "stock" | "base";
}

interface PrescriptionInputProps {
  onAnalyze: (text: string) => void;
  onAnalyzeImage: (imageBase64: string) => void;
  autoAnalyze?: boolean;
}

const PrescriptionInput = ({ onAnalyze, onAnalyzeImage, autoAnalyze = true }: PrescriptionInputProps) => {
  const [mode, setMode] = useState<"quick" | "text" | "image">("quick");
  const [quickInput, setQuickInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [suggestions, setSuggestions] = useState<MedSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const latestSearchRef = useRef(0);

  const getLastToken = (value: string) => {
    const parts = value.split(/[,;\n]/);
    return parts[parts.length - 1].trimStart();
  };

  const replaceLastToken = (value: string, replacement: string) => {
    const idx = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"), value.lastIndexOf("\n"));
    const prefix = idx === -1 ? "" : value.slice(0, idx + 1) + " ";
    return prefix + replacement;
  };

  useEffect(() => {
    if (mode !== "quick") return;
    const token = getLastToken(quickInput);
    if (!showSuggestions || token.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const searchId = Date.now();
    latestSearchRef.current = searchId;
    setSearching(true);

    const timeout = window.setTimeout(async () => {
      const startsWith = `${token}%`;

      let pharmacyId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("pharmacy_id")
            .eq("id", user.id)
            .maybeSingle();
          pharmacyId = profile?.pharmacy_id || null;
        }
      } catch { /* ignore */ }

      const queries: Promise<any>[] = [
        supabase
          .from("medicaments")
          .select("nom_commercial, laboratoire")
          .ilike("nom_commercial", startsWith)
          .order("nom_commercial")
          .limit(15),
      ];

      if (pharmacyId) {
        queries.push(
          (supabase as any)
            .from("pharmacy_lgo_stock")
            .select("nom_produit, laboratoire")
            .eq("pharmacy_id", pharmacyId)
            .ilike("nom_produit", startsWith)
            .gt("stock", 0)
            .limit(15)
        );
      }

      const results = await Promise.all(queries);
      if (latestSearchRef.current !== searchId) return;

      const seen = new Set<string>();
      const items: MedSuggestion[] = [];

      if (results[1]?.data) {
        results[1].data.forEach((row: any) => {
          const key = (row.nom_produit || "").toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          items.push({ nom: row.nom_produit, laboratoire: row.laboratoire, source: "stock" });
        });
      }

      (results[0]?.data || []).forEach((row: any) => {
        const key = (row.nom_commercial || "").toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push({ nom: row.nom_commercial, laboratoire: row.laboratoire, source: "base" });
      });

      setSuggestions(items.slice(0, 12));
      setHighlightIdx(0);
      setSearching(false);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [quickInput, mode, showSuggestions]);

  const applySuggestion = (sug: MedSuggestion) => {
    const next = replaceLastToken(quickInput, sug.nom);
    setQuickInput(next + ", ");
    setSuggestions([]);
    setShowSuggestions(false);
    setTimeout(() => quickInputRef.current?.focus(), 0);
  };

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
      if (autoAnalyze) {
        onAnalyzeImage(base64);
      }
    } catch (err) {
      console.error("File processing error:", err);
      toast.error("Erreur lors du traitement du fichier");
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const handleSubmit = () => {
    if (mode === "image") {
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

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        size="sm"
        className="w-full h-9 text-sm font-semibold pharmacy-gradient border-0"
        disabled={
          isProcessingFile ||
          (mode === "image" ? !imagePreview : !(mode === "quick" ? quickInput : textInput).trim())
        }
      >
        <Search className="h-3.5 w-3.5 mr-1.5" />
        Analyser l'ordonnance
      </Button>
    </div>
  );
};

export default PrescriptionInput;
