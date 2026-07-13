import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Eye, Send } from "lucide-react";

interface Pharmacy { id: string; name: string; status: string | null }

function prevMonthISO(): string {
  const d = new Date();
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return m.toISOString().slice(0, 10);
}

export default function MonthlyRecapTab() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [month, setMonth] = useState<string>(prevMonthISO());
  const [loading, setLoading] = useState<null | "preview" | "dry" | "send" | "sendAll">(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [dryResults, setDryResults] = useState<any[] | null>(null);

  useEffect(() => {
    supabase.from("pharmacies").select("id, name, status").order("name").then(({ data }) => {
      setPharmacies((data ?? []) as Pharmacy[]);
      if (data && data.length > 0) setSelected((data[0] as any).id);
    });
  }, []);

  const monthLabel = useMemo(() => {
    const d = new Date(month);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [month]);

  async function call(payload: any) {
    const { data, error } = await supabase.functions.invoke("send-monthly-recap", { body: payload });
    if (error) throw error;
    return data;
  }

  async function handlePreview() {
    if (!selected) return;
    setLoading("preview"); setPreviewHtml(null);
    try {
      const res = await call({ pharmacy_id: selected, month, preview: true });
      setPreviewHtml(res.html);
      setPreviewSubject(res.subject);
      toast.success("Aperçu généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally { setLoading(null); }
  }

  async function handleDryRun() {
    setLoading("dry"); setDryResults(null);
    try {
      const res = await call({ month, dry_run: true });
      setDryResults(res.results ?? []);
      toast.success(`${res.processed} pharmacies analysées`);
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setLoading(null); }
  }

  async function handleSendOne() {
    if (!selected) return;
    if (!confirm(`Envoyer le récap ${monthLabel} à cette pharmacie ?`)) return;
    setLoading("send");
    try {
      const res = await call({ pharmacy_id: selected, month });
      const r = res.results?.[0];
      if (r?.sent_to) toast.success(`Envoyé à ${r.sent_to.join(", ")}`);
      else if (r?.skipped) toast.info(`Ignoré : ${r.skipped}`);
      else if (r?.error) toast.error(r.error);
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setLoading(null); }
  }

  async function handleSendAll() {
    if (!confirm(`Envoyer le récap ${monthLabel} à TOUTES les pharmacies actives ? Cette action envoie des vrais emails.`)) return;
    setLoading("sendAll");
    try {
      const res = await call({ month });
      const sent = (res.results ?? []).filter((r: any) => r.sent_to).length;
      const skipped = (res.results ?? []).filter((r: any) => r.skipped).length;
      const errored = (res.results ?? []).filter((r: any) => r.error).length;
      toast.success(`Terminé : ${sent} envoyés, ${skipped} ignorés, ${errored} erreurs`);
      setDryResults(res.results ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><Mail className="w-5 h-5" /> Récap mensuel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Email mensuel automatique envoyé à chaque pharmacie : CA estimé, best-sellers, analyses. Cron auto le 1er du mois à 8h.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Mois</Label>
            <Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
          </div>
          <div className="md:col-span-2">
            <Label>Pharmacie (aperçu / envoi unitaire)</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {pharmacies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} {p.status && p.status !== "active" ? `(${p.status})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={!!loading || !selected}>
            {loading === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Aperçu HTML
          </Button>
          <Button variant="outline" size="sm" onClick={handleDryRun} disabled={!!loading}>
            {loading === "dry" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Simulation (dry-run, sans envoi)
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSendOne} disabled={!!loading || !selected}>
            {loading === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer à cette pharmacie
          </Button>
          <Button size="sm" onClick={handleSendAll} disabled={!!loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading === "sendAll" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer à toutes
          </Button>
        </div>
      </Card>

      {previewHtml && (
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-2">Objet : <span className="font-medium text-foreground">{previewSubject}</span></div>
          <iframe title="preview" srcDoc={previewHtml} className="w-full border rounded bg-white" style={{ height: 700 }} />
        </Card>
      )}

      {dryResults && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Résultats ({dryResults.length})</h3>
          <div className="max-h-96 overflow-auto text-xs font-mono space-y-1">
            {dryResults.map((r, i) => (
              <div key={i} className="p-2 border-b">
                <span className="font-semibold">{r.name ?? r.pharmacy_id.slice(0, 8)}</span>{" "}
                {r.stats && <span className="text-muted-foreground">— {r.stats.analyses} analyses · {r.stats.pcAcceptes} PC · CA ~{r.stats.caEstime}€</span>}
                {r.sent_to && <span className="text-emerald-600">→ envoyé à {r.sent_to.join(", ")}</span>}
                {r.skipped && <span className="text-amber-600">→ ignoré ({r.skipped})</span>}
                {r.error && <span className="text-red-600">→ {r.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
