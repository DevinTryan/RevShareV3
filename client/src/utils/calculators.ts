import { AgentType, Agent, CapType, LeadSource, SupportAgentTier } from "@shared/schema";

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

/**
 * Get the commission tier for a support agent based on their total GCI
 * @param totalGCI Total GCI amount for the year
 * @returns The tier number (1-9)
 */
export function getSupportAgentTier(totalGCI: number): number {
  if (totalGCI < 40000) return 1;  // 0-$40,000 - 50%
  if (totalGCI < 80000) return 2;  // $40,000-$80,000 - 60%
  if (totalGCI < 150000) return 3; // $80,000-$150,000 - 70%
  if (totalGCI < 225000) return 4; // $150,000-$225,000 - 75%
  if (totalGCI < 310000) return 5; // $225,000-$310,000 - 80%
  if (totalGCI < 400000) return 6; // $310,000-$400,000 - 84%
  if (totalGCI < 500000) return 7; // $400,000-$500,000 - 88%
  if (totalGCI < 650000) return 8; // $500,000-$650,000 - 90%
  return 9;                        // $650,000+ - 92%
}

/**
 * Get the commission percentage for a support agent based on their tier level
 * @param tier The agent's tier (1-9)
 * @returns The commission percentage the agent receives
 */
export function getSupportAgentCommissionPercentage(tier: number): number {
  switch (tier) {
    case 1: return 50;
    case 2: return 60;
    case 3: return 70;
    case 4: return 75;
    case 5: return 80;
    case 6: return 84;
    case 7: return 88;
    case 8: return 90;
    case 9: return 92;
    default: return 50; // Default to tier 1
  }
}

/**
 * Calculate the commission split for company-provided leads
 * @param agent The agent
 * @param careerSalesCount Number of career sales
 * @returns The commission percentage the agent receives
 */
export function calculateCompanyLeadCommission(agent: Agent, careerSalesCount: number): number {
  // Brand new agents (first 3 sales) get 30%
  if (careerSalesCount < 3) {
    return 30;
  }
  
  // Experienced agents (4+ career sales) get 40%
  return 40;
}

/**
 * Calculate the commission amount for an agent based on the transaction details
 * @param totalCommission Total commission amount
 * @param agent The agent
 * @param isCompanyProvided Whether the lead is company provided
 * @param careerSalesCount Number of career sales (optional)
 * @param complianceFeePaidByAgent Whether the agent pays the compliance fee (true) or client (false)
 * @returns The commission amount the agent receives
 */
export function calculateAgentCommissionAmount(
  totalCommission: number,
  agent: Agent,
  isCompanyProvided: boolean,
  careerSalesCount: number = 0,
  complianceFeePaidByAgent: boolean = true
): number {
  // Determine commission percentage
  let commissionPercentage = 0;
  
  if (isCompanyProvided) {
    // Company provided leads
    commissionPercentage = calculateCompanyLeadCommission(agent, careerSalesCount);
  } else {
    // Self-generated leads - use tier system for support agents
    if (agent.agentType === AgentType.SUPPORT) {
      const tier = agent.currentTier || getSupportAgentTier(agent.totalGCIYTD || 0);
      commissionPercentage = getSupportAgentCommissionPercentage(tier);
    } else {
      // Principal agents have a different structure (simplified)
      commissionPercentage = 80; // Default for principal agents
    }
  }
  
  // Calculate agent's commission
  let agentCommission = totalCommission * (commissionPercentage / 100);
  
  // Deduct compliance fee if agent pays it
  if (complianceFeePaidByAgent) {
    agentCommission -= 500; // $500 compliance fee
  }
  
  return Math.max(0, agentCommission);
}

/**
 * Calculate the total commission including compliance fee
 * @param saleAmount The property sale amount
 * @param commissionPercentage The commission percentage
 * @param complianceFeePaidByClient Whether the client pays the compliance fee
 * @returns The total commission amount
 */
export function calculateTotalCommissionWithCompliance(
  saleAmount: number,
  commissionPercentage: number,
  complianceFeePaidByClient: boolean = false
): number {
  const baseCommission = (saleAmount * commissionPercentage) / 100;
  return complianceFeePaidByClient ? baseCommission + 500 : baseCommission;
}

/**
 * Calculate showing agent fee
 * @param agentCommission The primary agent's commission
 * @param percentage The percentage to pay the showing agent (default 10%)
 * @returns The showing agent fee
 */
export function calculateShowingAgentFee(
  agentCommission: number,
  percentage: number = 10
): number {
  return agentCommission * (percentage / 100);
}
