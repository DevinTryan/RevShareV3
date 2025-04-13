import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import AgentsPage from "@/pages/AgentsPage";
import TransactionsPage from "@/pages/TransactionsPage";
import RevenueSharePage from "@/pages/RevenueSharePage";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useState } from "react";

function Router() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader toggleMenu={toggleMobileMenu} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/agents" component={AgentsPage} />
            <Route path="/transactions" component={TransactionsPage} />
            <Route path="/revenue-share" component={RevenueSharePage} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
      
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

export default App;
