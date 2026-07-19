import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RegisterProvider } from "@/hooks/useRegister";
import { I18nProvider } from "@/i18n/I18nProvider";
import { Loader2 } from "lucide-react";
import CookieBanner from "@/components/CookieBanner";
import LgoAutoDetectPrompt from "@/components/LgoAutoDetectPrompt";
import WidgetDemoTour from "@/components/WidgetDemoTour";
import { isAsclionDesktopRuntime } from "@/lib/runtime";
import { useInstanceHeartbeat } from "@/hooks/useInstanceHeartbeat";
import { PharmacyAccessGuard } from "@/components/PharmacyAccessGuard";
import { useGlobalBarcodeBridge } from "@/hooks/useGlobalBarcodeBridge";
import { purgeClientCaches } from "@/lib/versionCheck";

// Retry dynamic import on failure (handles stale Vite chunks / transient network).
// On second failure, force a hard reload to fetch the latest asset manifest.
const lazyWithRetry = <T extends ComponentType<never>>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch(async (err: unknown) => {
      console.warn("Dynamic import failed, retrying...", err);
      await new Promise((r) => setTimeout(r, 500));
      return factory().catch(async (err2: unknown) => {
        console.error("Dynamic import failed twice, purging caches and reloading...", err2);
        const key = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(key, String(Date.now()));
          await purgeClientCaches();
          const url = new URL(window.location.href);
          url.searchParams.set("__asclion_reload", String(Date.now()));
          window.location.replace(url.toString());
        }
        throw err2;
      });
    })
  );

const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Quiz = lazyWithRetry(() => import("./pages/Quiz"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const VsLgo = lazyWithRetry(() => import("./pages/VsLgo"));
const Aide = lazyWithRetry(() => import("./pages/Aide"));
const Fonctionnalites = lazyWithRetry(() => import("./pages/Fonctionnalites"));
const Blog = lazyWithRetry(() => import("./pages/Blog"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));

const Widget = lazyWithRetry(() => import("./components/Widget"));
const SiteDemoWidget = lazyWithRetry(() => import("./components/SiteDemoWidget"));
const MentionsLegales = lazyWithRetry(() => import("./pages/legal/MentionsLegales"));
const Confidentialite = lazyWithRetry(() => import("./pages/legal/Confidentialite"));
const CookiesPage = lazyWithRetry(() => import("./pages/legal/Cookies"));
const CGU = lazyWithRetry(() => import("./pages/legal/CGU"));
const Groupement = lazyWithRetry(() => import("./pages/Groupement"));
const DPA = lazyWithRetry(() => import("./pages/legal/DPA"));
const PIA = lazyWithRetry(() => import("./pages/legal/PIA"));

const queryClient = new QueryClient();

const isStandalone = isAsclionDesktopRuntime();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const GroupRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin, isGroupManager } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user || (!isAdmin && !isGroupManager)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const DeferredWidget = ({ forceOpen, mountImmediately, demo = false }: { forceOpen?: boolean; mountImmediately?: boolean; demo?: boolean }) => {
  const [shouldMount, setShouldMount] = useState(!!forceOpen || !!mountImmediately);

  useEffect(() => {
    if (shouldMount) return;
    let mounted = true;
    const trigger = () => mounted && setShouldMount(true);

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const ric = idleWindow.requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const idleId = ric
      ? ric(trigger, { timeout: 3500 })
      : window.setTimeout(trigger, 2500);

    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, trigger, { once: true, passive: true }));

    return () => {
      mounted = false;
      if (ric && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as number);
      }
      events.forEach((e) => window.removeEventListener(e, trigger));
    };
  }, [shouldMount]);

  if (!shouldMount) return null;
  return (
    <WidgetErrorBoundary>
      {demo ? <SiteDemoWidget /> : <Widget forceOpen={forceOpen} />}
    </WidgetErrorBoundary>
  );
};

class WidgetErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message?: string }> {
  state: { hasError: boolean; message?: string } = { hasError: false };
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }
  componentDidCatch(error: unknown) {
    console.error("Widget failed to load:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center gap-3">
          <div className="text-sm font-semibold">Asclion n'a pas pu démarrer</div>
          <div className="text-xs text-muted-foreground max-w-[260px] break-words">{this.state.message || "Erreur inconnue"}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const VisitorTour = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Only on the public landing page, for non-authenticated visitors
  const enabled = !loading && !user && location.pathname === "/";
  return <WidgetDemoTour enabled={enabled} />;
};

const InstanceHeartbeatMount = () => {
  useInstanceHeartbeat();
  return null;
};

const GlobalBarcodeBridgeMount = () => {
  useGlobalBarcodeBridge();
  return null;
};

const SiteDemoLayer = () => {
  const location = useLocation();
  if (location.pathname !== "/" && location.pathname !== "/en") return null;
  return <DeferredWidget demo mountImmediately />;
};


const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <PharmacyAccessGuard>
          <InstanceHeartbeatMount />
          <RegisterProvider>
          <I18nProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            {isStandalone ? (
              <>
                <GlobalBarcodeBridgeMount />
                <DeferredWidget forceOpen mountImmediately />
                <LgoAutoDetectPrompt />
              </>
            ) : (
              <>
                <Routes>
                  {/* FR (default) */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/vs-lgo" element={<VsLgo />} />
                  <Route path="/aide" element={<Aide />} />
                  <Route path="/fonctionnalites" element={<ProtectedRoute><Fonctionnalites /></ProtectedRoute>} />
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="/groupement" element={<GroupRoute><Groupement /></GroupRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                  
                  <Route path="/mentions-legales" element={<MentionsLegales />} />
                  <Route path="/confidentialite" element={<Confidentialite />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  <Route path="/cgu" element={<CGU />} />
                  <Route path="/legal/dpa" element={<DPA />} />
                  <Route path="/legal/pia" element={<PIA />} />
                  {/* EN mirror */}
                  <Route path="/en" element={<Landing />} />
                  <Route path="/en/auth" element={<Auth />} />
                  <Route path="/en/reset-password" element={<ResetPassword />} />
                  <Route path="/en/vs-lgo" element={<VsLgo />} />
                  <Route path="/en/aide" element={<Aide />} />
                  <Route path="/en/fonctionnalites" element={<ProtectedRoute><Fonctionnalites /></ProtectedRoute>} />
                  <Route path="/en/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="/en/groupement" element={<GroupRoute><Groupement /></GroupRoute>} />
                  <Route path="/en/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/en/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                  <Route path="/en/mentions-legales" element={<MentionsLegales />} />
                  <Route path="/en/confidentialite" element={<Confidentialite />} />
                  <Route path="/en/cookies" element={<CookiesPage />} />
                  <Route path="/en/cgu" element={<CGU />} />
                  <Route path="/en/legal/dpa" element={<DPA />} />
                  <Route path="/en/legal/pia" element={<PIA />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <SiteDemoLayer />
                <VisitorTour />
                {!isAsclionDesktopRuntime() && <CookieBanner />}
                <LgoAutoDetectPrompt />
              </>
            )}
          </Suspense>
          </I18nProvider>
          </RegisterProvider>
          </PharmacyAccessGuard>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
