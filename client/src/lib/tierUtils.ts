import { SupportAgentTier } from "@shared/schema";

export interface TierInfo {
  tier: number;
  commissionPercentage: number;
  minGci: number;
  maxGci: number | null;
  nextTierGci: number | null;
}

/**
 * Tier thresholds and commission percentages for support agents
 */
export const TIER_THRESHOLDS: TierInfo[] = [
  { tier: 1, commissionPercentage: 50, minGci: 0, maxGci: 40000, nextTierGci: 40000 },
  { tier: 2, commissionPercentage: 60, minGci: 40000, maxGci: 80000, nextTierGci: 80000 },
  { tier: 3, commissionPercentage: 70, minGci: 80000, maxGci: 150000, nextTierGci: 150000 },
  { tier: 4, commissionPercentage: 75, minGci: 150000, maxGci: 225000, nextTierGci: 225000 },
  { tier: 5, commissionPercentage: 80, minGci: 225000, maxGci: 310000, nextTierGci: 310000 },
  { tier: 6, commissionPercentage: 84, minGci: 310000, maxGci: 400000, nextTierGci: 400000 },
  { tier: 7, commissionPercentage: 88, minGci: 400000, maxGci: 500000, nextTierGci: 500000 },
  { tier: 8, commissionPercentage: 90, minGci: 500000, maxGci: 650000, nextTierGci: 650000 },
  { tier: 9, commissionPercentage: 92, minGci: 650000, maxGci: null, nextTierGci: null },
];

/**
 * Calculate agent tier information based on GCI YTD amount
 * @param gciYtd GCI Year-to-Date amount
 * @returns TierInfo object containing tier details
 */
export function calculateTierInfo(gciYtd: number): TierInfo {
  // Find the tier where the GCI falls within the min and max range
  const tierInfo = TIER_THRESHOLDS.find(
    (tier) => gciYtd >= tier.minGci && (tier.maxGci === null || gciYtd < tier.maxGci)
  );
  
  return tierInfo || TIER_THRESHOLDS[0]; // Default to Tier 1 if not found
}

/**
 * Calculate progress percentage towards next tier
 * @param gciYtd GCI Year-to-Date amount
 * @param tierInfo Current tier information
 * @returns Progress percentage (0-100)
 */
export function calculateTierProgress(gciYtd: number, tierInfo: TierInfo): number {
  // If at max tier or no next tier threshold, return 100%
  if (tierInfo.nextTierGci === null) return 100;
  
  // Calculate progress within current tier
  const tierRange = tierInfo.nextTierGci - tierInfo.minGci;
  const progress = gciYtd - tierInfo.minGci;
  
  // Calculate percentage (capped at 100%)
  const percentage = Math.min((progress / tierRange) * 100, 100);
  
  return Math.max(0, percentage);
}

/**
 * Get the GCI amount needed to reach the next tier
 * @param gciYtd GCI Year-to-Date amount
 * @param tierInfo Current tier information
 * @returns GCI amount needed or 0 if at max tier
 */
export function getGciToNextTier(gciYtd: number, tierInfo: TierInfo): number {
  // If at max tier or no next tier threshold, return 0
  if (tierInfo.nextTierGci === null) return 0;
  
  // Calculate remaining GCI needed
  return Math.max(0, tierInfo.nextTierGci - gciYtd);
}

/**
 * Format currency amounts in USD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}