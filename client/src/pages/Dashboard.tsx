import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AgentWithDownline, Agent, Transaction, RevenueShare } from "@shared/schema";
import StatCard from "@/components/dashboard/StatCard";
import AgentDownlineTree from "@/components/dashboard/AgentDownlineTree";
import AddAgentForm from "@/components/forms/AddAgentForm";
import AddTransactionForm from "@/components/forms/AddTransactionForm";
import TransactionsTable from "@/components/transactions/TransactionsTable";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const [, navigate] = useLocation();
  const [isAddRecruitDialogOpen, setIsAddRecruitDialogOpen] = useState(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | undefined>(undefined);
  
  // Fetch agents with downline structure
  const { data: agentsWithDownline, isLoading: isLoadingDownline } = useQuery<AgentWithDownline[]>({
    queryKey: ['/api/agents/downline'],
  });
  
  // Get root level agent (for demonstration, use first one)
  const rootAgent = agentsWithDownline?.[0];
  
  // Fetch all agents (for counts and stats)
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });
  
  // Fetch transactions (for stats)
  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Fetch revenue shares (for stats)
  const { data: revenueShares } = useQuery<RevenueShare[]>({
    queryKey: ['/api/revenue-shares'],
  });
  
  // Calculate stats
  const totalAgents = agents?.length || 0;
  const totalTransactions = transactions?.length || 0;
  
  const totalRevenuePaid = revenueShares
    ? revenueShares.reduce((total, share) => total + share.amount, 0)
    : 0;
    
  // Calculate average downline size
  const avgDownlineSize = rootAgent && rootAgent.downline 
    ? (rootAgent.downline.reduce((sum, agent) => {
        // Count direct downline plus any nested downline
        return sum + 1 + (agent.downline?.length || 0);
      }, 0) / (rootAgent.downline.length || 1)).toFixed(1)
    : "0.0";
  
  // Handle adding a new recruit
  const handleAddRecruit = (sponsorId: number) => {
    setSelectedSponsorId(sponsorId);
    setIsAddRecruitDialogOpen(true);
  };
  
  // Close dialog and refresh data
  const handleAgentAdded = () => {
    setIsAddRecruitDialogOpen(false);
  };
  
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">View and manage your revenue share program</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Total Agents" 
          value={totalAgents}
          change="12%" 
          icon="ri-user-line" 
          iconBgClass="bg-primary-50" 
          iconTextClass="text-primary-600"
        />
        
        <StatCard 
          title="Revenue Share Paid" 
          value={`$${totalRevenuePaid.toLocaleString()}`}
          change="8%" 
          icon="ri-money-dollar-circle-line" 
          iconBgClass="bg-success-50" 
          iconTextClass="text-success-500"
        />
        
        <StatCard 
          title="Total Transactions" 
          value={totalTransactions}
          change="5%" 
          icon="ri-exchange-dollar-line" 
          iconBgClass="bg-warning-50" 
          iconTextClass="text-warning-500"
        />
        
        <StatCard 
          title="Avg Downline Size" 
          value={avgDownlineSize}
          change="2%" 
          icon="ri-team-line" 
          iconBgClass="bg-primary-50" 
          iconTextClass="text-primary-600"
        />
      </div>
      
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button 
          className="inline-flex items-center"
          onClick={() => setIsAddRecruitDialogOpen(true)}
        >
          <i className="ri-user-add-line mr-2"></i> Add Agent
        </Button>
        
        <Button 
          className="inline-flex items-center bg-green-500 hover:bg-green-600"
          onClick={() => navigate("/transactions")}
        >
          <i className="ri-add-circle-line mr-2"></i> New Transaction
        </Button>
        
        <Button variant="outline" className="inline-flex items-center">
          <i className="ri-download-line mr-2"></i> Export Reports
        </Button>
      </div>
      
      {/* Agent Downline Tree and Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Agent Downline Tree - 7/12 columns on large screens */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Agent Downline</h2>
              <div className="flex items-center">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search agents..." 
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <i className="ri-search-line text-gray-400"></i>
                  </div>
                </div>
                <button className="ml-2 p-2 text-gray-500 hover:text-gray-700">
                  <i className="ri-filter-3-line"></i>
                </button>
              </div>
            </div>
            
            <div className="p-4 max-h-[600px] overflow-y-auto">
              <AgentDownlineTree 
                rootAgent={rootAgent} 
                isLoading={isLoadingDownline}
                onAddRecruit={handleAddRecruit}
              />
            </div>
          </div>
        </div>
        
        {/* Forms Section - 5/12 columns on large screens */}
        <div className="lg:col-span-5 space-y-6">
          <AddAgentForm />
          <AddTransactionForm />
        </div>
      </div>
      
      {/* Recent Transactions Table */}
      <div className="mt-6">
        <TransactionsTable 
          limit={5} 
          showViewAll={true}
          onViewAllClick={() => navigate("/transactions")}
        />
      </div>

      {/* Add Recruit Dialog */}
      <Dialog open={isAddRecruitDialogOpen} onOpenChange={setIsAddRecruitDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <h2 className="font-semibold text-gray-800 mb-4">Add New Recruit</h2>
          <AddAgentForm 
            onAgentAdded={handleAgentAdded}
            preselectedSponsorId={selectedSponsorId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
