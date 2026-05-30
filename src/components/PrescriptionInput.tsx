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

  const currentValue = mode === "quick" ? quickInput : textInput;

  useEffect(() => {
    if (mode !== "quick" && mode !== "text") return;
    const token = getLastToken(currentValue);
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

      const queries: any[] = [
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
  }, [quickInput, textInput, mode, showSuggestions]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applySuggestion = (sug: MedSuggestion) => {
    const next = replaceLastToken(currentValue, sug.nom) + ", ";
    if (mode === "quick") {
      setQuickInput(next);
      setTimeout(() => quickInputRef.current?.focus(), 0);
    } else {
      setTextInput(next);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const processFile = useCallback(async (file: File) => {
    setIsProcessingFile(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name);

      let base64: string;
      if (isPdf) {
        base64 = await pdfToImageBase64(file);
      } else if (isImage) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const r = e.target?.result;
            if (typeof r === "string") resolve(r);
            else reject(new Error("Lecture du fichier vide"));
          };
          reader.onerror = () => reject(reader.error || new Error("Erreur de lecture"));
          reader.readAsDataURL(file);
        });
      } else {
        toast.error(`Format non supporté${file.type ? ` (${file.type})` : ""}. Utilisez une image (JPG/PNG) ou un PDF.`);
        return;
      }
      setImagePreview(base64);
      if (autoAnalyze) {
        onAnalyzeImage(base64);
      }
    } catch (err) {
      console.error("File processing error:", err, { name: file.name, type: file.type, size: file.size });
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors du traitement du fichier : ${msg}`);
    } finally {
      setIsProcessingFile(false);
    }
  }, [autoAnalyze, onAnalyzeImage]);

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

      {/* Quick input with autocomplete */}
      {mode === "quick" && (
        <div className="relative">
          <Input
            ref={quickInputRef}
            placeholder="Ex : Doli... (suggestions stock + base)"
            value={quickInput}
            onChange={(e) => {
              setQuickInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (showSuggestions && suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault();
                  applySuggestion(suggestions[highlightIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setShowSuggestions(false);
                  return;
                }
              }
              handleKeyDown(e);
            }}
            className="h-9 text-sm px-3 border border-border focus:border-primary"
            autoFocus
            autoComplete="off"
          />
          {showSuggestions && (suggestions.length > 0 || searching) && (
            <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[260px] overflow-y-auto">
              {searching && suggestions.length === 0 && (
                <div className="py-2 px-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Recherche…
                </div>
              )}
              {suggestions.map((sug, idx) => (
                <button
                  key={`${sug.source}-${sug.nom}-${idx}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(sug)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent ${
                    idx === highlightIdx ? "bg-accent" : ""
                  }`}
                >
                  <Pill className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate font-medium">{sug.nom}</span>
                  {sug.laboratoire && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{sug.laboratoire}</span>
                  )}
                  <Badge
                    variant={sug.source === "stock" ? "default" : "secondary"}
                    className="text-[9px] px-1.5 py-0 h-4"
                  >
                    {sug.source === "stock" ? "Stock" : "Base"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Text input with multi-med autocomplete */}
      {mode === "text" && (
        <div className="relative">
          <textarea
            ref={textareaRef}
            placeholder="Tapez vos médicaments séparés par des virgules. Entrée pour analyser, Tab pour valider une suggestion."
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (showSuggestions && suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  applySuggestion(suggestions[highlightIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setShowSuggestions(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full min-h-[80px] max-h-[140px] text-sm px-3 py-2 rounded-md border border-border focus:border-primary focus:outline-none bg-background resize-none"
            autoFocus
            autoComplete="off"
          />
          {showSuggestions && (suggestions.length > 0 || searching) && (
            <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[220px] overflow-y-auto">
              {searching && suggestions.length === 0 && (
                <div className="py-2 px-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Recherche…
                </div>
              )}
              {suggestions.map((sug, idx) => (
                <button
                  key={`${sug.source}-${sug.nom}-${idx}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(sug)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent ${
                    idx === highlightIdx ? "bg-accent" : ""
                  }`}
                >
                  <Pill className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate font-medium">{sug.nom}</span>
                  {sug.laboratoire && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{sug.laboratoire}</span>
                  )}
                  <Badge
                    variant={sug.source === "stock" ? "default" : "secondary"}
                    className="text-[9px] px-1.5 py-0 h-4"
                  >
                    {sug.source === "stock" ? "Stock" : "Base"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
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
              <img src={imagePreview} alt="Aperçu de l'ordonnance importée" className="w-full max-h-[120px] object-contain bg-secondary" />
              <button
                onClick={clearImage}
                aria-label="Supprimer l'image importée"
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-foreground/70 text-background flex items-center justify-center"
              >
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
