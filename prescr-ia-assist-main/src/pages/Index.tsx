import { useEffect, useState, useCallback } from "react";
import { Pill, BarChart3, LogOut, ShieldX, PauseCircle, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SoundToggle from "@/components/SoundToggle";
import RegisterSelector from "@/components/RegisterSelector";

interface PC {
  produit: string;
  categorie?: string;
  description?: string;
  phrase_conseil?: string;
  pertinence?: string;
}

// Code couleur pertinence — identique à AnalysisResults.tsx
function pertinenceClass(p?: string): string {
  if (!p) return "text-muted-foreground";
  const k = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (k.startsWith("securit") || k.includes("alerte")) return "text-red-600 dark:text-red-400";
  if (k.startsWith("effet")) return "text-amber-600 dark:text-amber-400";
  if (k.startsWith("surveil")) return "text-sky-600 dark:text-sky-400";
  if (k.startsWith("synerg")) return "text-emerald-600 dark:text-emerald-400";
  if (k.startsWith("prevent")) return "text-teal-600 dark:text-teal-400";
  if (k.startsWith("accompagn")) return "text-violet-600 dark:text-violet-400";
  if (k.startsWith("confort")) return "text-pink-600 dark:text-pink-400";
  return "text-muted-foreground";
}

interface MedFeedItem {
  analysis_id: string;
  created_at: string;
  nom: string;
  classe?: string;
  molecule?: string;
  conseil_associe?: string;
  pcs: PC[];
}

const Index = () => {
  const { user, signOut, isAdmin, pharmacyStatus } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<MedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    const { data, error } = await supabase
      .from("analysis_history")
      .select("id, created_at, medicaments")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("feed error", error);
      setLoading(false);
      return;
    }

    const flat: MedFeedItem[] = [];
    for (const row of data || []) {
      const meds = Array.isArray(row.medicaments) ? (row.medicaments as any[]) : [];
      for (const med of meds) {
        const recs: PC[] = Array.isArray(med.recommendations) ? med.recommendations : [];
        // 2 PCs obligatoires : on prend les 2 premières
        const pcs = recs.slice(0, 2);
        if (pcs.length === 0) continue;
        // Compléter si moins de 2 PC pour respecter la règle d'affichage
        while (pcs.length < 2) {
          pcs.push({
            produit: "Conseil personnalisé à proposer",
            categorie: "À enrichir",
            phrase_conseil: "Aucune seconde recommandation enregistrée pour cette analyse.",
          });
        }
        flat.push({
          analysis_id: row.id,
          created_at: row.created_at,
          nom: med.nom,
          classe: med.classe,
          molecule: med.molecule,
          conseil_associe: med.conseil_associe,
          pcs,
        });
        if (flat.length >= 5) break;
      }
      if (flat.length >= 5) break;
    }
    setItems(flat);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchFeed();
    const channel = supabase
      .channel("analysis_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "analysis_history" },
        () => fetchFeed()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFeed]);

  // Block paused/disabled pharmacies
  if (user && !isAdmin && (pharmacyStatus === "paused" || pharmacyStatus === "disabled")) {
    const isPaused = pharmacyStatus === "paused";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          {isPaused ? (
            <PauseCircle className="h-16 w-16 text-yellow-500 mx-auto" />
          ) : (
            <ShieldX className="h-16 w-16 text-destructive mx-auto" />
          )}
          <h1 className="text-xl font-bold">
            {isPaused ? "Accès temporairement suspendu" : "Accès désactivé"}
          </h1>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="pharmacy-gradient px-3 py-1.5 shrink-0 sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-bold text-primary-foreground tracking-tight">Asclion</span>
          <span className="text-[10px] text-primary-foreground/70 ml-2">Flux des 5 dernières analyses</span>
          <div className="flex-1" />
          <SoundToggle />
          <RegisterSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setLoading(true); fetchFeed(); }}
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-3 py-3 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement du flux...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Pill className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Aucune analyse récente</p>
            <p className="text-xs text-muted-foreground/70">
              Les médicaments analysés (scan douchette, OCR, saisie) apparaîtront ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <article
                key={`${item.analysis_id}-${idx}`}
                className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
              >
                <header className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                      <h2 className="text-sm font-semibold text-foreground truncate">{item.nom}</h2>
                      {item.classe && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {item.classe}
                        </Badge>
                      )}
                    </div>
                    {item.molecule && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.molecule}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(item.created_at)}
                  </span>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.pcs.map((pc, i) => (
                    <div
                      key={i}
                      className="border border-border/60 rounded-md p-2 bg-background/50 space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-accent shrink-0" />
                        <h3 className="text-xs font-medium text-foreground truncate">{pc.produit}</h3>
                      </div>
                      {pc.phrase_conseil && (
                        <p className={`text-[11px] leading-snug italic ${pertinenceClass(pc.pertinence)}`}>
                          « {pc.phrase_conseil} »
                        </p>
                      )}
                      {pc.categorie && (
                        <Badge variant="outline" className="text-[9px] font-normal">
                          {pc.categorie}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <LegalDisclaimer />
          </div>
        )}
      </main>

      <footer className="container max-w-2xl mx-auto px-3 py-2 flex items-center justify-center gap-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground h-7 text-xs gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Dashboard
        </Button>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground h-7 text-xs gap-1">
          <LogOut className="h-3.5 w-3.5" />
          Déconnexion
        </Button>
      </footer>
    </div>
  );
};

export default Index;
