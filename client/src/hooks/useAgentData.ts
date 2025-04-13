import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Agent, AgentWithDownline, InsertAgent } from "@shared/schema";

export function useAgentData() {
  // Get all agents
  const { 
    data: agents,
    isLoading: isLoadingAgents,
    error: agentsError,
  } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Get agents with downline structure
  const {
    data: agentsWithDownline,
    isLoading: isLoadingDownline,
    error: downlineError,
  } = useQuery<AgentWithDownline[]>({
    queryKey: ['/api/agents/downline'],
  });

  // Get a specific agent with downline
  const getAgentWithDownline = (id: number) => {
    return useQuery<AgentWithDownline>({
      queryKey: [`/api/agents/${id}/downline`],
    });
  };

  // Create a new agent
  const createAgentMutation = useMutation({
    mutationFn: async (agent: InsertAgent) => {
      const response = await apiRequest('POST', '/api/agents', agent);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
    },
  });

  // Update an agent
  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, agent }: { id: number; agent: Partial<Agent> }) => {
      const response = await apiRequest('PUT', `/api/agents/${id}`, agent);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
    },
  });

  // Delete an agent
  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/agents/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
    },
  });

  return {
    agents,
    agentsWithDownline,
    isLoading: isLoadingAgents || isLoadingDownline,
    error: agentsError || downlineError,
    getAgentWithDownline,
    createAgent: createAgentMutation.mutate,
    isCreatingAgent: createAgentMutation.isPending,
    updateAgent: updateAgentMutation.mutate,
    isUpdatingAgent: updateAgentMutation.isPending,
    deleteAgent: deleteAgentMutation.mutate,
    isDeletingAgent: deleteAgentMutation.isPending,
  };
}
