import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { AgentWithDownline, AgentType, Agent } from "@shared/schema";
import EditAgentForm from "@/components/forms/EditAgentForm";

interface AgentDownlineTreeProps {
  rootAgent?: AgentWithDownline;
  isLoading: boolean;
  onAddRecruit: (sponsorId: number) => void;
}

const AgentDownlineTree = ({ rootAgent, isLoading, onAddRecruit }: AgentDownlineTreeProps) => {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!rootAgent) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No agent data available. Add your first agent to get started.</p>
      </div>
    );
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  function getRandomColor(name: string): string {
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
    
    // Use the sum of character codes to pick a color
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }

  // Recursively render agent and their downline
  const renderAgent = (agent: AgentWithDownline, level: number = 0) => {
    const isRoot = level === 0;
    const agentInitials = getInitials(agent.name);
    const avatarColor = getRandomColor(agent.name);
    const hasDownline = agent.downline && agent.downline.length > 0;
    
    return (
      <div key={agent.id} className={`${isRoot ? '' : 'agent-level mb-3'}`}>
        <div className={`flex items-center justify-between p-3 rounded-md ${isRoot ? 'bg-primary-50' : 'bg-white border border-gray-200 shadow-sm hover:shadow-md transition'}`}>
          <div className="flex items-center">
            <div className={`h-${isRoot ? '10' : '8'} w-${isRoot ? '10' : '8'} rounded-full ${avatarColor} flex items-center justify-center text-white font-medium`}>
              {agentInitials}
            </div>
            <div className="ml-3">
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-500 flex items-center">
                <Badge variant={agent.agentType === AgentType.PRINCIPAL ? 'principal' : 'support'} className="mr-2">
                  {agent.agentType === AgentType.PRINCIPAL ? 'Principal' : 'Support'}
                </Badge>
                <span>
                  {agent.agentType === AgentType.PRINCIPAL 
                    ? `$${(agent.currentCap || 0).toLocaleString()}/${agent.capType === 'team' ? '8,000' : '16,000'}`
                    : `$${agent.totalEarnings?.toLocaleString() || 0} GCI`}
                  
                  {/* Calculate time since anniversary date */}
                  {agent.anniversaryDate && 
                    ` • ${Math.floor((new Date().getTime() - new Date(agent.anniversaryDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} Months`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm font-semibold">${agent.totalEarnings?.toLocaleString() || 0}</div>
            <div className="text-xs text-gray-500 mb-1">Revenue Share</div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setEditingAgent(agent);
                setIsEditDialogOpen(true);
              }}
              className="text-xs"
            >
              <i className="ri-edit-line mr-1"></i> Edit
            </Button>
          </div>
        </div>
        
        {/* Downline agents */}
        {hasDownline && (
          <div className="tree-connection mt-2">
            {agent.downline!.map(downlineAgent => renderAgent(downlineAgent, level + 1))}
          </div>
        )}
        
        {/* Add recruit button if level < 5 */}
        {level < 5 && !hasDownline && (
          <div className="tree-connection mt-2 pl-8">
            <button 
              className="flex items-center justify-center p-2 w-full border border-dashed border-gray-300 rounded-md text-gray-500 hover:text-primary-600 hover:border-primary-500 transition"
              onClick={() => onAddRecruit(agent.id)}
            >
              <i className="ri-user-add-line mr-2"></i>
              <span className="text-sm">Add Recruit</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="agent-card">
      {/* Edit Agent Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Edit Agent
          </DialogTitle>
          {editingAgent && (
            <EditAgentForm
              agent={editingAgent}
              onClose={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {renderAgent(rootAgent)}
    </div>
  );
};

export default AgentDownlineTree;
