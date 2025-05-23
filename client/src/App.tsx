import React, { useState } from 'react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Switch, Route, useLocation, Redirect } from 'wouter';
import { useAuth, AuthProvider } from './hooks/use-auth';
import { AgentProvider } from './context/AgentContext';
import { Toaster } from './components/ui/toaster';
import Dashboard from './pages/Dashboard';
import AgentsPage from './pages/AgentsPage';
import SimpleTransactionsPage from './pages/simple-transactions-page';
import SimpleTransactionPage from './pages/simple-transaction-page';
import RevenueSharePage from './pages/RevenueSharePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ZapierSettingsPage from './pages/ZapierSettingsPage';
import AuthPage from './pages/auth-page';
import UnauthorizedPage from './pages/unauthorized-page';
import NotFound from './pages/not-found';
import UsersPage from './pages/admin/UsersPage';
import Sidebar from './components/layout/Sidebar';
import MobileHeader from './components/layout/MobileHeader';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from './lib/protected-route';
import { AdminHistory } from './components/AdminHistory';
import { queryClient } from './lib/queryClient';
import { UserRole } from '@shared/schema';

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect non-admin users from admin routes
  if (location.startsWith('/admin') && user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      <Route path="/unauthorized" component={UnauthorizedPage} />
      <ProtectedRoute path="/admin/history" component={AdminHistory} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin" component={UsersPage} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/agents" component={AgentsPage} />
      <ProtectedRoute path="/agents/:id" component={SimpleTransactionPage} />
      <ProtectedRoute path="/transactions" component={SimpleTransactionsPage} />
      <ProtectedRoute path="/transactions/new" component={SimpleTransactionPage} />
      <ProtectedRoute path="/transactions/:id" component={SimpleTransactionPage} />
      <ProtectedRoute path="/revenue-share" component={RevenueSharePage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/settings/zapier" component={ZapierSettingsPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={queryClient}>
        <AgentProvider>
          <AuthProvider>
            <MainApp sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          </AuthProvider>
        </AgentProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}

function MainApp({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean; setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated, only show AuthPage routes
  if (!user) {
    return (
      <main className="flex-1 p-4 md:p-8">
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/register" component={AuthPage} />
          <Route path="/">
            <Redirect to="/login" />
          </Route>
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
        <Toaster />
      </main>
    );
  }

  // Authenticated: show full app
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar for desktop & toggled on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="md:hidden">
          <MobileHeader toggleMenu={() => setSidebarOpen((open) => !open)} />
        </div>
        {/* Main content */}
        <main className="flex-1 p-4 md:p-8">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}

export default App;
