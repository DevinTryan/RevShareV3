import { AgentType, Agent } from "@shared/schema";

// Calculate commission based on sale amount and percentage
export function calculateCommission(saleAmount: number, commissionPercentage: number): number {
  return (saleAmount * commissionPercentage) / 100;
}

// Calculate company GCI (15% of total commission)
export function calculateCompanyGCI(totalCommission: number): number {
  return totalCommission * 0.15;
}

// Calculate agent's share (commission - company GCI)
export function calculateAgentShare(totalCommission: number, companyGCI: number): number {
  return totalCommission - companyGCI;
}

// Calculate revenue share pool based on agent type
export function calculateRevenueSharePool(
  companyGCI: number, 
  agentId?: number, 
  agents?: Agent[]
): number {
  if (!agentId || !agents) return 0;
  
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return 0;
  
  // Get the percentage based on agent type
  if (agent.agentType === AgentType.PRINCIPAL) {
    // Principal agent: 12.5% of company GCI
    return companyGCI * 0.125;
  } else {
    // Support agent: 2% of company GCI
    return companyGCI * 0.02;
  }
}

// Calculate maximum annual revenue share based on agent type and cap type
export function calculateMaxAnnualRevenueShare(agent: Agent): number {
  if (agent.agentType === AgentType.PRINCIPAL) {
    return agent.capType === 'team' ? 1000 : 2000;
  } else {
    return 2000; // Support agent: max $2,000 per year per agent
  }
}

// Calculate remaining allowed revenue share for an agent
export function calculateRemainingAllowance(
  maxAnnualPayout: number, 
  totalPaidThisYear: number
): number {
  const remaining = maxAnnualPayout - totalPaidThisYear;
  return remaining > 0 ? remaining : 0;
}
