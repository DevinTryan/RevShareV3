import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import AgentsPage from "@/pages/AgentsPage";
import TransactionsPage from "@/pages/TransactionsPage";
import RevenueSharePage from "@/pages/RevenueSharePage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import ZapierSettingsPage from "@/pages/ZapierSettingsPage";
import AuthPage from "@/pages/auth-page";
import UnauthorizedPage from "@/pages/unauthorized-page";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useState } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { AgentProvider } from "@/context/AgentContext";
import { ProtectedRoute } from "@/lib/protected-route";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  // Assign the toggleMobileMenu function to the window object
  // so it can be used by PageHeader components
  if (typeof window !== 'undefined') {
    window.toggleMobileMenu = toggleMobileMenu;
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

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/unauthorized" component={UnauthorizedPage} />
      
      {/* Protected Routes - Only logged-in users can access these */}
      <Route path="/">
        {() => (
          <AppLayout>
            <Switch>
              <ProtectedRoute path="/" component={Dashboard} />
              <ProtectedRoute path="/agents" component={AgentsPage} />
              <ProtectedRoute path="/transactions" component={TransactionsPage} />
              <ProtectedRoute path="/revenue-share" component={RevenueSharePage} />
              <ProtectedRoute path="/reports" component={ReportsPage} />
              <ProtectedRoute path="/settings" component={SettingsPage} />
              <ProtectedRoute path="/integrations/zapier" component={ZapierSettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentProvider>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </AgentProvider>
    </QueryClientProvider>
  );
}

export default App;
