import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Building2, BarChart3, RefreshCw, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RequestsTab from "@/components/admin/RequestsTab";
import PharmaciesTab from "@/components/admin/PharmaciesTab";
import PharmacyKPIs from "@/components/admin/PharmacyKPIs";

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
  lgo_config?: {
    id: string;
    lgo_type: string;
    api_base_url: string;
    api_key_encrypted: string | null;
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
  const [tab, setTab] = useState<"requests" | "pharmacies" | "kpis">("kpis");

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
        const { data: lgoConfigs } = await supabase.from("pharmacy_lgo_config" as any).select("*");
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
          <Button variant="ghost" size="icon" onClick={loadData} className="h-8 w-8 ml-auto">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant={tab === "kpis" ? "default" : "outline"} size="sm" onClick={() => setTab("kpis")} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            KPIs
          </Button>
          <Button variant={tab === "requests" ? "default" : "outline"} size="sm" onClick={() => setTab("requests")} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Demandes ({requests.filter(r => r.status === "pending").length})
          </Button>
          <Button variant={tab === "pharmacies" ? "default" : "outline"} size="sm" onClick={() => setTab("pharmacies")} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Pharmacies ({pharmacies.length})
          </Button>
        </div>

        {tab === "kpis" && <PharmacyKPIs />}
        {tab === "requests" && <RequestsTab requests={requests} onRefresh={loadData} />}
        {tab === "pharmacies" && <PharmaciesTab pharmacies={pharmacies} onRefresh={loadData} />}
      </div>
    </div>
  );
};

export default Admin;
