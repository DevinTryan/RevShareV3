import { 
  Agent, InsertAgent, AgentType, CapType,
  Transaction, InsertTransaction,
  RevenueShare, InsertRevenueShare,
  AgentWithDownline,
  User, InsertUser
} from "@shared/schema";
import session from "express-session";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // Agent operations
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;
  getAgentWithDownline(id: number): Promise<AgentWithDownline | undefined>;
  getAgentsWithDownline(): Promise<AgentWithDownline[]>;
  getAgentsByRootLevelOnly(): Promise<Agent[]>;
  
  // Transaction operations
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;
  getAgentTransactions(agentId: number): Promise<Transaction[]>;
  
  // Revenue share operations
  getRevenueShares(): Promise<RevenueShare[]>;
  getRevenueSharesByTransaction(transactionId: number): Promise<RevenueShare[]>;
  getRevenueSharesByAgent(agentId: number): Promise<RevenueShare[]>;
  createRevenueShare(revenueShare: InsertRevenueShare): Promise<RevenueShare>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAgentUser(agentId: number): Promise<User | undefined>;
  
  // Reports operations
  getFilteredTransactions(filters: any): Promise<Transaction[]>;
  getAgentPerformanceReport(filters: any): Promise<any[]>;
  getLeadSourceReport(filters: any): Promise<any[]>;
  getIncomeDistributionReport(filters: any): Promise<any>;
  getZipCodeAnalysisReport(filters: any): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private agents: Map<number, Agent>;
  private transactions: Map<number, Transaction>;
  private revenueShares: Map<number, RevenueShare>;
  private users: Map<number, User>;
  private agentIdCounter: number;
  private transactionIdCounter: number;
  private revenueShareIdCounter: number;
  private userIdCounter: number;
  public sessionStore: session.Store;

  constructor() {
    this.agents = new Map();
    this.transactions = new Map();
    this.revenueShares = new Map();
    this.users = new Map();
    this.agentIdCounter = 1;
    this.transactionIdCounter = 1;
    this.revenueShareIdCounter = 1;
    this.userIdCounter = 1;
    
    // Create memory store for session
    const MemoryStore = require('memorystore')(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // Agent operations
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = this.agentIdCounter++;
    const now = new Date();
    const agent: Agent = { 
      id, 
      ...insertAgent,
      currentCap: 0,
      createdAt: now 
    };
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(id: number, agentUpdate: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    const updatedAgent = { ...agent, ...agentUpdate };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: number): Promise<boolean> {
    return this.agents.delete(id);
  }

  async getAgentWithDownline(id: number): Promise<AgentWithDownline | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;

    const agentWithDownline: AgentWithDownline = { ...agent };
    
    // Get sponsor if exists
    if (agent.sponsorId) {
      agentWithDownline.sponsor = this.agents.get(agent.sponsorId);
    }
    
    // Get direct downline
    agentWithDownline.downline = await this.getDirectDownline(id);
    
    // Calculate total earnings
    agentWithDownline.totalEarnings = await this.calculateTotalEarnings(id);
    
    return agentWithDownline;
  }

  async getAgentsWithDownline(): Promise<AgentWithDownline[]> {
    const agents = Array.from(this.agents.values());
    const agentsWithDownline: AgentWithDownline[] = [];
    
    for (const agent of agents) {
      const agentWithDownline = await this.getAgentWithDownline(agent.id);
      if (agentWithDownline) {
        agentsWithDownline.push(agentWithDownline);
      }
    }
    
    return agentsWithDownline;
  }

  async getAgentsByRootLevelOnly(): Promise<Agent[]> {
    const agents = Array.from(this.agents.values());
    return agents.filter(agent => agent.sponsorId === null || agent.sponsorId === undefined);
  }

  private async getDirectDownline(agentId: number): Promise<AgentWithDownline[]> {
    const agents = Array.from(this.agents.values());
    const directDownline = agents.filter(agent => agent.sponsorId === agentId);
    
    const downlineWithRecursion: AgentWithDownline[] = [];
    
    for (const agent of directDownline) {
      const agentWithDownline: AgentWithDownline = { ...agent };
      agentWithDownline.downline = await this.getDirectDownline(agent.id);
      agentWithDownline.totalEarnings = await this.calculateTotalEarnings(agent.id);
      downlineWithRecursion.push(agentWithDownline);
    }
    
    return downlineWithRecursion;
  }

  private async calculateTotalEarnings(agentId: number): Promise<number> {
    const revenueShares = Array.from(this.revenueShares.values());
    const agentShares = revenueShares.filter(share => share.sponsorId === agentId);
    
    if (agentShares.length === 0) return 0;
    
    const total = agentShares.reduce((sum, share) => sum + share.amount, 0);
    return total;
  }

  // Transaction operations
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const now = new Date();
    
    // Calculate company GCI (15% of total commission)
    const totalCommission = insertTransaction.saleAmount * (insertTransaction.commissionPercentage / 100);
    const companyGCI = totalCommission * 0.15;
    
    const transaction: Transaction = {
      id,
      ...insertTransaction,
      companyGCI,
      createdAt: now
    };
    
    this.transactions.set(id, transaction);
    
    // Process revenue share after creating transaction
    await this.processRevenueShare(transaction);
    
    return transaction;
  }

  async updateTransaction(id: number, transactionUpdate: Partial<Transaction>): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    // Save old companyGCI value for comparison
    const oldCompanyGCI = transaction.companyGCI;
    
    const updatedTransaction = { ...transaction, ...transactionUpdate };
    this.transactions.set(id, updatedTransaction);
    
    // If companyGCI has changed, we need to update revenue shares
    if (oldCompanyGCI !== updatedTransaction.companyGCI) {
      // First, delete old revenue shares for this transaction
      const revenueShares = Array.from(this.revenueShares.values());
      const transactionShares = revenueShares.filter(share => share.transactionId === id);
      
      for (const share of transactionShares) {
        this.revenueShares.delete(share.id);
      }
      
      // Then process new revenue shares
      await this.processRevenueShare(updatedTransaction);
    }
    
    return updatedTransaction;
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    const transaction = this.transactions.get(id);
    if (!transaction) return false;
    
    // Delete all revenue shares associated with this transaction
    const revenueShares = Array.from(this.revenueShares.values());
    const transactionShares = revenueShares.filter(share => share.transactionId === id);
    
    for (const share of transactionShares) {
      this.revenueShares.delete(share.id);
    }
    
    // Delete the transaction
    return this.transactions.delete(id);
  }
  
  async getAgentTransactions(agentId: number): Promise<Transaction[]> {
    const transactions = Array.from(this.transactions.values());
    return transactions.filter(transaction => transaction.agentId === agentId);
  }

  private async processRevenueShare(transaction: Transaction): Promise<void> {
    const agent = await this.getAgent(transaction.agentId);
    if (!agent) return;
    
    // Get upline sponsors up to 5 levels
    const sponsorChain = await this.getSponsorChain(agent.id, 5);
    
    // Process each sponsor
    for (let i = 0; i < sponsorChain.length; i++) {
      const sponsorId = sponsorChain[i];
      const sponsor = await this.getAgent(sponsorId);
      if (!sponsor) continue;
      
      const tier = i + 1; // Tier level (1-5)
      
      // Calculate revenue share amount based on agent type
      let revenueShareAmount = 0;
      
      if (sponsor.agentType === AgentType.PRINCIPAL) {
        // Principal agent: 12.5% of company GCI
        revenueShareAmount = transaction.companyGCI * 0.125;
        
        // Check cap limits
        let maxAnnualPayout = 2000;
        if (sponsor.capType === CapType.TEAM) {
          maxAnnualPayout = 1000;
        }
        
        // Ensure revenue share doesn't exceed annual limit
        const totalPaidToSponsor = await this.getTotalPaidToSponsor(sponsorId, agent.id);
        const remainingAllowance = maxAnnualPayout - totalPaidToSponsor;
        
        if (remainingAllowance <= 0) {
          revenueShareAmount = 0;
        } else if (revenueShareAmount > remainingAllowance) {
          revenueShareAmount = remainingAllowance;
        }
      } else if (sponsor.agentType === AgentType.SUPPORT) {
        // Support agent: 2% of company GCI
        revenueShareAmount = transaction.companyGCI * 0.02;
        
        // Max $2,000 per year per agent
        const maxAnnualPayout = 2000;
        const totalPaidToSponsor = await this.getTotalPaidToSponsor(sponsorId, agent.id);
        const remainingAllowance = maxAnnualPayout - totalPaidToSponsor;
        
        if (remainingAllowance <= 0) {
          revenueShareAmount = 0;
        } else if (revenueShareAmount > remainingAllowance) {
          revenueShareAmount = remainingAllowance;
        }
      }
      
      // Create revenue share record if amount > 0
      if (revenueShareAmount > 0) {
        const revenueShare: InsertRevenueShare = {
          transactionId: transaction.id,
          sourceAgentId: transaction.agentId,
          recipientAgentId: sponsorId,
          amount: revenueShareAmount,
          tier
        };
        
        await this.createRevenueShare(revenueShare);
      }
    }
  }

  private async getSponsorChain(agentId: number, maxLevels: number): Promise<number[]> {
    const sponsorChain: number[] = [];
    let currentAgentId = agentId;
    let level = 0;
    
    while (level < maxLevels) {
      const currentAgent = await this.getAgent(currentAgentId);
      if (!currentAgent || !currentAgent.sponsorId) break;
      
      sponsorChain.push(currentAgent.sponsorId);
      currentAgentId = currentAgent.sponsorId;
      level++;
    }
    
    return sponsorChain;
  }

  private async getTotalPaidToSponsor(sponsorId: number, agentId: number): Promise<number> {
    const revenueShares = Array.from(this.revenueShares.values());
    const relevantShares = revenueShares.filter(share => 
      share.recipientAgentId === sponsorId && 
      share.sourceAgentId === agentId
    );
    
    if (relevantShares.length === 0) return 0;
    
    const total = relevantShares.reduce((sum, share) => sum + share.amount, 0);
    return total;
  }

  private isFromAgent(transactionId: number, agentId: number): boolean {
    const transaction = this.transactions.get(transactionId);
    return transaction?.agentId === agentId;
  }

  // Revenue share operations
  async getRevenueShares(): Promise<RevenueShare[]> {
    return Array.from(this.revenueShares.values());
  }

  async getRevenueSharesByTransaction(transactionId: number): Promise<RevenueShare[]> {
    const revenueShares = Array.from(this.revenueShares.values());
    return revenueShares.filter(share => share.transactionId === transactionId);
  }

  async getRevenueSharesByAgent(agentId: number): Promise<RevenueShare[]> {
    const revenueShares = Array.from(this.revenueShares.values());
    return revenueShares.filter(share => share.recipientAgentId === agentId || share.sourceAgentId === agentId);
  }

  async createRevenueShare(insertRevenueShare: InsertRevenueShare): Promise<RevenueShare> {
    const id = this.revenueShareIdCounter++;
    const now = new Date();
    
    const revenueShare: RevenueShare = {
      id,
      ...insertRevenueShare,
      createdAt: now
    };
    
    this.revenueShares.set(id, revenueShare);
    return revenueShare;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    
    const user: User = {
      id,
      ...insertUser,
      createdAt: now,
      lastLogin: null,
      resetToken: null,
      resetTokenExpiry: null
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userUpdate };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.email === email);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.resetToken === token);
  }

  async getAgentUser(agentId: number): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.agentId === agentId);
  }

  // Reports operations
  async getFilteredTransactions(filters: any): Promise<Transaction[]> {
    let transactions = Array.from(this.transactions.values());
    
    // Apply date range filter
    if (filters.dateRange) {
      transactions = transactions.filter(transaction => {
        const txDate = new Date(transaction.transactionDate);
        return txDate >= filters.dateRange.start && txDate <= filters.dateRange.end;
      });
    }
    
    // Apply agent filter
    if (filters.agentId) {
      transactions = transactions.filter(transaction => transaction.agentId === filters.agentId);
    }
    
    // Apply transaction type filter
    if (filters.transactionType) {
      transactions = transactions.filter(transaction => transaction.transactionType === filters.transactionType);
    }
    
    // Apply lead source filter
    if (filters.leadSource) {
      transactions = transactions.filter(transaction => transaction.leadSource === filters.leadSource);
    }
    
    // Apply address filter
    if (filters.address) {
      const addressLower = filters.address.toLowerCase();
      transactions = transactions.filter(transaction => 
        transaction.propertyAddress?.toLowerCase().includes(addressLower)
      );
    }
    
    // Apply zip code filter
    if (filters.zipCode) {
      const zipCodeStr = filters.zipCode.toString();
      transactions = transactions.filter(transaction => 
        transaction.propertyAddress?.includes(zipCodeStr)
      );
    }
    
    // Apply sale amount range filters
    if (filters.minSaleAmount) {
      transactions = transactions.filter(transaction => 
        transaction.saleAmount >= filters.minSaleAmount
      );
    }
    
    if (filters.maxSaleAmount) {
      transactions = transactions.filter(transaction => 
        transaction.saleAmount <= filters.maxSaleAmount
      );
    }
    
    // Sort by transaction date (newest first)
    transactions.sort((a, b) => 
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );
    
    return transactions;
  }

  async getAgentPerformanceReport(filters: any): Promise<any[]> {
    const agents = Array.from(this.agents.values());
    const transactions = await this.getFilteredTransactions(filters);
    
    return agents.map(agent => {
      const agentTransactions = transactions.filter(tx => tx.agentId === agent.id);
      
      const totalVolume = agentTransactions.reduce((sum, tx) => sum + tx.saleAmount, 0);
      const totalGCI = agentTransactions.reduce((sum, tx) => sum + tx.companyGCI, 0);
      const totalAgentIncome = agentTransactions.reduce((sum, tx) => sum + (tx.agentCommissionAmount || 0), 0);
      const totalCompanyIncome = totalGCI - totalAgentIncome;
      const averageSalePrice = agentTransactions.length > 0 
        ? totalVolume / agentTransactions.length 
        : 0;
      
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        transactionCount: agentTransactions.length,
        totalVolume,
        totalGCI,
        totalAgentIncome,
        totalCompanyIncome,
        averageSalePrice
      };
    }).sort((a, b) => b.totalVolume - a.totalVolume);
  }

  async getLeadSourceReport(filters: any): Promise<any[]> {
    const transactions = await this.getFilteredTransactions(filters);
    const leadSourceMap = new Map<string, any>();
    
    // Group transactions by lead source
    transactions.forEach(tx => {
      const leadSource = tx.leadSource || 'unknown';
      
      if (!leadSourceMap.has(leadSource)) {
        leadSourceMap.set(leadSource, {
          leadSource,
          transactions: [],
          transactionCount: 0,
          totalVolume: 0,
          totalGCI: 0,
          totalAgentIncome: 0,
          totalCompanyIncome: 0,
          averageSalePrice: 0
        });
      }
      
      const leadSourceData = leadSourceMap.get(leadSource);
      leadSourceData.transactions.push(tx);
    });
    
    // Calculate metrics for each lead source
    const result = Array.from(leadSourceMap.values()).map(data => {
      const { transactions } = data;
      
      data.transactionCount = transactions.length;
      data.totalVolume = transactions.reduce((sum, tx) => sum + tx.saleAmount, 0);
      data.totalGCI = transactions.reduce((sum, tx) => sum + tx.companyGCI, 0);
      data.totalAgentIncome = transactions.reduce((sum, tx) => sum + (tx.agentCommissionAmount || 0), 0);
      data.totalCompanyIncome = data.totalGCI - data.totalAgentIncome;
      data.averageSalePrice = data.transactionCount > 0 
        ? data.totalVolume / data.transactionCount 
        : 0;
      
      // Remove transactions array from result
      delete data.transactions;
      
      return data;
    });
    
    // Sort by transaction count (highest first)
    return result.sort((a, b) => b.transactionCount - a.transactionCount);
  }

  async getIncomeDistributionReport(filters: any): Promise<any> {
    const transactions = await this.getFilteredTransactions(filters);
    
    const totalGCI = transactions.reduce((sum, tx) => sum + tx.companyGCI, 0);
    const totalAgentIncome = transactions.reduce((sum, tx) => sum + (tx.agentCommissionAmount || 0), 0);
    const totalCompanyIncome = totalGCI - totalAgentIncome;
    const totalShowingAgentFees = transactions.reduce((sum, tx) => sum + (tx.showingAgentFee || 0), 0);
    const totalReferralFees = transactions.reduce((sum, tx) => sum + (tx.referralAmount || 0), 0);
    
    // Count unique agents
    const uniqueAgentIds = new Set(transactions.map(tx => tx.agentId));
    
    return {
      totalGCI,
      totalAgentIncome,
      totalCompanyIncome,
      totalShowingAgentFees,
      totalReferralFees,
      activeAgentCount: uniqueAgentIds.size,
      transactionCount: transactions.length
    };
  }

  async getZipCodeAnalysisReport(filters: any): Promise<any[]> {
    const transactions = await this.getFilteredTransactions(filters);
    const zipCodeMap = new Map<string, any>();
    
    // Extract zip codes and group transactions
    transactions.forEach(tx => {
      const address = tx.propertyAddress || '';
      // Try to extract zip code using regex
      const zipCodeMatch = address.match(/\d{5}/);
      const zipCode = zipCodeMatch ? zipCodeMatch[0] : 'Unknown';
      
      if (!zipCodeMap.has(zipCode)) {
        zipCodeMap.set(zipCode, {
          zipCode,
          transactions: [],
          transactionCount: 0,
          totalVolume: 0,
          totalGCI: 0,
          totalAgentIncome: 0,
          totalCompanyIncome: 0,
          averageSalePrice: 0
        });
      }
      
      const zipCodeData = zipCodeMap.get(zipCode);
      zipCodeData.transactions.push(tx);
    });
    
    // Calculate metrics for each zip code
    const result = Array.from(zipCodeMap.values()).map(data => {
      const { transactions } = data;
      
      data.transactionCount = transactions.length;
      data.totalVolume = transactions.reduce((sum, tx) => sum + tx.saleAmount, 0);
      data.totalGCI = transactions.reduce((sum, tx) => sum + tx.companyGCI, 0);
      data.totalAgentIncome = transactions.reduce((sum, tx) => sum + (tx.agentCommissionAmount || 0), 0);
      data.totalCompanyIncome = data.totalGCI - data.totalAgentIncome;
      data.averageSalePrice = data.transactionCount > 0 
        ? data.totalVolume / data.transactionCount 
        : 0;
      
      // Remove transactions array from result
      delete data.transactions;
      
      return data;
    });
    
    // Sort by transaction count (highest first)
    return result.sort((a, b) => b.transactionCount - a.transactionCount);
  }
}

// Import database storage
import { DatabaseStorage } from './database-storage';

// Determine which storage to use based on environment
let storage: IStorage;

// Check if DATABASE_URL exists to determine if we should use database storage
if (process.env.DATABASE_URL) {
  console.log('Using database storage');
  storage = new DatabaseStorage();
} else {
  console.log('Using memory storage');
  storage = new MemStorage();
}

export { storage };
