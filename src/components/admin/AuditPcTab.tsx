import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, PlayCircle, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Run {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  pcs_classified: number;
  links_created: number;
  links_rejected: number;
  orphans_filled: number;
  new_pcs_created: number;
  error: string | null;
}

const MODES = [
  { key: "classify", label: "1. Classer PC (finalité + ATC)" },
  { key: "revalidate", label: "2. Re-valider liens méd↔PC" },
  { key: "fill_orphans", label: "3. Combler médicaments orphelins" },
  { key: "all", label: "Tout enchaîner" },
];

export default function AuditPcTab() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: runsData }, { count: total }, { count: classified }, { count: validLinks }, { count: pcsTotal }] = await Promise.all([
      supabase.from("pc_audit_runs" as any).select("*").order("started_at", { ascending: false }).limit(10),
      supabase.from("medicaments").select("id", { count: "exact", head: true }),
      supabase.from("produits_complementaires").select("id", { count: "exact", head: true }).not("finalite", "is", null),
      supabase.from("medicament_pc_valide" as any).select("id", { count: "exact", head: true }),
      supabase.from("produits_complementaires").select("id", { count: "exact", head: true }),
    ]);
    setRuns((runsData as any) ?? []);
    setStats({ total_meds: total, pcs_classified: classified, pcs_total: pcsTotal, valid_links: validLinks });
  };

  useEffect(() => { load(); }, []);

  const launch = async (mode: string) => {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("audit-pc-purpose", { body: { mode, limit: 500 } });
      if (error) throw error;
      toast.success(`Audit lancé : ${JSON.stringify(data)}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Audit qualité des PC</h3>
        <p className="text-sm text-muted-foreground">
          Vérifie que chaque produit complémentaire rattaché à un médicament réduit un effet indésirable ou accompagne le traitement.
          Les liens incohérents sont retirés et les médicaments sans PC pertinent reçoivent de nouvelles propositions ciblées.
        </p>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Médicaments</div><div className="font-medium">{stats.total_meds}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">PC classés</div><div className="font-medium">{stats.pcs_classified} / {stats.pcs_total}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Liens validés</div><div className="font-medium">{stats.valid_links}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Dernier audit</div><div className="font-medium">{runs[0]?.started_at ? new Date(runs[0].started_at).toLocaleString("fr-FR") : "—"}</div></div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {MODES.map(m => (
            <Button key={m.key} size="sm" variant={m.key === "all" ? "default" : "outline"} disabled={!!busy} onClick={() => launch(m.key)}>
              {busy === m.key ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5 mr-1" />}
              {m.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Régénération phrases conseil</h3>
        <p className="text-sm text-muted-foreground">
          Régénère les phrases conseil au nouveau format ultra-court (3-7 mots, bénéfice patient).
          Opération longue : ~245 appels pour ~4 900 lignes.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={async () => {
            setBusy("phrases_test");
            try {
              const { data, error } = await supabase.functions.invoke("rewrite-phrases", { body: { offset: 0, batch_size: 20 } });
              if (error) throw error;
              toast.success(`Test OK : ${data.updated} phrases régénérées / ${data.fetched} testées`);
            } catch (e: any) {
              toast.error(e?.message ?? "Erreur");
            } finally {
              setBusy(null);
            }
          }} disabled={!!busy}>
            {busy === "phrases_test" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5 mr-1" />}
            Tester 20 lignes
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-2 text-sm">Historique</h4>
        <div className="space-y-1 text-xs">
          {runs.length === 0 && <div className="text-muted-foreground">Aucune exécution.</div>}
          {runs.map(r => (
            <div key={r.id} className="flex items-center justify-between border-b py-1.5">
              <div>
                <span className="font-medium">{new Date(r.started_at).toLocaleString("fr-FR")}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${r.status === "done" ? "bg-green-100 text-green-700" : r.status === "error" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status}</span>
              </div>
              <div className="text-muted-foreground">
                {r.pcs_classified} classés · {r.links_created} liens · {r.links_rejected} rejetés · {r.orphans_filled} orphelins · {r.new_pcs_created} nouveaux PC
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
