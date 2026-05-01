import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, QrCode, Plus, Loader2, Trash2, ExternalLink, Power } from "lucide-react";
import QRCode from "qrcode";

const SITE_BASE = "https://www.asclion.com";

interface TrackingLink {
  id: string;
  slug: string;
  label: string;
  destination: string;
  campaign: string | null;
  is_active: boolean;
  clicks_count: number;
  unique_clicks_count: number;
  demos_count: number;
  leads_count: number;
  created_at: string;
}

const generateSlug = (length = 6): string => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const TrackingLinksTab = () => {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState("/");
  const [campaign, setCampaign] = useState("");
  const [qrLink, setQrLink] = useState<TrackingLink | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tracking_links" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erreur de chargement");
    setLinks((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!label.trim()) {
      toast.error("Libellé requis");
      return;
    }
    setCreating(true);
    try {
      let slug = generateSlug();
      // Retry up to 3 times on collision
      for (let i = 0; i < 3; i++) {
        const { data: exists } = await supabase
          .from("tracking_links" as any)
          .select("id").eq("slug", slug).maybeSingle();
        if (!exists) break;
        slug = generateSlug();
      }
      const { error } = await supabase.from("tracking_links" as any).insert({
        slug,
        label: label.trim(),
        destination: destination.trim() || "/",
        campaign: campaign.trim() || null,
      });
      if (error) throw error;
      toast.success(`Lien créé : ${SITE_BASE}/?r=${slug}`);
      setLabel(""); setDestination("/"); setCampaign("");
      setOpenCreate(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${SITE_BASE}/?r=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  };

  const toggleActive = async (link: TrackingLink) => {
    await supabase.from("tracking_links" as any)
      .update({ is_active: !link.is_active }).eq("id", link.id);
    load();
  };

  const deleteLink = async (link: TrackingLink) => {
    if (!confirm(`Supprimer le lien "${link.label}" ?`)) return;
    await supabase.from("tracking_links" as any).delete().eq("id", link.id);
    toast.success("Lien supprimé");
    load();
  };

  const showQr = async (link: TrackingLink) => {
    const url = `${SITE_BASE}/?r=${link.slug}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
    setQrDataUrl(dataUrl);
    setQrLink(link);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Liens trackables</h2>
          <p className="text-xs text-muted-foreground">Créez un lien personnalisé par destinataire et suivez clics, démos et leads.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Nouveau lien</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un lien trackable</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="label" className="text-xs">Libellé (destinataire)</Label>
                <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Jean Dupont - Pharmacie du Rhône" maxLength={150} />
              </div>
              <div>
                <Label htmlFor="dest" className="text-xs">Destination</Label>
                <Input id="dest" value={destination} onChange={(e) => setDestination(e.target.value)}
                  placeholder="/" maxLength={200} />
                <p className="text-[10px] text-muted-foreground mt-1">Page d'arrivée : / (accueil), /vs-lgo, /aide…</p>
              </div>
              <div>
                <Label htmlFor="camp" className="text-xs">Campagne (optionnel)</Label>
                <Input id="camp" value={campaign} onChange={(e) => setCampaign(e.target.value)}
                  placeholder="Ex: emailing-novembre" maxLength={100} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
          Aucun lien créé pour l'instant.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-2 py-2">Libellé</th>
                <th className="px-2 py-2">Lien</th>
                <th className="px-2 py-2 text-center">Clics</th>
                <th className="px-2 py-2 text-center">Uniques</th>
                <th className="px-2 py-2 text-center">Démos</th>
                <th className="px-2 py-2 text-center">Leads</th>
                <th className="px-2 py-2 text-center">Conv.</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const conv = l.unique_clicks_count > 0
                  ? Math.round((l.leads_count / l.unique_clicks_count) * 100) : 0;
                return (
                  <tr key={l.id} className={`border-t ${!l.is_active ? "opacity-50" : ""}`}>
                    <td className="px-2 py-2">
                      <div className="font-medium">{l.label}</div>
                      {l.campaign && <Badge variant="outline" className="mt-0.5 text-[9px]">{l.campaign}</Badge>}
                    </td>
                    <td className="px-2 py-2 font-mono">/?r={l.slug}</td>
                    <td className="px-2 py-2 text-center">{l.clicks_count}</td>
                    <td className="px-2 py-2 text-center">{l.unique_clicks_count}</td>
                    <td className="px-2 py-2 text-center">{l.demos_count}</td>
                    <td className="px-2 py-2 text-center font-semibold">{l.leads_count}</td>
                    <td className="px-2 py-2 text-center">{conv}%</td>
                    <td className="px-2 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(l.slug)} title="Copier">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => showQr(l)} title="QR Code">
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => window.open(`${SITE_BASE}/?r=${l.slug}`, "_blank")} title="Ouvrir">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(l)} title={l.is_active ? "Désactiver" : "Activer"}>
                          <Power className={`h-3.5 w-3.5 ${l.is_active ? "text-green-600" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLink(l)} title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!qrLink} onOpenChange={(o) => !o && setQrLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Code – {qrLink?.label}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrDataUrl && <img src={qrDataUrl} alt="QR code" className="border rounded" />}
            <code className="text-xs bg-muted px-2 py-1 rounded">{SITE_BASE}/?r={qrLink?.slug}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => qrLink && copyLink(qrLink.slug)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Copier le lien
              </Button>
              <a href={qrDataUrl} download={`asclion-qr-${qrLink?.slug}.png`}>
                <Button size="sm">Télécharger PNG</Button>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrackingLinksTab;
