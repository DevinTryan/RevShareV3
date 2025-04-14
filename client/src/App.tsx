import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import AgentsPage from "@/pages/AgentsPage";
import SimpleTransactionsPage from "@/pages/simple-transactions-page";
import SimpleTransactionPage from "@/pages/simple-transaction-page";
import RevenueSharePage from "@/pages/RevenueSharePage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import ZapierSettingsPage from "@/pages/ZapierSettingsPage";
import AuthPage from "@/pages/auth-page";
import UnauthorizedPage from "@/pages/unauthorized-page";
import NotFound from "@/pages/not-found";
import UsersPage from "@/pages/admin/UsersPage";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AgentProvider } from "@/context/AgentContext";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Assign the toggleMobileMenu function to the window object
  // so it can be used by PageHeader components
  if (typeof window !== "undefined") {
    (window as any).toggleMobileMenu = toggleMobileMenu;
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader toggleMenu={toggleMobileMenu} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/unauthorized">
        <UnauthorizedPage />
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/agents">
        <ProtectedRoute>
          <AppLayout>
            <AgentsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/revenue-share">
        <ProtectedRoute>
          <AppLayout>
            <RevenueSharePage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <AppLayout>
            <ReportsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/integrations/zapier">
        <ProtectedRoute>
          <AppLayout>
            <ZapierSettingsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute>
          <AppLayout>
            <UsersPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/simple-transactions">
        <ProtectedRoute>
          <AppLayout>
            <SimpleTransactionsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/simple-transaction/new">
        <ProtectedRoute>
          <AppLayout>
            <SimpleTransactionPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/simple-transactions/:id">
        <ProtectedRoute>
          <AppLayout>
            <SimpleTransactionPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AgentProvider>
    </QueryClientProvider>
  );
}

export default App;
