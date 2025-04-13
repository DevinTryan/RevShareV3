import { 
  Agent, InsertAgent, AgentType, CapType,
  Transaction, InsertTransaction,
  RevenueShare, InsertRevenueShare,
  AgentWithDownline
} from "@shared/schema";

export interface IStorage {
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
}

export class MemStorage implements IStorage {
  private agents: Map<number, Agent>;
  private transactions: Map<number, Transaction>;
  private revenueShares: Map<number, RevenueShare>;
  private agentIdCounter: number;
  private transactionIdCounter: number;
  private revenueShareIdCounter: number;

  constructor() {
    this.agents = new Map();
    this.transactions = new Map();
    this.revenueShares = new Map();
    this.agentIdCounter = 1;
    this.transactionIdCounter = 1;
    this.revenueShareIdCounter = 1;
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
