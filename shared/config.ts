export const CONFIG = {
  revenueShare: {
    principalAgentPercentage: 12.5, // 12.5% of company GCI
    supportAgentPercentage: 2, // 2% of company GCI
    maxAnnualPayout: {
      team: 1000, // $1,000 for team cap
      standard: 2000 // $2,000 for standard cap
    }
  },
  commission: {
    complianceFee: 500, // $500 compliance fee
    principalAgentDefaultPercentage: 80, // Default for principal agents
    companyLead: {
      newAgentPercentage: 30, // 30% for first 3 sales
      experiencedAgentPercentage: 40 // 40% for 4+ sales
    }
  },
  supportAgentTiers: [
    { minGCI: 0, maxGCI: 40000, percentage: 50 },
    { minGCI: 40000, maxGCI: 80000, percentage: 60 },
    { minGCI: 80000, maxGCI: 150000, percentage: 70 },
    { minGCI: 150000, maxGCI: 225000, percentage: 75 },
    { minGCI: 225000, maxGCI: 310000, percentage: 80 },
    { minGCI: 310000, maxGCI: 400000, percentage: 84 },
    { minGCI: 400000, maxGCI: 500000, percentage: 88 },
    { minGCI: 500000, maxGCI: 650000, percentage: 90 },
    { minGCI: 650000, maxGCI: Infinity, percentage: 92 }
  ],
  validation: {
    maxSaleAmount: 1000000000, // $1 billion
    minSaleAmount: 10000 // $10,000
  }
} as const; 