import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ExternalLink, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const GroupementsTab = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const load = async () => {
    const [g, p, pr] = await Promise.all([
      supabase.from("groupements" as any).select("*").order("name"),
      supabase.from("pharmacies").select("id, name, groupement_id").order("name"),
      supabase.from("profiles").select("id, email, full_name, managed_groupement_id").order("email"),
    ]);
    setGroups((g.data as any[]) || []);
    setPharmacies((p.data as any[]) || []);
    setProfiles((pr.data as any[]) || []);
  };

  useEffect(() => { load(); }, []);

  const createGroup = async () => {
    if (!name || !slug) return toast.error("Nom et slug requis");
    const { error } = await supabase.from("groupements" as any).insert({ name, slug });
    if (error) return toast.error(error.message);
    toast.success("Groupement créé");
    setName(""); setSlug("");
    load();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Supprimer ce groupement ?")) return;
    await supabase.from("groupements" as any).delete().eq("id", id);
    load();
  };

  const assignPharmacy = async (pharmacyId: string, groupementId: string | null) => {
    await supabase.from("pharmacies").update({ groupement_id: groupementId } as any).eq("id", pharmacyId);
    load();
  };

  const assignManager = async (profileId: string, groupementId: string | null) => {
    await supabase.from("profiles").update({ managed_groupement_id: groupementId } as any).eq("id", profileId);
    if (groupementId) {
      await supabase.from("user_roles" as any).upsert({ user_id: profileId, role: "group_manager" }, { onConflict: "user_id,role" });
    }
    toast.success("Gérant assigné");
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Créer un groupement</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nom (ex: Giphar)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="slug (ex: giphar)" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          <Button onClick={createGroup} className="gap-1.5"><Plus className="h-3 w-3" />Créer</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Groupements ({groups.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Slug</TableHead><TableHead className="text-right">Pharmacies</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground">{g.slug}</TableCell>
                  <TableCell className="text-right">{pharmacies.filter((p) => p.groupement_id === g.id).length}</TableCell>
                  <TableCell className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => navigate(`/groupement?groupement_id=${g.id}`)} className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteGroup(g.id)} className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {groups.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Aucun groupement</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Rattacher pharmacies à un groupement</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead className="w-64">Groupement</TableHead></TableRow></TableHeader>
            <TableBody>
              {pharmacies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <Select value={p.groupement_id || "none"} onValueChange={(v) => assignPharmacy(p.id, v === "none" ? null : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucun —</SelectItem>
                        {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" />Désigner un gérant de groupement</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead className="w-64">Groupement géré</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.full_name || p.email}</TableCell>
                  <TableCell>
                    <Select value={p.managed_groupement_id || "none"} onValueChange={(v) => assignManager(p.id, v === "none" ? null : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucun —</SelectItem>
                        {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupementsTab;
