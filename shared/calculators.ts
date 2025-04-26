import { AgentType, Agent, CapType, LeadSource } from "@shared/schema";
import { CONFIG } from "./config";

// Calculate commission based on sale amount and percentage
export function calculateCommission(saleAmount: number, commissionPercentage: number): number {
  if (saleAmount < CONFIG.validation.minSaleAmount || saleAmount > CONFIG.validation.maxSaleAmount) {
    throw new Error(`Sale amount must be between $${CONFIG.validation.minSaleAmount} and $${CONFIG.validation.maxSaleAmount}`);
  }
  if (commissionPercentage <= 0 || commissionPercentage > 100) {
    throw new Error("Commission percentage must be between 0 and 100");
  }
  return (saleAmount * commissionPercentage) / 100;
}

// Calculate company GCI (15% of total commission)
export function calculateCompanyGCI(totalCommission: number): number {
  if (totalCommission < 0) {
    throw new Error("Total commission cannot be negative");
  }
  return totalCommission * 0.15;
}

// Calculate agent's share (commission - company GCI)
export function calculateAgentShare(totalCommission: number, companyGCI: number): number {
  if (totalCommission < 0 || companyGCI < 0) {
    throw new Error("Commission and GCI cannot be negative");
  }
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
  const percentage = agent.agentType === AgentType.PRINCIPAL 
    ? CONFIG.revenueShare.principalAgentPercentage 
    : CONFIG.revenueShare.supportAgentPercentage;
  
  return companyGCI * (percentage / 100);
}

// Calculate maximum annual revenue share based on agent type and cap type
export function calculateMaxAnnualRevenueShare(agent: Agent): number {
  if (agent.agentType === AgentType.PRINCIPAL) {
    return agent.capType === CapType.TEAM 
      ? CONFIG.revenueShare.maxAnnualPayout.team 
      : CONFIG.revenueShare.maxAnnualPayout.standard;
  }
  return CONFIG.revenueShare.maxAnnualPayout.standard;
}

// Calculate remaining allowed revenue share for an agent
export function calculateRemainingAllowance(
  maxAnnualPayout: number, 
  totalPaidThisYear: number
): number {
  if (maxAnnualPayout < 0 || totalPaidThisYear < 0) {
    throw new Error("Payout amounts cannot be negative");
  }
  const remaining = maxAnnualPayout - totalPaidThisYear;
  return remaining > 0 ? remaining : 0;
}

/**
 * Get the commission tier for a support agent based on their total GCI
 */
export function getSupportAgentTier(totalGCI: number): number {
  if (totalGCI < 0) {
    throw new Error("Total GCI cannot be negative");
  }
  
  const tier = CONFIG.supportAgentTiers.findIndex(
    tier => totalGCI >= tier.minGCI && totalGCI < tier.maxGCI
  );
  
  return tier === -1 ? CONFIG.supportAgentTiers.length : tier + 1;
}

/**
 * Get the commission percentage for a support agent based on their tier level
 */
export function getSupportAgentCommissionPercentage(tier: number): number {
  if (tier < 1 || tier > CONFIG.supportAgentTiers.length) {
    throw new Error(`Invalid tier level: ${tier}`);
  }
  return CONFIG.supportAgentTiers[tier - 1].percentage;
}

/**
 * Calculate the commission split for company-provided leads
 */
export function calculateCompanyLeadCommission(agent: Agent, careerSalesCount: number): number {
  if (careerSalesCount < 0) {
    throw new Error("Career sales count cannot be negative");
  }
  
  return careerSalesCount < 3 
    ? CONFIG.commission.companyLead.newAgentPercentage 
    : CONFIG.commission.companyLead.experiencedAgentPercentage;
}

/**
 * Calculate the commission amount for an agent based on the transaction details
 */
export function calculateAgentCommissionAmount(
  totalCommission: number,
  agent: Agent,
  isCompanyProvided: boolean,
  careerSalesCount: number = 0,
  complianceFeePaidByAgent: boolean = true
): number {
  if (totalCommission < 0) {
    throw new Error("Total commission cannot be negative");
  }
  
  // Determine commission percentage
  let commissionPercentage = 0;
  
  if (isCompanyProvided) {
    commissionPercentage = calculateCompanyLeadCommission(agent, careerSalesCount);
  } else {
    if (agent.agentType === AgentType.SUPPORT) {
      const tier = agent.currentTier || getSupportAgentTier(agent.totalGCIYTD || 0);
      commissionPercentage = getSupportAgentCommissionPercentage(tier);
    } else {
      commissionPercentage = CONFIG.commission.principalAgentDefaultPercentage;
    }
  }
  
  // Calculate agent's commission
  let agentCommission = totalCommission * (commissionPercentage / 100);
  
  // Deduct compliance fee if agent pays it
  if (complianceFeePaidByAgent) {
    agentCommission -= CONFIG.commission.complianceFee;
  }
  
  if (agentCommission < 0) {
    console.warn(`Negative commission calculated for agent ${agent.id}: ${agentCommission}`);
    return 0;
  }
  
  return agentCommission;
}

/**
 * Calculate the total commission including compliance fee
 */
export function calculateTotalCommissionWithCompliance(
  saleAmount: number,
  commissionPercentage: number,
  complianceFeePaidByClient: boolean = false
): number {
  const baseCommission = calculateCommission(saleAmount, commissionPercentage);
  return complianceFeePaidByClient 
    ? baseCommission + CONFIG.commission.complianceFee 
    : baseCommission;
}

/**
 * Calculate showing agent fee
 */
export function calculateShowingAgentFee(
  agentCommission: number,
  percentage: number = 10
): number {
  if (agentCommission < 0) {
    throw new Error("Agent commission cannot be negative");
  }
  if (percentage < 0 || percentage > 100) {
    throw new Error("Percentage must be between 0 and 100");
  }
  return agentCommission * (percentage / 100);
} 