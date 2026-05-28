import { useEffect, useState } from "react";
import { BarChart3, Activity, MousePointerClick, ShoppingBag, Clock, ArrowLeft, LogOut, Download, Monitor, Shield, Package, Brain, Keyboard, Building2, Wrench, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import ProductMappingSettings from "@/components/ProductMappingSettings";
import ShortcutsSettings from "@/components/ShortcutsSettings";

interface KpiData {
  ordonnancesDetected: number;
  widgetShown: number;
  conseilClicks: number;
  suggestionsUsed: number;
  avgResponseTime: number;
}

const Dashboard = () => {
  const { user, signOut, isAdmin, isGroupManager } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KpiData>({
    ordonnancesDetected: 0,
    widgetShown: 0,
    conseilClicks: 0,
    suggestionsUsed: 0,
    avgResponseTime: 0,
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: events } = await supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (events) {
        const ordonnances = events.filter(e => e.event_type === "ordonnance_analyzed");
        const widgets = events.filter(e => e.event_type === "widget_shown");
        const conseils = events.filter(e => e.event_type === "conseil_clicked");
        const suggestions = events.filter(e => e.event_type === "suggestion_used");
        const responseTimes = events
          .filter(e => e.event_type === "ordonnance_analyzed" && (e.metadata as any)?.response_time)
          .map(e => (e.metadata as any).response_time as number);

        setKpis({
          ordonnancesDetected: ordonnances.length,
          widgetShown: widgets.length,
          conseilClicks: conseils.length,
          suggestionsUsed: suggestions.length,
          avgResponseTime: responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0,
        });

        setRecentEvents(events.slice(0, 20));
      }
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = [
    { label: "Ordonnances analysées", value: kpis.ordonnancesDetected, icon: Activity, color: "text-primary" },
    { label: "Widget affiché", value: kpis.widgetShown, icon: BarChart3, color: "text-primary" },
    { label: "Clics 'Voir conseil'", value: kpis.conseilClicks, icon: MousePointerClick, color: "text-primary" },
    { label: "Suggestions utilisées", value: kpis.suggestionsUsed, icon: ShoppingBag, color: "text-primary" },
    { label: "Temps moyen (ms)", value: kpis.avgResponseTime, icon: Clock, color: "text-primary" },
  ];

  const eventLabel = (type: string) => {
    switch (type) {
      case "ordonnance_analyzed": return "Analyse";
      case "widget_shown": return "Widget";
      case "conseil_clicked": return "Conseil";
      case "suggestion_used": return "Suggestion";
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight">Dashboard Asclion</h1>
              <p className="text-xs text-primary-foreground/70">KPIs pharmacie</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/fonctionnalites")}
              className="text-primary-foreground hover:bg-primary-foreground/10 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Fonctionnalités
            </Button>
            {(isGroupManager || isAdmin) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/groupement")}
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-2"
              >
                <Building2 className="h-4 w-4" />
                Espace groupement
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10 gap-2">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className="glass-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{loading ? "—" : kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Chargement...</p>
            ) : recentEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune activité enregistrée. Analysez une ordonnance pour commencer.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary text-sm">
                    <span className="font-medium">{eventLabel(event.event_type)}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(event.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Mapping Settings */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Personnalisation des recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductMappingSettings />
          </CardContent>
        </Card>

        {/* Shortcuts Section */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" />
              Raccourcis clavier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShortcutsSettings />
          </CardContent>
        </Card>


        {/* Quiz Section */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Quiz Formation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Testez et renforcez vos connaissances en conseil officinal avec des quiz générés à partir de votre base clinique.
            </p>
            <Button onClick={() => navigate("/quiz")} className="w-full sm:w-auto pharmacy-gradient border-0 gap-2">
              <Brain className="h-4 w-4" />
              Lancer un quiz
            </Button>
          </CardContent>
        </Card>

        {/* Download Section */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Installer Asclion sur vos postes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Téléchargez l'application desktop pour analyser les ordonnances directement depuis votre poste de travail, sans navigateur.
            </p>

            <a
              href="https://github.com/TanguyTagne/prescr-ia-assist/releases/latest/download/Asclion-Setup.exe"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full sm:w-auto h-12 text-base font-semibold pharmacy-gradient border-0 gap-2">
                <Monitor className="h-5 w-5" />
                Télécharger Asclion pour Windows
              </Button>
            </a>

            <div className="rounded-lg bg-secondary p-4 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Note : Windows SmartScreen
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                L'installeur n'est pas encore signé. Au lancement, cliquez sur <strong>« Plus d'informations »</strong> puis <strong>« Exécuter quand même »</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="pt-6 border-t border-border/50">
          <Button
            variant="outline"
            size="lg"
            onClick={signOut}
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <LogOut className="h-5 w-5" />
            Se déconnecter
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
