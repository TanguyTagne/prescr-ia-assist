import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at: string;
}

const SecurityTab = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error("Impossible de charger les facteurs MFA");
    } else {
      setFactors((data?.all as Factor[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Admin TOTP ${new Date().toLocaleDateString("fr-FR")}`,
      });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (e: any) {
      toast.error(e.message || "Échec de l'inscription 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollData || !code) return;
    setVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      toast.success("2FA activé avec succès");
      setEnrollData(null);
      setCode("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Code invalide");
    } finally {
      setVerifying(false);
    }
  };

  const cancelEnroll = async () => {
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    }
    setEnrollData(null);
    setCode("");
    await load();
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm("Supprimer ce facteur 2FA ? Vous devrez le reconfigurer.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Facteur 2FA supprimé");
      await load();
    }
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasVerified = verifiedFactors.length > 0;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          {hasVerified ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600 mt-0.5" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-amber-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-base">Authentification à deux facteurs (2FA)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasVerified
                ? "Votre compte admin est protégé par une application d'authentification (TOTP)."
                : "Ajoutez une couche de sécurité supplémentaire avec une application comme Google Authenticator, 1Password ou Authy."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {verifiedFactors.length > 0 && (
              <div className="space-y-2 mb-4">
                {verifiedFactors.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                    <div className="text-sm">
                      <div className="font-medium">{f.friendly_name || "TOTP"}</div>
                      <div className="text-xs text-muted-foreground">
                        Activé le {new Date(f.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFactor(f.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!enrollData && (
              <Button onClick={startEnroll} disabled={enrolling} size="sm">
                {enrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {hasVerified ? "Ajouter un autre appareil" : "Activer la 2FA"}
              </Button>
            )}

            {enrollData && (
              <div className="mt-4 space-y-4 p-4 rounded-md border bg-muted/20">
                <div>
                  <p className="text-sm font-medium mb-2">1. Scannez ce QR code avec votre application</p>
                  <div className="bg-white p-3 rounded-md inline-block">
                    <img src={enrollData.qr} alt="QR code 2FA" className="w-44 h-44" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Ou saisissez ce code manuellement :{" "}
                    <code className="font-mono bg-background px-1.5 py-0.5 rounded">{enrollData.secret}</code>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">2. Entrez le code à 6 chiffres affiché</p>
                  <div className="flex gap-2">
                    <Input
                      aria-label="Code 2FA"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      inputMode="numeric"
                      maxLength={6}
                      className="font-mono w-32"
                    />
                    <Button onClick={verifyEnroll} disabled={verifying || code.length !== 6} size="sm">
                      {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Vérifier
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEnroll}>
                      Annuler
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default SecurityTab;
