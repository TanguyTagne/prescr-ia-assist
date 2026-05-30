import { useState, useCallback, useEffect, useRef } from "react";
import { X, Loader2, Mail, Lock, Eye, EyeOff, Monitor, HelpCircle, Pin, PinOff, Minimize2, Maximize2, LogOut, ScanLine } from "lucide-react";
import OnboardingTour from "@/components/OnboardingTour";
import AnalysisSkeleton from "@/components/AnalysisSkeleton";
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
import { ScannerStatus } from "@/components/ScannerStatus";
import { pdfToImageBase64 } from "@/lib/pdfToImage";
import RegisterSelector from "@/components/RegisterSelector";
import SoundToggle from "@/components/SoundToggle";
import { notifyAnalysisDone } from "@/lib/notifyAnalysisDone";
import { logger } from "@/lib/logger";
import { SCANNER } from "@/constants/scanner";
import { lookupEanMock } from "@/lib/eanLookup";
import { useLgoPreset } from "@/hooks/useLgoPreset";
import { getPresetClasses, LGO_PRESETS, type LgoType } from "@/lib/lgoPresets";
import { isAsclionDesktopRuntime } from "@/lib/runtime";
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

  // Basket memory (anti-loop)
  const [basketSessionId] = useState(() => crypto.randomUUID());
  const [blockedProducts, setBlockedProducts] = useState<string[]>([]);
  // CIP codes of products suggested by the system — skip analysis when scanned
  const blockedCipsRef = useRef<Set<string>>(new Set());
  // Dedup guard: keyboard path + IPC global path fire simultaneously on focused window
  const lastBarcodeScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  // Cached user/pharmacy context — populated once on mount to avoid a DB query on every scan
  const scanContextRef = useRef<{ userId: string; pharmacyId: string | null } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("pharmacy_id").eq("id", user.id).maybeSingle()
        .then(({ data }) => {
          scanContextRef.current = {
            userId: user.id,
            pharmacyId: (data as any)?.pharmacy_id ?? null,
          };
        });
    });
  }, []);

  const handleReset = () => {
    setResult(null);
  };

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    setBlockedProducts([]);
    blockedCipsRef.current = new Set();
    try {
      const analysis = await analyzePrescription(text, { basketSessionId, blockedProducts: [] });
      setResult(analysis);
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(proposed);
      notifyAnalysisDone({ count: analysis.medicaments.length });
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
    blockedCipsRef.current = new Set();
    try {
      const analysis = await analyzePrescriptionImage(imageBase64, { basketSessionId, blockedProducts: [] });
      setResult(analysis);
      const proposed = analysis.medicaments.flatMap(m => (m.recommendations || []).map(r => r.produit));
      setBlockedProducts(proposed);
      notifyAnalysisDone({ count: analysis.medicaments.length });
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
        notifyAnalysisDone({ count: normalized.medicaments.length });
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
      logger.error("Scanner file error:", err);
      toast.error("Erreur lors du traitement du scan");
    }
  }, []);

  // ===== Streaming scans =====
  // Chaque code scanné est analysé indépendamment et ajouté en tête du résultat
  // (le plus récent en premier). Aucun skeleton ne réapparaît si un résultat
  // précédent est déjà affiché : le nouveau s'insère dès qu'il est prêt.
  const resultRef = useRef<AnalysisResult | null>(null);
  useEffect(() => { resultRef.current = result; }, [result]);

  const prependMedicament = useCallback((med: AnalysisResult["medicaments"][number]) => {
    const prev = resultRef.current;
    const next: AnalysisResult = prev
      ? {
          ...prev,
          // dédoublonne sur le nom (re-scan du même produit → on bouge en tête)
          medicaments: [med, ...prev.medicaments.filter((m) => m.nom !== med.nom)],
        }
      : {
          medicaments: [med],
          interactions: [],
          contextes: [],
          conseil: "",
          structuredData: true,
          sources: [],
        };
    setResult(next);
  }, []);

  // Écrit un événement dans scan_events (table admin-only, toutes pharmacies).
  // Fire-and-forget — n'affecte jamais l'UX du pharmacien.
  const logScanEvent = useCallback(async (
    ean: string,
    status: "success" | "no_match" | "no_pharmacy" | "error" | "anti_loop",
    opts?: { productName?: string; suggestionsCount?: number; errorMessage?: string }
  ) => {
    try {
      await (supabase as any).from("scan_events").insert({
        pharmacy_id: scanContextRef.current?.pharmacyId ?? null,
        register_id: localStorage.getItem(SCANNER.STORAGE_REGISTER_ID) || null,
        ean_code: ean,
        status,
        product_name: opts?.productName ?? null,
        suggestions_count: opts?.suggestionsCount ?? 0,
        error_message: opts?.errorMessage ?? null,
      });
    } catch {
      // best-effort — never throw
    }
  }, []);

  // Logge un scan HID dans analysis_history (fire-and-forget) pour qu'il
  // apparaisse dans les KPIs. Le chemin scan ne passe pas par l'edge function
  // analyze-prescription qui s'occupe normalement de ce logging.
  const logHidScan = useCallback(async (
    code: string,
    med: { nom: string; recommendations: AnalysisResult["medicaments"][number]["recommendations"] }
  ) => {
    // Use cached context — avoids a DB round-trip on every scan
    if (!scanContextRef.current?.userId) {
      logger.warn("[ASCLION-LOG] logHidScan: utilisateur non connecté");
      void logScanEvent(code, "no_pharmacy", { productName: med.nom });
      return;
    }
    const { userId, pharmacyId } = scanContextRef.current;
    if (!pharmacyId) {
      logger.warn("[ASCLION-LOG] logHidScan: pharmacy_id manquant — vérifiez que le compte est bien rattaché à une pharmacie");
      toast.warning("Compte non rattaché à une pharmacie — scan non enregistré");
      void logScanEvent(code, "no_pharmacy", { productName: med.nom });
      return;
    }

    try {
      const enc = new TextEncoder().encode(`hid:${code}:${Date.now()}`);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const registerId = localStorage.getItem(SCANNER.STORAGE_REGISTER_ID) || null;

      const { error } = await supabase.from("analysis_history").insert({
        pharmacy_id: pharmacyId,
        user_id: userId,
        register_id: registerId,
        patient_hash: hash.slice(0, 32),
        prescription_hash: hash,
        medicaments: [{ nom: med.nom, classe: "", recommendations: med.recommendations }] as any,
        interactions_count: 0,
        suggestions_count: med.recommendations?.length || 0,
        has_major_interaction: false,
        metadata: { source: "hid_scan", ean: code } as any,
      } as any);

      if (error) {
        logger.error("[ASCLION-LOG] logHidScan insert échoué:", error.message);
        void logScanEvent(code, "error", { productName: med.nom, errorMessage: error.message });
      } else {
        void logScanEvent(code, "success", {
          productName: med.nom,
          suggestionsCount: med.recommendations?.length || 0,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[ASCLION-LOG] logHidScan exception:", msg);
      void logScanEvent(code, "error", { productName: med.nom, errorMessage: msg });
    }

    trackEvent("ordonnance_analyzed", { input_type: "barcode_hid", medicaments: [med.nom], ean: code });
  }, [logScanEvent]);

  const lookupAndStream = useCallback(async (code: string) => {
    const ts = new Date().toISOString();
    try {
      // ── Pass 1 : lookup direct sur medicaments.cip_code ──────────────────
      const { data: directMed } = await supabase
        .from("medicaments")
        .select("id, nom_commercial, cip_code, molecule_id, atc_code")
        .eq("cip_code", code)
        .maybeSingle();

      // ── Pass 2 : fallback via medicament_cip (37 607 CIPs BDPM) ─────────
      let med: typeof directMed = directMed;
      if (!med) {
        const { data: cipRow } = await supabase
          .from("medicament_cip")
          .select("medicament_nom")
          .eq("cip13", code)
          .maybeSingle();

        if (cipRow?.medicament_nom) {
          const { data: fallbackMed } = await supabase
            .from("medicaments")
            .select("id, nom_commercial, cip_code, molecule_id, atc_code")
            .ilike("nom_commercial", `${cipRow.medicament_nom}%`)
            .order("nom_commercial", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (fallbackMed) {
            logger.log(`[SCAN] ${ts} ean=${code} match=medicament_cip name=${fallbackMed.nom_commercial}`);
            med = fallbackMed;
          }
        }
      }

      if (med) {
        logger.log(`[SCAN] ${ts} ean=${code} match=db name=${med.nom_commercial}`);
        const { data: pathLinks } = await supabase
          .from("medicament_pathologie")
          .select("pathologie_id")
          .eq("medicament_id", med.id);

        let recommendations: AnalysisResult["medicaments"][number]["recommendations"] = [];
        if (pathLinks && pathLinks.length > 0) {
          const pathIds = pathLinks.map((p) => p.pathologie_id);
          // Include medicaments join to get CIP codes for anti-loop blocking
          const { data: produits } = await supabase
            .from("produits_complementaires")
            .select("produit, categorie, description, phrase_conseil, medicaments(cip_code)")
            .in("pathologie_id", pathIds)
            .order("priorite", { ascending: false })
            .limit(2);
          if (produits) {
            recommendations = (produits as any[]).map((p) => ({
              produit: p.produit,
              categorie: p.categorie || "",
              description: p.description || undefined,
              phrase_conseil: p.phrase_conseil || undefined,
              priorite: 90,
            }));
            // Register CIP codes of suggested products so they are skipped if scanned
            const newNames: string[] = [];
            for (const p of produits as any[]) {
              const cip = p.medicaments?.cip_code;
              if (cip) blockedCipsRef.current.add(cip);
              newNames.push(p.produit);
            }
            if (newNames.length > 0) {
              setBlockedProducts((prev) => [...new Set([...prev, ...newNames])]);
            }
          }
        }
        prependMedicament({ nom: med.nom_commercial, classe: "", recommendations });
        notifyAnalysisDone({ count: 1 });
        void logHidScan(code, { nom: med.nom_commercial, recommendations });
        return;
      }

      const mock = lookupEanMock(code);
      if (mock) {
        logger.log(`[SCAN] ${ts} ean=${code} match=mock name=${mock.nom}`);
        const recommendations = mock.complementaires.map((c) => ({
          produit: c.nom,
          categorie: "",
          description: c.raison,
          priorite: 90,
        }));
        // Mock products don't have CIP codes — block by name only
        if (recommendations.length > 0) {
          setBlockedProducts((prev) => [
            ...new Set([...prev, ...recommendations.map((r) => r.produit)]),
          ]);
        }
        prependMedicament({ nom: mock.nom, classe: "", recommendations });
        notifyAnalysisDone({ count: 1 });
        void logHidScan(code, { nom: mock.nom, recommendations });
        return;
      }

      logger.log(`[SCAN] ${ts} ean=${code} match=none`);
      void logScanEvent(code, "no_match");
      // Trace côté DB même si le CIP est inconnu — sinon on ne sait pas
      // distinguer "douchette muette" de "CIP absent du référentiel".
      void logHidScan(code, { nom: `EAN ${code} (non référencé)`, recommendations: [] });
      toast.warning(`Aucun produit trouvé pour le code ${code}`);
    } catch (err) {
      logger.error("Barcode lookup error:", err);
      toast.error("Erreur lors de la recherche du produit");
    }
  }, [prependMedicament, logHidScan, logScanEvent]);

  const handleBarcodeScan = useCallback((code: string) => {
    const now = Date.now();

    // Guard 1 — dedup: keyboard path + IPC global path fire simultaneously when window is focused
    if (lastBarcodeScanRef.current.code === code && now - lastBarcodeScanRef.current.at < SCANNER.DEDUP_WINDOW_MS) {
      logger.log(`[SCAN] dedup ${code} — double déclenchement clavier/IPC`);
      return;
    }
    lastBarcodeScanRef.current = { code, at: now };

    // Guard 2 — anti-boucle: ce code correspond à un produit proposé par le système
    if (blockedCipsRef.current.has(code)) {
      logger.log(`[SCAN] anti-loop ${code} — produit proposé`);
      toast.success("Produit complémentaire scanné", { duration: 1500 });
      void logScanEvent(code, "anti_loop");
      return;
    }

    toast.info(`🔍 ${code}`);
    // Skeleton only on the very first scan (before any result is displayed)
    if (!resultRef.current) setIsLoading(true);
    lookupAndStream(code).finally(() => setIsLoading(false));
  }, [lookupAndStream, logScanEvent]);

  // Listen for global HID scans (system-wide, dispatched by the Electron bridge)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ ean: string; at: number }>).detail;
      if (!detail?.ean) return;
      handleBarcodeScan(detail.ean);
    };
    window.addEventListener(SCANNER.DOM_EVENT, handler);
    return () => window.removeEventListener(SCANNER.DOM_EVENT, handler);
  }, [handleBarcodeScan]);


  return (
    <div className="p-4 space-y-3 py-0">
      <ScannerStatus onViewResult={handleScanResult} onNewFile={handleNewFile} onBarcodeScan={handleBarcodeScan} />

      {isLoading ?
      <AnalysisSkeleton /> :
      !result ?
      <div className="space-y-3">
          <PrescriptionInput onAnalyze={handleAnalyze} onAnalyzeImage={handleAnalyzeImage} />
          <LegalDisclaimer />
          <p className="text-[10px] text-foreground/60 text-center pt-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">Échap</kbd> · <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">Entrée</kbd> · <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">?</kbd> aide
          </p>
        </div> :

      <>
        <AnalysisResults result={result} onReset={handleReset} />
      </>
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

const ScannerIndicator = () => {
  const [detected, setDetected] = useState<boolean>(() => {
    try { return localStorage.getItem(SCANNER.STORAGE_SCANNER_DETECTED) === "1"; } catch { return false; }
  });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const handler = () => {
      setDetected(true);
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
    };
    window.addEventListener(SCANNER.DOM_EVENT, handler);
    return () => window.removeEventListener(SCANNER.DOM_EVENT, handler);
  }, []);

  // Hide entirely on web (no global listener possible) to keep the header clean
  const hasBridge = typeof window !== "undefined" && !!window.electronAPI?.onGlobalBarcode;
  if (!hasBridge) return null;

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-primary-foreground/90"
      title={
        detected
          ? "Douchette détectée — interception automatique active"
          : "En attente d'un premier scan douchette"
      }
    >
      <ScanLine className="h-2.5 w-2.5" />
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          detected ? "bg-green-400" : "bg-primary-foreground/40"
        } ${pulse ? "animate-ping" : ""}`}
      />
    </div>
  );
};

const PipControls = () => {
  const api = (typeof window !== "undefined" ? (window as any).electronAPI?.pip : null) as
    | { getState: () => Promise<{ alwaysOnTop: boolean; compact: boolean }>; toggle: () => Promise<{ alwaysOnTop: boolean; compact: boolean }>; setCompact: (c: boolean) => Promise<{ alwaysOnTop: boolean; compact: boolean }> }
    | null;
  const [state, setState] = useState<{ alwaysOnTop: boolean; compact: boolean } | null>(null);

  useEffect(() => {
    if (!api) return;
    api.getState().then(setState).catch(() => {});
  }, [api]);

  if (!api || !state) return null;

  const togglePin = async () => {
    const next = await api.toggle();
    setState(next);
  };
  const toggleCompact = async () => {
    const next = await api.setCompact(!state.compact);
    setState(next);
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={togglePin}
        title={state.alwaysOnTop ? "Désépingler la fenêtre" : "Garder au premier plan"}
        aria-label={state.alwaysOnTop ? "Désépingler" : "Épingler"}
        className="text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
      >
        {state.alwaysOnTop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={toggleCompact}
        title={state.compact ? "Taille normale" : "Mode compact"}
        aria-label={state.compact ? "Agrandir" : "Réduire"}
        className="text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
      >
        {state.compact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

const Widget = ({ forceOpen = false }: {forceOpen?: boolean;}) => {
  const isDesktopRuntime = forceOpen || isAsclionDesktopRuntime();

  // Web: always open so visitors can naturally try the demo. Electron: forceOpen.
  const [open, setOpen] = useState(true);
  const { user, loading, signOut, onboardingCompleted, refreshOnboarding } = useAuth();
  const { preset: pharmacyPreset, lgoType: pharmacyLgoType } = useLgoPreset();
  const [previewLgo, setPreviewLgo] = useState<LgoType | null>(null);
  const [showTour, setShowTour] = useState(false);

  const lgoType: LgoType = previewLgo ?? pharmacyLgoType;
  const preset = previewLgo ? LGO_PRESETS[previewLgo] : pharmacyPreset;
  const isPreview = previewLgo !== null;

  // Trigger onboarding on first login
  useEffect(() => {
    if (user && !loading && !onboardingCompleted) {
      const t = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [user, loading, onboardingCompleted]);

  // Global "?" shortcut to open help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target as any)?.isContentEditable) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        window.open("/aide", "_blank", "noopener");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const tourClose = () => {
    setShowTour(false);
    refreshOnboarding();
  };

  if (isDesktopRuntime) {
    // Electron full-window mode: the panel fills the entire native window.
    return (
      <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
          <div className="pharmacy-gradient px-3 py-1.5 flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-primary-foreground tracking-tight">Asclion</span>
            <ScannerIndicator />
            <LgoPreviewPicker current={lgoType} onChange={setPreviewLgo} isOverride={isPreview} />
            <div className="flex-1" />
            <PipControls />
            <SoundToggle />
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
          {!loading && user && (
            <div className="shrink-0 border-t border-border bg-background px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
          )}
        </div>
      </div>);

  }

  // Position web : toujours bas-droite (coin le moins encombré sur Windows/LGO,
  // zone "notification" standard que les utilisateurs scannent en dernier recours).
  const panelPos = getPresetClasses("bottom-right");

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
        data-tour-target="widget"
        className={`fixed ${panelPos} z-[9998] rounded-xl border border-border bg-background shadow-2xl animate-in fade-in duration-300 py-0 transition-all overflow-visible`}
        style={{ width: `${preset.width}px`, maxHeight: `calc(100vh - 6rem)` }}>
          <div className="overflow-y-auto max-h-[inherit] rounded-xl">
          <div className="pharmacy-gradient px-3 py-1.5 rounded-t-xl flex items-center gap-1.5 sticky top-0 z-10">
            <span className="text-[11px] font-bold text-primary-foreground tracking-tight">Asclion</span>
            <LgoPreviewPicker current={lgoType} onChange={setPreviewLgo} isOverride={isPreview} />
            <div className="flex-1" />
            <button
              onClick={() => window.open("/aide", "_blank", "noopener")}
              aria-label="Ouvrir l'aide"
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors p-0.5 focus-visible:ring-2 focus-visible:ring-primary-foreground/50 rounded"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
            <RegisterSelector />
          </div>
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
      }
      <OnboardingTour open={showTour} onClose={tourClose} />
    </>);

};

export default Widget;
