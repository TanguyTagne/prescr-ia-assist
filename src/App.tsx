import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Widget = lazy(() => import("./components/Widget"));

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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          {isStandalone ? (
            <Widget forceOpen />
          ) : (
            <>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Widget />
            </>
          )}
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
