import { useState, useEffect } from "react";
import { Pill, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    // Also check current session + hash params
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.get("type") === "recovery") {
        setIsValidSession(true);
        setChecking(false);
        return;
      }
      // Give Supabase time to process the token from the URL
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      }
      setChecking(false);
    };

    // Small delay to let onAuthStateChange fire first
    setTimeout(checkSession, 1000);

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès !");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Pill className="h-10 w-10 mx-auto text-primary" />
          <h2 className="text-xl font-bold">Lien invalide ou expiré</h2>
          <p className="text-muted-foreground text-sm">Demandez un nouveau lien de réinitialisation.</p>
          <Button onClick={() => navigate("/auth")} variant="outline">
            Retour à la connexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-md mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground tracking-tight">Asclion</h1>
            <p className="text-xs text-primary-foreground/70">Réinitialisation du mot de passe</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Nouveau mot de passe</h2>
            <p className="text-muted-foreground text-sm">Choisissez un nouveau mot de passe sécurisé</p>
          </div>

          <form onSubmit={handleReset} className="glass-card rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nouveau mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-12"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-12"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold pharmacy-gradient border-0" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Mettre à jour"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
