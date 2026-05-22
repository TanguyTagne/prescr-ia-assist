import { useState } from "react";
import { Loader2, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { useI18n } from "@/i18n/I18nProvider";

const Auth = () => {
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Veuillez entrer votre adresse email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Un email de réinitialisation vous a été envoyé.");
      setIsForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !accepted) {
      toast.error("Veuillez accepter les CGU et la politique de confidentialité.");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/admin");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Vérifiez votre email pour confirmer votre compte.");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo title={t("seo.auth.title")} description={t("seo.auth.desc")} path="/auth" />

      <header className="border-b border-border">
        <div className="container max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-semibold tracking-tight">Asclion</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <p className="mono-label">{isForgotPassword ? "Récupération" : isLogin ? "Connexion" : "Inscription"}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              {isForgotPassword ? "Mot de passe oublié" : isLogin ? "Connexion à votre espace" : "Créer un compte"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isForgotPassword
                ? "Entrez votre email pour recevoir un lien de réinitialisation."
                : isLogin
                  ? "Accédez à votre espace Asclion."
                  : "Quelques secondes suffisent."}
            </p>
          </div>

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 border-y border-border py-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom@pharmacie.fr"
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border-y border-border py-8">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nom complet</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Martin Dupont"
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom@pharmacie.fr"
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Mot de passe</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary hover:underline underline-offset-2"
                    >
                      Oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                  <span>
                    J'accepte les{" "}
                    <Link to="/cgu" className="text-primary underline underline-offset-2">CGU</Link> et la{" "}
                    <Link to="/confidentialite" className="text-primary underline underline-offset-2">politique de confidentialité</Link>.
                  </span>
                </label>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading || (!isLogin && !accepted)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Se connecter" : "Créer mon compte"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isForgotPassword ? (
              <button onClick={() => setIsForgotPassword(false)} className="text-primary font-medium hover:underline underline-offset-2">
                Retour à la connexion
              </button>
            ) : (
              <>
                {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
                <button onClick={() => setIsLogin(!isLogin)} className="ml-1 text-primary font-medium hover:underline underline-offset-2">
                  {isLogin ? "S'inscrire" : "Se connecter"}
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
