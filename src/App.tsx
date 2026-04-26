import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RegisterProvider } from "@/hooks/useRegister";
import { Loader2 } from "lucide-react";
import CookieBanner from "@/components/CookieBanner";
import LgoAutoDetectPrompt from "@/components/LgoAutoDetectPrompt";
import WidgetDemoTour from "@/components/WidgetDemoTour";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Quiz = lazy(() => import("./pages/Quiz"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VsLgo = lazy(() => import("./pages/VsLgo"));
const Aide = lazy(() => import("./pages/Aide"));
// Retry dynamic import once on failure (handles stale Vite chunks / transient network)
const lazyWithRetry = <T,>(factory: () => Promise<T>) =>
  lazy(() =>
    (factory() as Promise<any>).catch(async (err) => {
      console.warn("Dynamic import failed, retrying...", err);
      await new Promise((r) => setTimeout(r, 500));
      return factory();
    })
  );
const Widget = lazyWithRetry(() => import("./components/Widget"));
const MentionsLegales = lazy(() => import("./pages/legal/MentionsLegales"));
const Confidentialite = lazy(() => import("./pages/legal/Confidentialite"));
const CookiesPage = lazy(() => import("./pages/legal/Cookies"));
const CGU = lazy(() => import("./pages/legal/CGU"));

const queryClient = new QueryClient();

const isStandalone = window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as any).standalone === true
  || !!(window as any).electronAPI?.isDesktop
  || new URLSearchParams(window.location.search).get("desktop") === "1";

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

const DeferredWidget = ({ forceOpen, mountImmediately }: { forceOpen?: boolean; mountImmediately?: boolean }) => {
  const [shouldMount, setShouldMount] = useState(!!forceOpen || !!mountImmediately);

  useEffect(() => {
    if (shouldMount) return;
    let mounted = true;
    const trigger = () => mounted && setShouldMount(true);

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const idleId = ric
      ? ric(trigger, { timeout: 3500 })
      : window.setTimeout(trigger, 2500);

    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, trigger, { once: true, passive: true }));

    return () => {
      mounted = false;
      if (ric && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as number);
      }
      events.forEach((e) => window.removeEventListener(e, trigger));
    };
  }, [shouldMount]);

  if (!shouldMount) return null;
  return (
    <WidgetErrorBoundary>
      <Widget forceOpen={forceOpen} />
    </WidgetErrorBoundary>
  );
};

class WidgetErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Widget failed to load:", error);
  }
  render() {
    if (this.state.hasError) return null;
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


const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <RegisterProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            {isStandalone ? (
              <>
                <DeferredWidget mountImmediately />
                <LgoAutoDetectPrompt />
              </>
            ) : (
              <>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/vs-lgo" element={<VsLgo />} />
                  <Route path="/aide" element={<Aide />} />
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                  <Route path="/mentions-legales" element={<MentionsLegales />} />
                  <Route path="/confidentialite" element={<Confidentialite />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  <Route path="/cgu" element={<CGU />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <DeferredWidget mountImmediately />
                <VisitorTour />
                <CookieBanner />
                <LgoAutoDetectPrompt />
              </>
            )}
          </Suspense>
          </RegisterProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
