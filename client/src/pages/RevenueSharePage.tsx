import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RevenueShare, Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentWithDownline } from "@shared/schema";

const RevenueSharePage = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    to: new Date().toISOString().split('T')[0], // Today
  });

  // Fetch all revenue shares
  const { data: revenueShares, isLoading: isLoadingShares } = useQuery<RevenueShare[]>({
    queryKey: ['/api/revenue-shares'],
  });

  // Fetch all agents
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Fetch downline data
  const { data: agentsWithDownline } = useQuery<AgentWithDownline[]>({
    queryKey: ['/api/agents/downline'],
  });

  // Filter shares by agent and date range
  const filteredShares = revenueShares?.filter(share => {
    const shareDate = new Date(share.createdAt);
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999); // End of the day

    const dateMatches = shareDate >= fromDate && shareDate <= toDate;
    const agentMatches = !selectedAgentId || 
                         share.recipientAgentId === parseInt(selectedAgentId);

    return dateMatches && agentMatches;
  });

  // Group shares by recipient
  const sharesByAgent = filteredShares?.reduce((acc, share) => {
    const agentId = share.recipientAgentId;
    if (!acc[agentId]) {
      acc[agentId] = {
        agent: agents?.find(a => a.id === agentId),
        totalAmount: 0,
        shares: [],
      };
    }
    acc[agentId].totalAmount += share.amount;
    acc[agentId].shares.push(share);
    return acc;
  }, {} as Record<number, { agent?: Agent; totalAmount: number; shares: RevenueShare[] }>);

  // Calculate overall total
  const totalRevenueShare = filteredShares?.reduce((sum, share) => sum + share.amount, 0) || 0;

  // Get sponsorship path for an agent
  const getSponsorshipPath = (agentId: number): Agent[] => {
    const path: Agent[] = [];
    
    if (!agents) return path;

    let currentAgent = agents.find(a => a.id === agentId);
    while (currentAgent) {
      path.push(currentAgent);
      
      if (!currentAgent.sponsorId) break;
      
      currentAgent = agents.find(a => a.id === currentAgent?.sponsorId);
    }

    return path;
  };

  // Handle CSV export
  const exportToCSV = () => {
    if (!filteredShares || !agents) return;

    // Create CSV content
    let csvContent = "Transaction Date,Property Address,Transaction Amount,Recipient Agent,Tier Level,Amount\n";
    
    filteredShares.forEach(share => {
      const agent = agents.find(a => a.id === share.recipientAgentId);
      const transaction = { // Mock transaction data
        transactionDate: new Date(share.createdAt).toLocaleDateString(),
        propertyAddress: 'Transaction #' + share.transactionId,
        saleAmount: 0, // This would come from actual transaction data
      };

      // Find tier level
      const sourceAgent = agents.find(a => a.id === share.sourceAgentId);
      const tierLevel = sourceAgent ? getSponsorshipPath(sourceAgent.id).findIndex(a => a.id === share.recipientAgentId) + 1 : 0;

      csvContent += `${transaction.transactionDate},${transaction.propertyAddress},${transaction.saleAmount},${agent?.name || 'Unknown'}, Tier ${tierLevel},${share.amount.toFixed(2)}\n`;
    });

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-shares-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue Share</h1>
          <p className="text-gray-600">Monitor revenue sharing across your agent network</p>
        </div>
        <Button 
          className="inline-flex items-center"
          onClick={exportToCSV}
        >
          <i className="ri-download-line mr-2"></i> Export to CSV
        </Button>
      </div>

      {/* Filter controls */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
            <Select 
              value={selectedAgentId || ""}
              onValueChange={(value) => setSelectedAgentId(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Agents</SelectItem>
                {agents?.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-50 text-primary-600">
              <i className="ri-money-dollar-circle-line text-xl"></i>
            </div>
            <div className="ml-3">
              <p className="text-lg font-semibold">${totalRevenueShare.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Revenue Share</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-50 text-green-600">
              <i className="ri-user-received-line text-xl"></i>
            </div>
            <div className="ml-3">
              <p className="text-lg font-semibold">{sharesByAgent ? Object.keys(sharesByAgent).length : 0}</p>
              <p className="text-sm text-gray-500">Agents Receiving Shares</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
              <i className="ri-exchange-funds-line text-xl"></i>
            </div>
            <div className="ml-3">
              <p className="text-lg font-semibold">{filteredShares?.length || 0}</p>
              <p className="text-sm text-gray-500">Total Transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue share table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Revenue Share Details</h2>
        </div>
        
        {isLoadingShares || isLoadingAgents ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredShares?.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No revenue shares found for the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient Agent
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Agent
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier Level
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShares?.map(share => {
                  const recipientAgent = agents?.find(a => a.id === share.recipientAgentId);
                  const sourceAgent = agents?.find(a => a.id === share.sourceAgentId);
                  
                  // Calculate tier level
                  const tierLevel = sourceAgent 
                    ? getSponsorshipPath(sourceAgent.id).findIndex(a => a.id === share.recipientAgentId) + 1 
                    : 0;
                  
                  return (
                    <tr key={share.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{recipientAgent?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{recipientAgent?.agentType || ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sourceAgent?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{sourceAgent?.agentType || ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        Tier {tierLevel}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        ID: {share.transactionId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(share.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                        ${share.amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default RevenueSharePage;