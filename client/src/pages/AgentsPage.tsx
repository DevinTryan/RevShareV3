import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Agent, AgentWithDownline } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddAgentForm from "@/components/forms/AddAgentForm";
import EditAgentForm from "@/components/forms/EditAgentForm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import AgentDownlineTree from "@/components/dashboard/AgentDownlineTree";
import TierInfoCard from "@/components/agents/TierInfoCard";

const AgentsPage = () => {
  const [isAddAgentDialogOpen, setIsAddAgentDialogOpen] = useState(false);
  const [isEditAgentDialogOpen, setIsEditAgentDialogOpen] = useState(false);
  const [isViewDownlineDialogOpen, setIsViewDownlineDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Filter agents by search term
  const filteredAgents = agents?.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to get initials from agent name
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };

  // Function to get avatar color based on agent name
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-primary-600',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-pink-500'
    ];
    
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
          <p className="text-gray-600">Manage your real estate agents</p>
        </div>
        <Button 
          className="inline-flex items-center"
          onClick={() => setIsAddAgentDialogOpen(true)}
        >
          <i className="ri-user-add-line mr-2"></i> Add Agent
        </Button>
      </div>

      {/* Search and filter bar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-grow max-w-md">
          <Input
            type="text"
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <i className="ri-search-line text-gray-400"></i>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <i className="ri-filter-3-line mr-2"></i> Filter
          </Button>
          <Button variant="outline" size="sm">
            <i className="ri-sort-desc-line mr-2"></i> Sort
          </Button>
        </div>
      </div>

      {/* Agents List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">All Agents</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAgents?.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No agents found. Add your first agent to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredAgents?.map(agent => (
              <div key={agent.id} className="border border-gray-200 rounded-lg shadow-sm p-4 transition hover:shadow-md">
                <div className="flex items-center">
                  <div className={`h-10 w-10 rounded-full ${getAvatarColor(agent.name)} flex items-center justify-center text-white font-medium`}>
                    {getInitials(agent.name)}
                  </div>
                  <div className="ml-3">
                    <div className="font-medium text-lg">{agent.name}</div>
                    <div className="flex items-center">
                      <Badge variant={agent.agentType === 'principal' ? 'principal' : 'support'} className="mr-2">
                        {agent.agentType === 'principal' ? 'Principal' : 'Support'}
                      </Badge>
                      {agent.agentType === 'principal' && agent.capType && (
                        <span className="text-xs text-gray-500">
                          {agent.capType === 'standard' ? 'Standard Cap' : 'Team Cap'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Agent ID:</div>
                  <div className="text-gray-900 font-mono">
                    {agent.agentCode || '------'}
                  </div>

                  <div className="text-gray-600">Anniversary:</div>
                  <div className="text-gray-900">
                    {format(new Date(agent.anniversaryDate), 'MMM dd, yyyy')}
                  </div>
                  
                  <div className="text-gray-600">Current Cap:</div>
                  <div className="text-gray-900">
                    {agent.agentType === 'principal' 
                      ? `$${(agent.currentCap || 0).toLocaleString()} / $${agent.capType === 'team' ? '8,000' : '16,000'}`
                      : 'N/A'
                    }
                  </div>

                  <div className="text-gray-600">GCI Since Anniversary:</div>
                  <div className="text-gray-900">
                    ${(agent.gciSinceAnniversary || 0).toLocaleString()}
                  </div>
                  
                  <div className="text-gray-600">Added On:</div>
                  <div className="text-gray-900">
                    {agent.createdAt ? format(new Date(agent.createdAt), 'MMM dd, yyyy') : 'N/A'}
                  </div>

                  {agent.agentType === 'support' && (
                    <div className="col-span-2 mt-2">
                      <div className="text-gray-600 mb-1">Current Tier:</div>
                      <TierInfoCard 
                        gciYtd={agent.totalGciYtd || 0} 
                        currentTier={agent.currentTier || 1}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setIsEditAgentDialogOpen(true);
                    }}
                  >
                    <i className="ri-edit-line mr-1"></i> Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setIsViewDownlineDialogOpen(true);
                    }}
                  >
                    <i className="ri-team-line mr-1"></i> View Sponsor Tree
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Agent Dialog */}
      <Dialog open={isAddAgentDialogOpen} onOpenChange={setIsAddAgentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Add New Agent
          </DialogTitle>
          <AddAgentForm onAgentAdded={() => setIsAddAgentDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={isEditAgentDialogOpen} onOpenChange={setIsEditAgentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Edit Agent
          </DialogTitle>
          {selectedAgent && (
            <EditAgentForm
              agent={selectedAgent}
              onClose={() => setIsEditAgentDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Downline Dialog */}
      <Dialog open={isViewDownlineDialogOpen} onOpenChange={setIsViewDownlineDialogOpen}>
        <DialogContent className="sm:max-w-[800px] h-[80vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {selectedAgent?.name}'s Sponsor Tree
          </DialogTitle>
          {selectedAgent && (
            <div className="mt-4">
              {/* Agent Downline Query */}
              <AgentDownlineQuery agentId={selectedAgent.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper component to fetch and display agent downline
function AgentDownlineQuery({ agentId }: { agentId: number }) {
  const { data: agentWithDownline, isLoading } = useQuery<AgentWithDownline>({
    queryKey: [`/api/agents/${agentId}/downline`],
  });

  return (
    <AgentDownlineTree 
      rootAgent={agentWithDownline} 
      isLoading={isLoading} 
      onAddRecruit={() => {}} // We don't need to add recruits in this view
    />
  );
}

export default AgentsPage;
