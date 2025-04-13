import { useState, useMemo } from "react";
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
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  subMonths,
  startOfDay,
  parseISO,
  differenceInCalendarDays,
  addDays
} from "date-fns";

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
    
  // Get current month date range
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  
  // Calculate pending transactions stats
  const pendingTransactions = transactions?.filter(tx => tx.transactionStatus === 'pending') || [];
  const pendingTransactionsCount = pendingTransactions.length;
  
  // Calculate total pending GCI and company GCI
  const totalPendingGCI = pendingTransactions.reduce((sum, tx) => sum + ((tx.saleAmount * tx.commissionPercentage) / 100), 0);
  const totalPendingCompanyGCI = pendingTransactions.reduce((sum, tx) => sum + (tx.companyGCI || 0), 0);
  
  // Calculate closings this month
  const closingsThisMonth = transactions?.filter(tx => {
    const txDate = new Date(tx.transactionDate);
    return tx.transactionStatus === 'closed' && 
           isWithinInterval(txDate, { start: currentMonthStart, end: currentMonthEnd });
  }).length || 0;
  
  // Calculate new agents joined this month
  const newAgentsThisMonth = agents?.filter(agent => {
    if (!agent.createdAt) return false;
    const createdAt = new Date(agent.createdAt);
    return isWithinInterval(createdAt, { start: currentMonthStart, end: currentMonthEnd });
  }).length || 0;
  
  // Generate sparkline data for the past 30 days
  const generateSparklineData = (dataType: 'transactions' | 'gci' | 'agents') => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = startOfDay(subMonths(today, 1));
    const days = differenceInCalendarDays(today, thirtyDaysAgo);
    
    // Initialize the array with zeros for each day
    const sparklineData = Array.from({ length: days + 1 }, (_, i) => ({
      date: addDays(thirtyDaysAgo, i),
      value: 0
    }));
    
    if (dataType === 'transactions' && transactions) {
      // Count transactions by day
      transactions.forEach(tx => {
        const txDate = new Date(tx.transactionDate);
        // Only include transactions within the last 30 days
        if (isWithinInterval(txDate, { start: thirtyDaysAgo, end: today })) {
          const dayIndex = differenceInCalendarDays(txDate, thirtyDaysAgo);
          if (dayIndex >= 0 && dayIndex < sparklineData.length) {
            sparklineData[dayIndex].value += 1;
          }
        }
      });
    } else if (dataType === 'gci' && transactions) {
      // Sum GCI by day
      transactions.forEach(tx => {
        const txDate = new Date(tx.transactionDate);
        // Only include transactions within the last 30 days
        if (isWithinInterval(txDate, { start: thirtyDaysAgo, end: today })) {
          const dayIndex = differenceInCalendarDays(txDate, thirtyDaysAgo);
          if (dayIndex >= 0 && dayIndex < sparklineData.length) {
            sparklineData[dayIndex].value += tx.companyGCI || 0;
          }
        }
      });
    } else if (dataType === 'agents' && agents) {
      // Count agents by join date
      agents.forEach(agent => {
        if (!agent.createdAt) return;
        const createdAt = new Date(agent.createdAt);
        // Only include agents who joined within the last 30 days
        if (isWithinInterval(createdAt, { start: thirtyDaysAgo, end: today })) {
          const dayIndex = differenceInCalendarDays(createdAt, thirtyDaysAgo);
          if (dayIndex >= 0 && dayIndex < sparklineData.length) {
            sparklineData[dayIndex].value += 1;
          }
        }
      });
    }
    
    // Apply a cumulative sum for better visualization if needed
    // (Comment out if you prefer to see daily values instead of cumulative)
    let cumulativeSum = 0;
    const cumulativeData = sparklineData.map(day => {
      cumulativeSum += day.value;
      return {
        ...day,
        value: cumulativeSum
      };
    });
    
    return cumulativeData;
  };
  
  // Memoize sparkline data calculations to prevent unnecessary recalculations
  const transactionSparklineData = useMemo(() => generateSparklineData('transactions'), [transactions]);
  const gciSparklineData = useMemo(() => generateSparklineData('gci'), [transactions]);
  const agentSparklineData = useMemo(() => generateSparklineData('agents'), [agents]);
  
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
          sparklineData={agentSparklineData}
          sparklineColor="#6366f1"
        />
        
        <StatCard 
          title="Revenue Share Paid" 
          value={`$${totalRevenuePaid.toLocaleString()}`}
          change="8%" 
          icon="ri-money-dollar-circle-line" 
          iconBgClass="bg-success-50" 
          iconTextClass="text-success-500"
          sparklineData={gciSparklineData}
          sparklineColor="#10b981"
          sparklineType="area"
        />
        
        <StatCard 
          title="Total Transactions" 
          value={totalTransactions}
          change="5%" 
          icon="ri-exchange-dollar-line" 
          iconBgClass="bg-warning-50" 
          iconTextClass="text-warning-500"
          sparklineData={transactionSparklineData}
          sparklineColor="#f59e0b"
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
      
      {/* New Widgets - Additional Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard 
            title="Pending Transactions" 
            value={pendingTransactionsCount} 
            icon="ri-file-list-3-line" 
            iconBgClass="bg-indigo-50" 
            iconTextClass="text-indigo-600"
            sparklineData={transactionSparklineData.filter((_, i) => i > 20)}
            sparklineColor="#4f46e5"
          />
          
          <StatCard 
            title="Pending GCI" 
            value={`$${totalPendingGCI.toLocaleString()}`} 
            icon="ri-money-dollar-box-line" 
            iconBgClass="bg-green-50" 
            iconTextClass="text-green-600"
            sparklineData={gciSparklineData.filter((_, i) => i > 15)}
            sparklineColor="#059669"
            sparklineType="area"
          />
          
          <StatCard 
            title="Pending Company GCI" 
            value={`$${totalPendingCompanyGCI.toLocaleString()}`} 
            icon="ri-building-line" 
            iconBgClass="bg-cyan-50" 
            iconTextClass="text-cyan-600"
            sparklineData={gciSparklineData.filter((_, i) => i > 10)}
            sparklineColor="#0891b2"
            sparklineType="area"
          />
          
          <StatCard 
            title={`Closings in ${format(now, 'MMMM')}`} 
            value={closingsThisMonth} 
            icon="ri-calendar-check-line" 
            iconBgClass="bg-amber-50" 
            iconTextClass="text-amber-600"
            sparklineData={transactionSparklineData.filter(d => d.value > 0).slice(-7)}
            sparklineColor="#d97706"
          />
          
          <StatCard 
            title="New Agents This Month" 
            value={newAgentsThisMonth} 
            icon="ri-user-add-line" 
            iconBgClass="bg-rose-50" 
            iconTextClass="text-rose-600"
            sparklineData={agentSparklineData.slice(-10)}
            sparklineColor="#e11d48"
          />
        </div>
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
