import { useState, useCallback } from "react";
import { X, Loader2, Mail, Lock, Eye, EyeOff, LogOut, BarChart3 } from "lucide-react";
import asclionLogo from "@/assets/logo-asclion.png";
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
import { ScannerStatus } from "@/components/ScannerStatus";
import { pdfToImageBase64 } from "@/lib/pdfToImage";

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
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin }
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
        {!isLogin &&
        <div className="relative">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" className="h-10 text-sm pl-8" required />
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          </div>
        }
        <div className="relative">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-10 text-sm pl-8" required />
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>
        <div className="relative">
          <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="h-10 text-sm pl-8 pr-8" minLength={6} required />
          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
        <Button type="submit" className="w-full h-10 text-sm font-semibold pharmacy-gradient border-0" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        {isLogin ? "Pas de compte ?" : "Déjà un compte ?"}
        <button onClick={() => setIsLogin(!isLogin)} className="ml-1 text-primary font-medium hover:underline">
          {isLogin ? "S'inscrire" : "Se connecter"}
        </button>
      </p>
    </div>);

};

const WidgetApp = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Basket memory (anti-loop)
  const [basketSessionId] = useState(() => crypto.randomUUID());
  const [blockedProducts, setBlockedProducts] = useState<string[]>([]);
  const [orderedProducts, setOrderedProducts] = useState<string[]>([]);

  const basketOptions = { basketSessionId, blockedProducts };

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescription(text, basketOptions);
      setResult(analysis);
      // Track proposed PCs in blocked list
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(prev => [...new Set([...prev, ...proposed])]);
      trackEvent("ordonnance_analyzed", { input_type: "text", medicaments: analysis.medicaments.map((m) => m.nom) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzePrescriptionImage(imageBase64, basketOptions);
      setResult(analysis);
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(prev => [...new Set([...prev, ...proposed])]);
      trackEvent("ordonnance_analyzed", { input_type: "image", medicaments: analysis.medicaments.map((m) => m.nom) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse OCR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanResult = (scan: any) => {
    if (scan.scan_type === "prescription" && scan.result) {
      try {
        const normalized = {
          medicaments: scan.result.medicaments || [],
          interactions: scan.result.interactions || [],
          contextes: scan.result.contextes || [],
          conseil: scan.result.conseil || "",
          structuredData: scan.result.structuredData || false,
          sources: scan.result.sources || [],
        };
        setResult(normalized as AnalysisResult);
      } catch {}
    }
  };

  const handleNewFile = useCallback(async (file: File) => {
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

    toast.info(`📄 Ordonnance détectée : ${file.name} — analyse en cours...`);

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
      await handleAnalyzeImage(base64);
    } catch (err) {
      console.error("Scanner file error:", err);
      toast.error("Erreur lors du traitement du scan");
    }
  }, []);

  const handleBarcodeScan = useCallback(async (code: string) => {
    toast.info(`🔍 Code scanné : ${code} — recherche...`);

    try {
      const { data: med } = await supabase
        .from("medicaments")
        .select("id, nom_commercial, cip_code, molecule_id, atc_code")
        .eq("cip_code", code)
        .maybeSingle();

      if (!med) {
        toast.warning(`Aucun médicament trouvé pour le code CIP ${code}`);
        return;
      }

      toast.success(`💊 ${med.nom_commercial} identifié`);

      const { data: pathLinks } = await supabase
        .from("medicament_pathologie")
        .select("pathologie_id")
        .eq("medicament_id", med.id);

      if (pathLinks && pathLinks.length > 0) {
        const pathIds = pathLinks.map((p) => p.pathologie_id);
        const { data: produits } = await supabase
          .from("produits_complementaires")
          .select("produit, categorie, description")
          .in("pathologie_id", pathIds)
          .order("priorite", { ascending: false })
          .limit(5);

        if (produits && produits.length > 0) {
          setResult({
            medicaments: [{
              nom: med.nom_commercial,
              classe: "",
              recommendations: produits.map((p) => ({
                produit: p.produit,
                categorie: p.categorie || "",
                description: p.description || undefined,
                priorite: 90,
              })),
            }],
            interactions: [],
            contextes: [],
            conseil: `Produits complémentaires suggérés pour ${med.nom_commercial}`,
            structuredData: true,
            sources: [],
          });
        }
      }
    } catch (err) {
      console.error("Barcode lookup error:", err);
      toast.error("Erreur lors de la recherche du produit");
    }
  }, []);

  return (
    <div className="p-4 space-y-3 py-0">
      <ScannerStatus onViewResult={handleScanResult} onNewFile={handleNewFile} onBarcodeScan={handleBarcodeScan} />

      {isLoading ?
      <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Analyse...</p>
        </div> :
      !result ?
      <div className="space-y-3">
          <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
          <LegalDisclaimer />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Essayer :</span>
            {["Amoxicilline, Doliprane", "Ibuprofène, Oméprazole"].map((ex) =>
          <button key={ex} onClick={() => handleAnalyze(ex)} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                {ex}
              </button>
          )}
          </div>
        </div> :

      <AnalysisResults result={result} onReset={() => setResult(null)} />
      }
    </div>);

};

const Widget = ({ forceOpen = false }: {forceOpen?: boolean;}) => {
  const [open, setOpen] = useState(forceOpen);
  const { user, loading } = useAuth();

  if (forceOpen) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        <div className="pharmacy-gradient px-4 py-2 flex items-center gap-2 shrink-0">
          <img src={asclionLogo} alt="Asclion" className="h-5 w-5 rounded object-contain" />
          <span className="text-sm font-bold text-primary-foreground tracking-tight">Asclion</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ?
          <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div> :
          !user ?
          <WidgetAuth /> :

          <WidgetApp />
          }
        </div>
      </div>);

  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le widget Asclion" : "Ouvrir le widget Asclion"}
        className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full pharmacy-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        
        {open ? <X className="h-5 w-5 text-primary-foreground" /> : <img src={asclionLogo} alt="Asclion" className="h-7 w-7 rounded-full object-contain" />}
      </button>

      {open &&
      <div className="fixed bottom-[4.5rem] right-4 z-[9998] w-[320px] max-h-[480px] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200 py-0">
          <div className="pharmacy-gradient px-3 py-1.5 rounded-t-xl flex items-center gap-1.5">
            <img src={asclionLogo} alt="Asclion" className="h-4 w-4 rounded object-contain" />
            <span className="text-[11px] font-bold text-primary-foreground tracking-tight">Asclion</span>
          </div>
          {loading ?
        <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div> :
        !user ?
        <WidgetAuth /> :

        <WidgetApp />
        }
        </div>
      }
    </>);

};

export default Widget;