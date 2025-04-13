import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { 
  Agent, AgentWithDownline, Transaction, RevenueShare, User,
  InsertAgent, InsertTransaction, InsertRevenueShare, InsertUser,
  agents, transactions, revenueShares, users
} from '../shared/schema';
import { IStorage } from './storage';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import {
  calculateCommission,
  calculateCompanyGCI,
  calculateAgentShare,
  calculateMaxAnnualRevenueShare,
  calculateRemainingAllowance
} from '../client/src/utils/calculators';

/**
 * Implementation of the storage interface using PostgreSQL database
 */
export class DatabaseStorage implements IStorage {
  // Agent operations
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(agents.name);
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.id, id));
    return result.length ? result[0] : undefined;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const result = await db.insert(agents).values(insertAgent).returning();
    return result[0];
  }

  async updateAgent(id: number, agentUpdate: Partial<Agent>): Promise<Agent | undefined> {
    const result = await db
      .update(agents)
      .set(agentUpdate)
      .where(eq(agents.id, id))
      .returning();
    
    return result.length ? result[0] : undefined;
  }

  async deleteAgent(id: number): Promise<boolean> {
    try {
      // Check if agent has transactions or revenue shares
      const agentTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.agentId, id));
      
      const recipientShares = await db
        .select()
        .from(revenueShares)
        .where(eq(revenueShares.recipientAgentId, id));
      
      const sourceShares = await db
        .select()
        .from(revenueShares)
        .where(eq(revenueShares.sourceAgentId, id));
      
      // If agent has related records, don't delete
      if (agentTransactions.length > 0 || recipientShares.length > 0 || sourceShares.length > 0) {
        return false;
      }
      
      // Check if agent has downline
      const downlineAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.sponsorId, id));
      
      if (downlineAgents.length > 0) {
        return false;
      }
      
      // Delete the agent
      await db.delete(agents).where(eq(agents.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting agent:', error);
      return false;
    }
  }

  async getAgentWithDownline(id: number): Promise<AgentWithDownline | undefined> {
    const agent = await this.getAgent(id);
    if (!agent) return undefined;
    
    const agentWithDownline: AgentWithDownline = { ...agent };
    
    // Get direct downline
    agentWithDownline.downline = await this.getDirectDownline(id);
    
    // Get sponsor
    if (agent.sponsorId) {
      agentWithDownline.sponsor = await this.getAgent(agent.sponsorId);
    }
    
    // Calculate total earnings
    agentWithDownline.totalEarnings = await this.calculateTotalEarnings(id);
    
    return agentWithDownline;
  }

  async getAgentsWithDownline(): Promise<AgentWithDownline[]> {
    const allAgents = await this.getAgents();
    const result: AgentWithDownline[] = [];
    
    // Root level agents first (agents without sponsors)
    const rootAgents = allAgents.filter(agent => !agent.sponsorId);
    
    for (const agent of rootAgents) {
      const agentWithDownline = await this.getAgentWithDownline(agent.id);
      if (agentWithDownline) {
        result.push(agentWithDownline);
      }
    }
    
    return result;
  }

  async getAgentsByRootLevelOnly(): Promise<Agent[]> {
    return await db
      .select()
      .from(agents)
      .where(sql`${agents.sponsorId} IS NULL`)
      .orderBy(agents.name);
  }

  private async getDirectDownline(agentId: number): Promise<AgentWithDownline[]> {
    // Find direct downline
    const downlineAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.sponsorId, agentId))
      .orderBy(agents.name);
    
    const result: AgentWithDownline[] = [];
    
    // Recursively get their downlines
    for (const agent of downlineAgents) {
      const agentWithDownline: AgentWithDownline = { ...agent };
      agentWithDownline.downline = await this.getDirectDownline(agent.id);
      agentWithDownline.totalEarnings = await this.calculateTotalEarnings(agent.id);
      result.push(agentWithDownline);
    }
    
    return result;
  }

  private async calculateTotalEarnings(agentId: number): Promise<number> {
    const shares = await db
      .select()
      .from(revenueShares)
      .where(eq(revenueShares.recipientAgentId, agentId));
    
    return shares.reduce((sum, share) => sum + Number(share.amount), 0);
  }

  // Transaction operations
  async getTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.transactionDate));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result.length ? result[0] : undefined;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      console.log("Creating transaction:", JSON.stringify(insertTransaction));
      
      // Make sure we have a valid date object
      const transactionToInsert = {
        ...insertTransaction,
        transactionDate: new Date(insertTransaction.transactionDate)
      };
      
      // Insert into database
      const result = await db.insert(transactions).values(transactionToInsert).returning();
      const transaction = result[0];
      
      console.log("Transaction created successfully:", JSON.stringify(transaction));
      
      // Process revenue shares for this transaction
      await this.processRevenueShare(transaction);
      
      return transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  async updateTransaction(id: number, transactionUpdate: Partial<Transaction>): Promise<Transaction | undefined> {
    try {
      // Get the current transaction
      const existingTransaction = await this.getTransaction(id);
      if (!existingTransaction) return undefined;
      
      // Save old companyGCI for comparison
      const oldCompanyGCI = existingTransaction.companyGCI;
      
      // Format date if provided
      let updatedValues: any = { ...transactionUpdate };
      if (updatedValues.transactionDate && typeof updatedValues.transactionDate === 'string') {
        updatedValues.transactionDate = new Date(updatedValues.transactionDate);
      }
      
      // Update transaction in database
      const [updatedTransaction] = await db
        .update(transactions)
        .set(updatedValues)
        .where(eq(transactions.id, id))
        .returning();
      
      // If companyGCI has changed, update revenue shares
      if (oldCompanyGCI !== updatedTransaction.companyGCI) {
        // Delete old revenue shares
        await db
          .delete(revenueShares)
          .where(eq(revenueShares.transactionId, id));
        
        // Process new revenue shares
        await this.processRevenueShare(updatedTransaction);
      }
      
      return updatedTransaction;
    } catch (error) {
      console.error("Error updating transaction:", error);
      return undefined;
    }
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    try {
      // Delete associated revenue shares first
      await db
        .delete(revenueShares)
        .where(eq(revenueShares.transactionId, id));
      
      // Delete the transaction
      const result = await db
        .delete(transactions)
        .where(eq(transactions.id, id))
        .returning({ id: transactions.id });
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return false;
    }
  }
  
  async getAgentTransactions(agentId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.agentId, agentId))
      .orderBy(desc(transactions.transactionDate));
  }

  private async processRevenueShare(transaction: Transaction): Promise<void> {
    // Get agent
    const agent = await this.getAgent(transaction.agentId);
    if (!agent) return;
    
    // Get sponsor chain (up to 5 levels)
    const sponsorChain = await this.getSponsorChain(transaction.agentId, 5);
    
    // No sponsors, no revenue share
    if (sponsorChain.length === 0) return;
    
    // Calculate revenue share for each sponsor
    for (let tier = 0; tier < sponsorChain.length; tier++) {
      const sponsorId = sponsorChain[tier];
      const sponsor = await this.getAgent(sponsorId);
      if (!sponsor) continue;
      
      // Calculate revenue share amount based on agent type
      let revenueShareAmount = 0;
      const tierLevel = tier + 1;
      
      if (sponsor.agentType === 'principal') {
        revenueShareAmount = Number(transaction.companyGCI) * 0.125; // 12.5% for principal agent
      } else {
        revenueShareAmount = Number(transaction.companyGCI) * 0.02; // 2% for support agent
      }
      
      // Check annual cap
      const maxAnnualShare = calculateMaxAnnualRevenueShare(sponsor);
      if (maxAnnualShare > 0) {
        // Calculate how much sponsor has received from this agent this year
        const yearStart = new Date();
        yearStart.setMonth(0, 1); // January 1st of current year
        
        const totalPaidThisYear = await this.getTotalPaidToSponsor(sponsorId, transaction.agentId);
        const remainingAllowance = calculateRemainingAllowance(maxAnnualShare, totalPaidThisYear);
        
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
          tier: tierLevel
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
    // Get current year
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1); // January 1st of current year
    
    const shares = await db
      .select()
      .from(revenueShares)
      .where(
        and(
          eq(revenueShares.recipientAgentId, sponsorId),
          eq(revenueShares.sourceAgentId, agentId),
          sql`${revenueShares.createdAt} >= ${startOfYear.toISOString()}`
        )
      );
    
    return shares.reduce((sum, share) => sum + Number(share.amount), 0);
  }

  // Revenue share operations
  async getRevenueShares(): Promise<RevenueShare[]> {
    return await db
      .select()
      .from(revenueShares)
      .orderBy(desc(revenueShares.createdAt));
  }

  async getRevenueSharesByTransaction(transactionId: number): Promise<RevenueShare[]> {
    return await db
      .select()
      .from(revenueShares)
      .where(eq(revenueShares.transactionId, transactionId))
      .orderBy(revenueShares.tier);
  }

  async getRevenueSharesByAgent(agentId: number): Promise<RevenueShare[]> {
    return await db
      .select()
      .from(revenueShares)
      .where(
        sql`${revenueShares.recipientAgentId} = ${agentId} OR ${revenueShares.sourceAgentId} = ${agentId}`
      )
      .orderBy(desc(revenueShares.createdAt));
  }

  async createRevenueShare(insertRevenueShare: InsertRevenueShare): Promise<RevenueShare> {
    const result = await db.insert(revenueShares).values(insertRevenueShare).returning();
    return result[0];
  }
}