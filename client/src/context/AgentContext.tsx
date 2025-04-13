import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Agent, AgentWithDownline } from "@shared/schema";

interface AgentContextType {
  rootAgent: AgentWithDownline | undefined;
  isLoadingAgents: boolean;
  agentsList: Agent[];
  refreshAgents: () => void;
}

const AgentContext = createContext<AgentContextType>({
  rootAgent: undefined,
  isLoadingAgents: true,
  agentsList: [],
  refreshAgents: () => {},
});

export const useAgentContext = () => useContext(AgentContext);

export const AgentProvider = ({ children }: { children: ReactNode }) => {
  // Fetch all agents
  const { 
    data: agents, 
    isLoading: isLoadingAllAgents,
    refetch: refetchAgents
  } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Fetch downline structure
  const { 
    data: agentsWithDownline,
    isLoading: isLoadingDownline,
    refetch: refetchDownline
  } = useQuery<AgentWithDownline[]>({
    queryKey: ['/api/agents/downline'],
  });

  // Combined loading state
  const isLoadingAgents = isLoadingAllAgents || isLoadingDownline;

  // Get the root agent (for demonstration, use first one if available)
  const rootAgent = agentsWithDownline?.[0];

  // Refresh function
  const refreshAgents = () => {
    refetchAgents();
    refetchDownline();
  };

  return (
    <AgentContext.Provider
      value={{
        rootAgent,
        isLoadingAgents,
        agentsList: agents || [],
        refreshAgents,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};
