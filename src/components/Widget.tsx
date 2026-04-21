import { useState, useCallback } from "react";
import { X, Loader2, Mail, Lock, Eye, EyeOff, LogOut, BarChart3, Monitor } from "lucide-react";
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
import RegisterSelector from "@/components/RegisterSelector";
import { useLgoPreset } from "@/hooks/useLgoPreset";
import { getPresetClasses, getPresetClassesElectron, LGO_PRESETS, type LgoType } from "@/lib/lgoPresets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
    // Reset anti-loop for each new prescription
    setBlockedProducts([]);
    try {
      const analysis = await analyzePrescription(text, { basketSessionId, blockedProducts: [] });
      setResult(analysis);
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(proposed);
      trackEvent("ordonnance_analyzed", { input_type: "text", medicaments: analysis.medicaments.map((m) => m.nom) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageBase64: string) => {
    setIsLoading(true);
    setBlockedProducts([]);
    try {
      const analysis = await analyzePrescriptionImage(imageBase64, { basketSessionId, blockedProducts: [] });
      setResult(analysis);
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(proposed);
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

const LgoPreviewPicker = ({
  current,
  onChange,
  isOverride,
}: {
  current: LgoType;
  onChange: (t: LgoType | null) => void;
  isOverride: boolean;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors"
        title="Aperçu LGO"
      >
        <Monitor className="h-2.5 w-2.5" />
        <span className="uppercase tracking-wider">{LGO_PRESETS[current].label}</span>
        {isOverride && <span className="text-[8px] opacity-70">(aperçu)</span>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56 z-[10000]">
      <DropdownMenuLabel className="text-xs">Aperçu d'intégration LGO</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {(Object.keys(LGO_PRESETS) as LgoType[]).map((key) => {
        const p = LGO_PRESETS[key];
        return (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key)}
            className="text-xs flex flex-col items-start gap-0.5 cursor-pointer"
          >
            <span className="font-semibold">{p.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {p.position} · {p.width}×{p.height}px
            </span>
          </DropdownMenuItem>
        );
      })}
      {isOverride && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Revenir au LGO de la pharmacie
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const Widget = ({ forceOpen = false }: {forceOpen?: boolean;}) => {
  const [open, setOpen] = useState(forceOpen);
  const { user, loading } = useAuth();
  const { preset: pharmacyPreset, lgoType: pharmacyLgoType } = useLgoPreset();
  const [previewLgo, setPreviewLgo] = useState<LgoType | null>(null);

  const lgoType: LgoType = previewLgo ?? pharmacyLgoType;
  const preset = previewLgo ? LGO_PRESETS[previewLgo] : pharmacyPreset;
  const isPreview = previewLgo !== null;

  if (forceOpen) {
    // Electron full-window mode: position the panel in the LGO preset corner,
    // leaving the rest of the window empty (transparent overlay zone).
    const electronPos = getPresetClassesElectron(preset.position);
    return (
      <div className="h-screen w-screen bg-transparent overflow-hidden relative">
        <div
          className={`fixed ${electronPos} flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-300`}
          style={{ width: `${preset.width}px`, height: `${preset.height}px` }}>
          <div className="pharmacy-gradient px-3 py-1.5 flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-primary-foreground tracking-tight">Asclion</span>
            <LgoPreviewPicker current={lgoType} onChange={setPreviewLgo} isOverride={isPreview} />
            <div className="flex-1" />
            <RegisterSelector />
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
        </div>
      </div>);

  }

  const panelPos = getPresetClasses(preset.position);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le widget Asclion" : "Ouvrir le widget Asclion"}
        className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full pharmacy-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        
        {open ? <X className="h-5 w-5 text-primary-foreground" /> : <span className="text-xs font-bold text-primary-foreground">A</span>}
      </button>

      {open &&
      <div
        className={`fixed ${panelPos} z-[9998] rounded-xl border border-border bg-background shadow-2xl animate-in fade-in duration-300 py-0 transition-all overflow-visible`}
        style={{ width: `${preset.width}px`, maxHeight: `calc(100vh - 6rem)` }}>
          <div className="overflow-y-auto max-h-[inherit] rounded-xl">
          <div className="pharmacy-gradient px-3 py-1.5 rounded-t-xl flex items-center gap-1.5 sticky top-0 z-10">
            <span className="text-[11px] font-bold text-primary-foreground tracking-tight">Asclion</span>
            <LgoPreviewPicker current={lgoType} onChange={setPreviewLgo} isOverride={isPreview} />
            <div className="flex-1" />
            <RegisterSelector />
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
        </div>
      }
    </>);

};

export default Widget;