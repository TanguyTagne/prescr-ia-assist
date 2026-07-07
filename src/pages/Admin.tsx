import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Building2, BarChart3, RefreshCw, ShieldCheck, Target, Trophy, Sparkles, UserPlus, Network, FileSearch, Shield, FileText, Gauge, Link2, Flag, Sparkle, CheckCircle2, LineChart, ScanLine, PackageSearch } from "lucide-react";
import AdminEmail2FAGate from "@/components/AdminEmail2FAGate";
import InvestorKpisTab from "@/components/admin/InvestorKpisTab";
import { useNavigate } from "react-router-dom";
import RequestsTab from "@/components/admin/RequestsTab";
import PharmaciesTab from "@/components/admin/PharmaciesTab";
import PharmacyKPIs from "@/components/admin/PharmacyKPIs";
import CoverageTab from "@/components/admin/CoverageTab";
import RecommendationMetrics from "@/components/admin/RecommendationMetrics";
import BenchmarkTab from "@/components/admin/BenchmarkTab";
import DemoSessionsTab from "@/components/admin/DemoSessionsTab";
import DemoLeadsTab from "@/components/admin/DemoLeadsTab";
import GroupementsTab from "@/components/admin/GroupementsTab";
import TracabiliteTab from "@/components/admin/TracabiliteTab";
import ConformiteTab from "@/components/admin/ConformiteTab";
import RgpdTab from "@/components/admin/RgpdTab";
import QuotasTab from "@/components/admin/QuotasTab";
import TrackingLinksTab from "@/components/admin/TrackingLinksTab";
import SignalementsTab from "@/components/admin/SignalementsTab";
import AuditPcTab from "@/components/admin/AuditPcTab";
import AsclionBaseImportTab from "@/components/admin/AsclionBaseImportTab";
import AcceptedPcsTab from "@/components/admin/AcceptedPcsTab";
import RemoteScannerDiagnosticTab from "@/components/admin/RemoteScannerDiagnosticTab";
import MedicamentsManquantsTab from "@/components/admin/MedicamentsManquantsTab";
import RoiManqueAGagnerTab from "@/components/admin/RoiManqueAGagnerTab";


interface AccessRequest {
  id: string;
  pharmacy_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  lgo_type: string | null;
  status: string;
  created_at: string;
}

interface PharmacyWithLGO {
  id: string;
  name: string;
  city: string | null;
  status?: string;
  lgo_config?: {
    id: string;
    lgo_type: string;
    api_base_url: string;
    api_key: string | null;
    enabled: boolean;
    last_sync_at: string | null;
  } | null;
}

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyWithLGO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "pharmacies" | "kpis" | "investor" | "coverage" | "perf" | "benchmark" | "demo-sessions" | "demo-leads" | "tracking-links" | "groupements" | "tracabilite" | "conformite" | "rgpd" | "quotas" | "signalements" | "audit-pc" | "accepted-pcs" | "remote-diag" | "medicaments-manquants" | "asclion-base" | "roi-manque-a-gagner" | "security">("kpis");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, pharmRes] = await Promise.all([
        supabase.from("access_requests" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("pharmacies").select("*").order("created_at", { ascending: false }),
      ]);

      setRequests((reqRes.data as any[]) || []);

      const pharmaList = (pharmRes.data || []) as PharmacyWithLGO[];
      if (pharmaList.length > 0) {
        const { data: lgoConfigs } = await supabase.from("pharmacy_lgo_config" as any).select("id, pharmacy_id, lgo_type, api_base_url, enabled, created_at, updated_at");
        for (const p of pharmaList) {
          p.lgo_config = (lgoConfigs as any[])?.find((c: any) => c.pharmacy_id === p.id) || null;
        }
      }
      setPharmacies(pharmaList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Administration</h1>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" onClick={loadData} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant={tab === "kpis" ? "default" : "outline"} size="sm" onClick={() => setTab("kpis")} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            KPIs
          </Button>
          <Button variant={tab === "investor" ? "default" : "outline"} size="sm" onClick={() => setTab("investor")} className="gap-1.5">
            <LineChart className="h-3.5 w-3.5" />
            Investisseurs
          </Button>
          <Button variant={tab === "signalements" ? "default" : "outline"} size="sm" onClick={() => setTab("signalements")} className="gap-1.5">
            <Flag className="h-3.5 w-3.5" />
            Signalements
          </Button>
          <Button variant={tab === "demo-leads" ? "default" : "outline"} size="sm" onClick={() => setTab("demo-leads")} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Leads démo
          </Button>
          <Button variant={tab === "demo-sessions" ? "default" : "outline"} size="sm" onClick={() => setTab("demo-sessions")} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Sessions démo
          </Button>
          <Button variant={tab === "tracking-links" ? "default" : "outline"} size="sm" onClick={() => setTab("tracking-links")} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Liens trackables
          </Button>
          <Button variant={tab === "requests" ? "default" : "outline"} size="sm" onClick={() => setTab("requests")} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Demandes ({requests.filter(r => r.status === "pending").length})
          </Button>
          <Button variant={tab === "pharmacies" ? "default" : "outline"} size="sm" onClick={() => setTab("pharmacies")} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Pharmacies ({pharmacies.length})
          </Button>
          <Button variant={tab === "coverage" ? "default" : "outline"} size="sm" onClick={() => setTab("coverage")} className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Couverture
          </Button>
          <Button variant={tab === "audit-pc" ? "default" : "outline"} size="sm" onClick={() => setTab("audit-pc")} className="gap-1.5">
            <Sparkle className="h-3.5 w-3.5" />
            Audit PC
          </Button>
          <Button variant={tab === "perf" ? "default" : "outline"} size="sm" onClick={() => setTab("perf")} className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Perf. PC
          </Button>
          <Button variant={tab === "benchmark" ? "default" : "outline"} size="sm" onClick={() => setTab("benchmark")} className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Benchmark
          </Button>
          <Button variant={tab === "groupements" ? "default" : "outline"} size="sm" onClick={() => setTab("groupements")} className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            Groupements
          </Button>
          <Button variant={tab === "tracabilite" ? "default" : "outline"} size="sm" onClick={() => setTab("tracabilite")} className="gap-1.5">
            <FileSearch className="h-3.5 w-3.5" />
            Traçabilité
          </Button>
          <Button variant={tab === "conformite" ? "default" : "outline"} size="sm" onClick={() => setTab("conformite")} className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Conformité
          </Button>
          <Button variant={tab === "rgpd" ? "default" : "outline"} size="sm" onClick={() => setTab("rgpd")} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            RGPD
          </Button>
          <Button variant={tab === "quotas" ? "default" : "outline"} size="sm" onClick={() => setTab("quotas")} className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Quotas
          </Button>
          <Button variant={tab === "accepted-pcs" ? "default" : "outline"} size="sm" onClick={() => setTab("accepted-pcs")} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            PC acceptés
          </Button>
          <Button variant={tab === "remote-diag" ? "default" : "outline"} size="sm" onClick={() => setTab("remote-diag")} className="gap-1.5">
            <ScanLine className="h-3.5 w-3.5" />
            Diag distants (par pharmacie)
          </Button>
          <Button variant={tab === "medicaments-manquants" ? "default" : "outline"} size="sm" onClick={() => setTab("medicaments-manquants")} className="gap-1.5">
            <PackageSearch className="h-3.5 w-3.5" />
            Médicaments manquants
          </Button>
          <Button variant={tab === "asclion-base" ? "default" : "outline"} size="sm" onClick={() => setTab("asclion-base")} className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
            <PackageSearch className="h-3.5 w-3.5" />
            Import base Asclion (2 PCs)
          </Button>
          <Button variant={tab === "roi-manque-a-gagner" ? "default" : "outline"} size="sm" onClick={() => setTab("roi-manque-a-gagner")} className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 data-[variant=default]:bg-emerald-600">
            <Trophy className="h-3.5 w-3.5" />
            ROI & Manque à gagner
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/groupement")} className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            Ouvrir dashboard groupement →
          </Button>
        </div>

        {tab === "kpis" && <PharmacyKPIs />}
        {tab === "investor" && <InvestorKpisTab />}
        {tab === "demo-leads" && <DemoLeadsTab />}
        {tab === "demo-sessions" && <DemoSessionsTab />}
        {tab === "tracking-links" && <TrackingLinksTab />}
        {tab === "requests" && <RequestsTab requests={requests} onRefresh={loadData} />}
        {tab === "pharmacies" && <PharmaciesTab pharmacies={pharmacies} onRefresh={loadData} />}
        {tab === "coverage" && <CoverageTab />}
        {tab === "perf" && <RecommendationMetrics />}
        {tab === "benchmark" && <BenchmarkTab />}
        {tab === "groupements" && <GroupementsTab />}
        {tab === "tracabilite" && <TracabiliteTab />}
        {tab === "conformite" && <ConformiteTab />}
        {tab === "rgpd" && <RgpdTab />}
        {tab === "quotas" && <QuotasTab />}
        {tab === "signalements" && <SignalementsTab />}
        {tab === "audit-pc" && <AuditPcTab />}
        {tab === "accepted-pcs" && <AcceptedPcsTab />}
        {tab === "remote-diag" && <RemoteScannerDiagnosticTab />}
        {tab === "medicaments-manquants" && <MedicamentsManquantsTab />}
        {tab === "asclion-base" && <AsclionBaseImportTab />}
        {tab === "roi-manque-a-gagner" && <RoiManqueAGagnerTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
};

export default Admin;
