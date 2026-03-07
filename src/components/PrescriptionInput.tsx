import { useState } from "react";
import { Search, FileText, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface PrescriptionInputProps {
  onAnalyze: (text: string) => void;
}

const PrescriptionInput = ({ onAnalyze }: PrescriptionInputProps) => {
  const [mode, setMode] = useState<"quick" | "text">("quick");
  const [quickInput, setQuickInput] = useState("");
  const [textInput, setTextInput] = useState("");

  const handleSubmit = () => {
    const value = mode === "quick" ? quickInput : textInput;
    if (value.trim()) onAnalyze(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("quick")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "quick"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          <Keyboard className="h-4 w-4" />
          Saisie rapide
        </button>
        <button
          onClick={() => setMode("text")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "text"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          <FileText className="h-4 w-4" />
          Coller un texte
        </button>
      </div>

      {/* Input */}
      {mode === "quick" ? (
        <Input
          placeholder="Ex : Amoxicilline, Doliprane, Oméprazole..."
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-14 text-lg px-4 border-2 border-border focus:border-primary"
          autoFocus
        />
      ) : (
        <Textarea
          placeholder="Collez le contenu de l'ordonnance ici..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] text-base px-4 py-3 border-2 border-border focus:border-primary"
          autoFocus
        />
      )}

      <Button
        onClick={handleSubmit}
        size="lg"
        className="w-full h-14 text-lg font-semibold pharmacy-gradient border-0"
        disabled={!(mode === "quick" ? quickInput : textInput).trim()}
      >
        <Search className="h-5 w-5 mr-2" />
        Analyser l'ordonnance
      </Button>
    </div>
  );
};

export default PrescriptionInput;
