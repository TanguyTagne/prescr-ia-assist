import { useState } from "react";
import { Pill, X, Loader2, Mail, Lock, Eye, EyeOff, LogOut, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PrescriptionInput from "@/components/PrescriptionInput";
import AnalysisResults from "@/components/AnalysisResults";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { analyzePrescription, analyzePrescriptionImage, type AnalysisResult } from "@/lib/prescriptionAnalyzer";
import { trackEvent } from "@/hooks/useAnalytics";
import { useNavigate } from "react-router-dom";

const WidgetAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Vérifiez votre email pour confirmer.");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold text-center">{isLogin ? "Connexion" : "Inscription"}</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <div className="relative">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" className="h-8 text-xs pl-8" required />
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <div className="relative">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-8 text-xs pl-8" required />
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>
        <div className="relative">
          <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="h-8 text-xs pl-8 pr-8" minLength={6} required />
          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
        <Button type="submit" className="w-full h-8 text-xs font-semibold pharmacy-gradient border-0" disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : isLogin ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>
      <p className="text-center text-[10px] text-muted-foreground">
        {isLogin ? "Pas de compte ?" : "Déjà un compte ?"}
        <button onClick={() => setIsLogin(!isLogin)} className="ml-1 text-primary font-medium hover:underline">
          {isLogin ? "S'inscrire" : "Se connecter"}
        </button>
      </p>
    </div>
  );
};

const WidgetApp = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescription(text);
      setResult(analysis);
      trackEvent("ordonnance_analyzed", { input_type: "text", medicaments: analysis.medicaments.map(m => m.nom) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescriptionImage(imageBase64);
      setResult(analysis);
      trackEvent("ordonnance_analyzed", { input_type: "image", medicaments: analysis.medicaments.map(m => m.nom) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse OCR");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ordonnance</p>
        <div className="flex gap-0.5">
          <button onClick={() => navigate("/dashboard")} className="p-1 rounded hover:bg-accent text-muted-foreground"><BarChart3 className="h-3 w-3" /></button>
          <button onClick={signOut} className="p-1 rounded hover:bg-accent text-muted-foreground"><LogOut className="h-3 w-3" /></button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4 gap-1.5">
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          <p className="text-[11px] text-muted-foreground">Analyse...</p>
        </div>
      ) : !result ? (
        <div className="space-y-2">
          <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
          <LegalDisclaimer />
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Essayer :</span>
            {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole"].map((ex) => (
              <button key={ex} onClick={() => handleAnalyze(ex)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <AnalysisResults result={result} onReset={() => setResult(null)} />
      )}
    </div>
  );
};

const Widget = ({ forceOpen = false }: { forceOpen?: boolean }) => {
  const [open, setOpen] = useState(forceOpen);
  const { user, loading } = useAuth();

  if (forceOpen) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="pharmacy-gradient px-4 py-2.5 flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-bold text-primary-foreground tracking-tight">PrescrIA</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !user ? (
            <WidgetAuth />
          ) : (
            <WidgetApp />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full pharmacy-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="h-5 w-5 text-primary-foreground" /> : <Pill className="h-5 w-5 text-primary-foreground" />}
      </button>

      {open && (
        <div className="fixed bottom-[4.5rem] right-4 z-[9998] w-[320px] max-h-[480px] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="pharmacy-gradient px-3 py-1.5 rounded-t-xl flex items-center gap-1.5">
            <Pill className="h-3 w-3 text-primary-foreground" />
            <span className="text-[11px] font-bold text-primary-foreground tracking-tight">PrescrIA</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : !user ? (
            <WidgetAuth />
          ) : (
            <WidgetApp />
          )}
        </div>
      )}
    </>
  );
};

export default Widget;
