import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

const AdminEmail2FAGate = ({ children }: Props) => {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const checkVerified = async () => {
    setChecking(true);
    const { data, error } = await supabase.rpc("is_admin_2fa_verified");
    if (error) {
      console.error(error);
      setVerified(false);
    } else {
      setVerified(Boolean(data));
    }
    setChecking(false);
  };

  useEffect(() => {
    checkVerified();
  }, []);

  const maskEmail = (e: string) => {
    const [name, domain] = e.split("@");
    if (!domain) return e;
    const shown = name.slice(0, 2);
    return `${shown}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
  };

  const sendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-admin-2fa-code", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCodeSent(true);
      setMaskedEmail(data?.email ? maskEmail(data.email) : null);
      toast.success("Code envoyé par email");
    } catch (e: any) {
      toast.error(e.message || "Échec envoi du code");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-admin-2fa-code", { body: { code } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("2FA validée");
      setVerified(true);
    } catch (e: any) {
      toast.error(e.message || "Code incorrect");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verified) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 space-y-6 shadow-sm">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Vérification à deux facteurs</h1>
          <p className="text-sm text-muted-foreground">
            L'accès administrateur est protégé par un code à usage unique envoyé par email.
          </p>
        </div>

        {!codeSent ? (
          <Button onClick={sendCode} disabled={sending} className="w-full gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Recevoir le code par email
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-center text-muted-foreground">
              Code envoyé{maskedEmail ? ` à ${maskedEmail}` : ""}. Il expire dans 10 minutes.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={verifyCode} disabled={code.length !== 6 || verifying} className="w-full">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground underline"
              onClick={sendCode}
              disabled={sending}
            >
              Renvoyer un nouveau code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEmail2FAGate;
