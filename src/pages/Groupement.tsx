import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, BarChart3, Building2, TrendingUp, Loader2, AlertTriangle, Trophy, Download } from "lucide-react";
import { toast } from "sonner";
import MappingEditor from "@/components/groupement/MappingEditor";

type Tab = "kpis" | "mapping" | "insights";

const Groupement = () => {
  const { isAdmin, managedGroupementId, isGroupManager } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("kpis");
  const [groupements, setGroupements] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [labReport, setLabReport] = useState<any>(null);
  const [mapping, setMapping] = useState<any[]>([]);

  // Resolve which groupement to load
  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        const { data: groups } = await supabase.from("groupements" as any).select("*").order("name");
        setGroupements((groups as any[]) || []);
        const fromUrl = searchParams.get("groupement_id");
        const initialId = fromUrl || (groups?.[0] as any)?.id || null;
        setSelectedGroupId(initialId);
      } else if (isGroupManager && managedGroupementId) {
        setSelectedGroupId(managedGroupementId);
      }
      setLoading(false);
    };
    init();
  }, [isAdmin, isGroupManager, managedGroupementId]);

  const loadKpis = async (gid: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-kpis?groupement_id=${gid}`;
    const session = (await supabase.auth.getSession()).data.session;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (r.ok) setData(await r.json());
  };

  const loadInsights = async (gid: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-insights?groupement_id=${gid}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (r.ok) setInsights(await r.json());
  };

  const loadLabReport = async (gid: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-lab-reporting?groupement_id=${gid}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (r.ok) setLabReport(await r.json());
  };

  const loadMapping = async (gid: string) => {
    const { data } = await supabase
      .from("group_product_mapping" as any)
      .select("*")
      .eq("groupement_id", gid)
      .order("categorie");
    setMapping((data as any[]) || []);
  };

  useEffect(() => {
    if (!selectedGroupId) return;
    loadKpis(selectedGroupId);
    loadInsights(selectedGroupId);
    loadLabReport(selectedGroupId);
    loadMapping(selectedGroupId);
  }, [selectedGroupId]);

  const exportCsv = () => {
    if (!data?.pharmacies) return;
    const rows = [
      ["Pharmacie", "Ville", "Analyses 30j", "Conv. %", "Panier moyen"],
      ...data.pharmacies.map((p: any) => [p.name, p.city || "", p.analyses_30d, p.conversion_rate, p.avg_basket]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `groupement-kpis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const addMapping = async () => {
    if (!selectedGroupId) return;
    const { error } = await supabase.from("group_product_mapping" as any).insert({
      groupement_id: selectedGroupId,
      categorie: "Nouvelle catégorie",
      produit_prioritaire: "Nouveau produit",
      laboratoire_partenaire: "Labo",
      niveau_priorite: 90,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Ligne ajoutée");
      loadMapping(selectedGroupId);
    }
  };

  const updateMapping = async (id: string, field: string, value: any) => {
    await supabase.from("group_product_mapping" as any).update({ [field]: value }).eq("id", id);
  };

  const deleteMapping = async (id: string) => {
    await supabase.from("group_product_mapping" as any).delete().eq("id", id);
    if (selectedGroupId) loadMapping(selectedGroupId);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!selectedGroupId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Aucun groupement disponible.</p>
            {isAdmin && <p className="text-sm mt-2">Créez-en un depuis l'admin.</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate(isAdmin ? "/admin" : "/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Espace Groupement</h1>
          {isAdmin && groupements.length > 0 && (
            <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setSearchParams({ groupement_id: v }); }}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {groupements.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {data?.groupement && <Badge variant="secondary">{data.groupement.name}</Badge>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant={tab === "kpis" ? "default" : "outline"} size="sm" onClick={() => setTab("kpis")} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> KPIs réseau
          </Button>
          <Button variant={tab === "mapping" ? "default" : "outline"} size="sm" onClick={() => setTab("mapping")} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Mapping centralisé & Labos
          </Button>
          <Button variant={tab === "insights" ? "default" : "outline"} size="sm" onClick={() => setTab("insights")} className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Data & Insights
          </Button>
        </div>

        {tab === "kpis" && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Pharmacies actives</div><div className="text-2xl font-bold">{data.summary.pharmacies_active}/{data.summary.pharmacies_total}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Analyses 30j</div><div className="text-2xl font-bold">{data.summary.total_analyses}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Taux de conversion PC</div><div className="text-2xl font-bold">{data.summary.conversion_rate}%</div><div className="text-xs text-muted-foreground">National : {data.national_benchmark.conversion_rate}%</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Panier moyen</div><div className="text-2xl font-bold">{data.summary.avg_basket}</div></CardContent></Card>
            </div>

            {data.auto_alerts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" />Alertes ({data.auto_alerts.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.auto_alerts.slice(0, 5).map((a: any, i: number) => (
                    <div key={i} className="text-sm p-2 rounded border-l-2 border-orange-400 bg-orange-50 dark:bg-orange-950/20">{a.message}</div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" />Classement officines</CardTitle>
                <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="h-3 w-3" />Export CSV</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Pharmacie</TableHead><TableHead>Ville</TableHead><TableHead className="text-right">Analyses</TableHead><TableHead className="text-right">Conv.</TableHead><TableHead className="text-right">Panier</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.pharmacies.map((p: any, i: number) => (
                      <TableRow key={p.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.city}</TableCell>
                        <TableCell className="text-right">{p.analyses_30d}</TableCell>
                        <TableCell className="text-right">{p.conversion_rate}%</TableCell>
                        <TableCell className="text-right">{p.avg_basket}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {data.top_products.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Top produits recommandés</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Catégorie</TableHead><TableHead className="text-right">Proposés</TableHead><TableHead className="text-right">Acceptés</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.top_products.map((p: any, i: number) => (
                        <TableRow key={i}><TableCell className="font-medium">{p.name}</TableCell><TableCell>{p.categorie}</TableCell><TableCell className="text-right">{p.proposed}</TableCell><TableCell className="text-right">{p.accepted}</TableCell><TableCell className="text-right">{p.conversion}%</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "mapping" && (
          <div className="space-y-4">
            <MappingEditor groupementId={selectedGroupId} />

            {labReport && labReport.labs.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Reporting laboratoires partenaires (30j)</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Labo</TableHead><TableHead className="text-right">Recommandés</TableHead><TableHead className="text-right">Acceptés</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {labReport.labs.map((l: any, i: number) => (
                        <TableRow key={i}><TableCell className="font-medium">{l.laboratoire}</TableCell><TableCell className="text-right">{l.total_proposed}</TableCell><TableCell className="text-right">{l.total_accepted}</TableCell><TableCell className="text-right">{l.conversion_rate}%</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "insights" && insights && (
          <div className="space-y-4">
            {insights.epidemic_alerts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Alertes épidémiologiques</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {insights.epidemic_alerts.map((a: any, i: number) => (
                    <div key={i} className={`text-sm p-2 rounded border-l-2 ${a.severity === "high" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-orange-400 bg-orange-50 dark:bg-orange-950/20"}`}>
                      <span className="font-medium">{a.city}</span> — {a.message}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm">Tendances pathologies (30j vs 30j précédents)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Pathologie</TableHead><TableHead className="text-right">Cas 30j</TableHead><TableHead className="text-right">Évolution</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {insights.pathology_trends.map((p: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{p.pathologie}</TableCell>
                        <TableCell className="text-right">{p.count_30d}</TableCell>
                        <TableCell className="text-right">{p.change_pct === null ? "–" : <Badge variant={p.change_pct > 20 ? "destructive" : "secondary"}>{p.change_pct > 0 ? "+" : ""}{p.change_pct}%</Badge>}</TableCell>
                      </TableRow>
                    ))}
                    {insights.pathology_trends.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Pas encore de données.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {insights.case_studies.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Études de cas réseau</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {insights.case_studies.map((c: any, i: number) => (
                    <div key={i} className="p-3 rounded border">
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{c.metric}</div>
                      <div className="text-xs mt-1">{c.insight}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groupement;
