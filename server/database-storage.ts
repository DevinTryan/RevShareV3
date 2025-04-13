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
  public sessionStore: session.Store;
  
  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }
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
    try {
      const result = await db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.transactionDate));
      
      return result;
    } catch (error) {
      console.error("Error retrieving transactions:", error);
      // Return empty array instead of throwing an error
      return [];
    }
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    try {
      const result = await db.select().from(transactions).where(eq(transactions.id, id));
      return result.length ? result[0] : undefined;
    } catch (error) {
      console.error("Error retrieving transaction:", error);
      return undefined;
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      console.log("Creating transaction:", JSON.stringify(insertTransaction));
      
      // Extract only the fields that exist in the database
      const {
        agentId,
        propertyAddress,
        saleAmount,
        commissionPercentage,
        companyGCI,
        transactionDate,
        transactionType,
        leadSource,
        isCompanyProvided,
        isSelfGenerated,
        referralPercentage,
        referralAmount,
        showingAgentId,
        showingAgentFee,
        agentCommissionPercentage,
        agentCommissionAmount,
        clientName
      } = insertTransaction;
      
      // Create an object with only the existing fields
      const transactionToInsert = {
        agentId,
        propertyAddress,
        saleAmount,
        commissionPercentage,
        companyGCI,
        transactionDate: new Date(transactionDate),
        transactionType,
        leadSource,
        isCompanyProvided,
        isSelfGenerated,
        referralPercentage,
        referralAmount,
        showingAgentId,
        showingAgentFee,
        agentCommissionPercentage,
        agentCommissionAmount,
        clientName
      };
      
      console.log("Sanitized transaction to insert:", JSON.stringify(transactionToInsert));
      
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
      
      // Filter update object to only include fields that exist in the database
      const allowedFields = [
        'agentId', 'propertyAddress', 'saleAmount', 'commissionPercentage', 
        'companyGCI', 'transactionDate', 'transactionType', 'leadSource',
        'isCompanyProvided', 'isSelfGenerated', 'agentCommissionPercentage',
        'agentCommissionAmount', 'clientName', 'referralPercentage', 'referralAmount',
        'showingAgentId', 'showingAgentFee'
      ];
      
      let filteredUpdate: any = {};
      Object.keys(transactionUpdate).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdate[key] = transactionUpdate[key as keyof typeof transactionUpdate];
        }
      });
      
      // Format date if provided
      if (filteredUpdate.transactionDate && typeof filteredUpdate.transactionDate === 'string') {
        filteredUpdate.transactionDate = new Date(filteredUpdate.transactionDate);
      }
      
      console.log("Updating transaction with filtered values:", JSON.stringify(filteredUpdate));
      
      // Update transaction in database
      const [updatedTransaction] = await db
        .update(transactions)
        .set(filteredUpdate)
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
    try {
      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.agentId, agentId))
        .orderBy(desc(transactions.transactionDate));
      
      return result;
    } catch (error) {
      console.error("Error retrieving agent transactions:", error);
      return [];
    }
  }

  private async processRevenueShare(transaction: Transaction): Promise<void> {
    try {
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
        
        // Check annual cap - using try/catch to handle potential errors with utility functions
        try {
          // Safely calculate max annual share with fallback
          let maxAnnualShare = 2000; // Default fallback value
          try {
            if (typeof calculateMaxAnnualRevenueShare === 'function') {
              maxAnnualShare = calculateMaxAnnualRevenueShare(sponsor);
            }
          } catch (err) {
            console.log("Error calculating max annual share, using default:", err);
          }
          
          if (maxAnnualShare > 0) {
            // Calculate how much sponsor has received from this agent this year
            const yearStart = new Date();
            yearStart.setMonth(0, 1); // January 1st of current year
            
            const totalPaidThisYear = await this.getTotalPaidToSponsor(sponsorId, transaction.agentId);
            
            // Safely calculate remaining allowance with fallback
            let remainingAllowance = maxAnnualShare - totalPaidThisYear;
            try {
              if (typeof calculateRemainingAllowance === 'function') {
                remainingAllowance = calculateRemainingAllowance(maxAnnualShare, totalPaidThisYear);
              }
            } catch (err) {
              console.log("Error calculating remaining allowance, using simple calculation:", err);
            }
            
            if (remainingAllowance <= 0) {
              revenueShareAmount = 0;
            } else if (revenueShareAmount > remainingAllowance) {
              revenueShareAmount = remainingAllowance;
            }
          }
        } catch (err) {
          console.error("Error processing revenue share caps:", err);
          // Continue with the calculated amount without applying caps
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
    } catch (error) {
      console.error("Error processing revenue share:", error);
      // Don't throw the error so transaction creation can still succeed
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
    try {
      const result = await db
        .select()
        .from(revenueShares)
        .orderBy(desc(revenueShares.createdAt));
      
      return result;
    } catch (error) {
      console.error("Error retrieving revenue shares:", error);
      return [];
    }
  }

  async getRevenueSharesByTransaction(transactionId: number): Promise<RevenueShare[]> {
    try {
      const result = await db
        .select()
        .from(revenueShares)
        .where(eq(revenueShares.transactionId, transactionId))
        .orderBy(revenueShares.tier);
      
      return result;
    } catch (error) {
      console.error("Error retrieving transaction revenue shares:", error);
      return [];
    }
  }

  async getRevenueSharesByAgent(agentId: number): Promise<RevenueShare[]> {
    try {
      const result = await db
        .select()
        .from(revenueShares)
        .where(
          sql`${revenueShares.recipientAgentId} = ${agentId} OR ${revenueShares.sourceAgentId} = ${agentId}`
        )
        .orderBy(desc(revenueShares.createdAt));
      
      return result;
    } catch (error) {
      console.error("Error retrieving agent revenue shares:", error);
      return [];
    }
  }

  async createRevenueShare(insertRevenueShare: InsertRevenueShare): Promise<RevenueShare> {
    const result = await db.insert(revenueShares).values(insertRevenueShare).returning();
    return result[0];
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length ? result[0] : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, id))
      .returning();
    
    return result.length ? result[0] : undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result.length ? result[0] : undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token),
          sql`${users.resetTokenExpiry} > NOW()`
        )
      );
    return result.length ? result[0] : undefined;
  }

  async getAgentUser(agentId: number): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.agentId, agentId));
    return result.length ? result[0] : undefined;
  }

  // Reports-related methods
  
  /**
   * Get filtered transactions based on various criteria
   */
  async getFilteredTransactions(filters: any): Promise<Transaction[]> {
    try {
      let query = db.select().from(transactions);
      
      // Apply date range filter
      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        
        query = query.where(
          and(
            sql`${transactions.transactionDate} >= ${startDate}`,
            sql`${transactions.transactionDate} <= ${endDate}`
          )
        );
      }
      
      // Apply agent filter
      if (filters.agentId) {
        query = query.where(eq(transactions.agentId, filters.agentId));
      }
      
      // Apply transaction type filter
      if (filters.transactionType) {
        query = query.where(eq(transactions.transactionType, filters.transactionType));
      }
      
      // Apply lead source filter
      if (filters.leadSource) {
        query = query.where(eq(transactions.leadSource, filters.leadSource));
      }
      
      // Apply address filter
      if (filters.address) {
        query = query.where(sql`${transactions.propertyAddress} ILIKE ${`%${filters.address}%`}`);
      }
      
      // Apply zip code filter
      if (filters.zipCode) {
        query = query.where(sql`${transactions.propertyAddress} ILIKE ${`%${filters.zipCode}%`}`);
      }
      
      // Apply sale amount range filters
      if (filters.minSaleAmount) {
        query = query.where(sql`${transactions.saleAmount} >= ${filters.minSaleAmount}`);
      }
      
      if (filters.maxSaleAmount) {
        query = query.where(sql`${transactions.saleAmount} <= ${filters.maxSaleAmount}`);
      }
      
      // Order by transaction date (newest first)
      query = query.orderBy(desc(transactions.transactionDate));
      
      return await query;
    } catch (error) {
      console.error("Error retrieving filtered transactions:", error);
      return [];
    }
  }

  /**
   * Get agent performance metrics (GCI, volume, transactions count, etc.)
   */
  async getAgentPerformanceReport(filters: any): Promise<any[]> {
    // Base query conditions
    const conditions = [];
    
    // Apply date range filter
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      conditions.push(sql`t.transaction_date >= ${startDate}`);
      conditions.push(sql`t.transaction_date <= ${endDate}`);
    }
    
    // Apply agent filter if specified
    if (filters.agentId) {
      conditions.push(sql`t.agent_id = ${filters.agentId}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Main query to get agent performance metrics
    const query = sql`
      SELECT 
        a.id AS "agentId",
        a.name AS "agentName",
        a.agent_type AS "agentType",
        COUNT(t.id) AS "transactionCount",
        SUM(t.sale_amount) AS "totalVolume",
        SUM(t.company_gci) AS "totalGCI",
        SUM(t.agent_commission_amount) AS "totalAgentIncome",
        SUM(t.company_gci) - SUM(COALESCE(t.agent_commission_amount, 0)) AS "totalCompanyIncome",
        AVG(t.sale_amount) AS "averageSalePrice"
      FROM agents a
      LEFT JOIN transactions t ON a.id = t.agent_id
      ${whereClause}
      GROUP BY a.id, a.name, a.agent_type
      ORDER BY "totalVolume" DESC
    `;
    
    return await db.execute(query);
  }

  /**
   * Get lead source performance metrics
   */
  async getLeadSourceReport(filters: any): Promise<any[]> {
    // Base query conditions
    const conditions = [];
    
    // Apply date range filter
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      conditions.push(sql`t.transaction_date >= ${startDate}`);
      conditions.push(sql`t.transaction_date <= ${endDate}`);
    }
    
    // Apply agent filter if specified
    if (filters.agentId) {
      conditions.push(sql`t.agent_id = ${filters.agentId}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Main query to get lead source performance metrics
    const query = sql`
      SELECT 
        COALESCE(t.lead_source, 'unknown') AS "leadSource",
        COUNT(t.id) AS "transactionCount",
        SUM(t.sale_amount) AS "totalVolume",
        SUM(t.company_gci) AS "totalGCI",
        SUM(t.agent_commission_amount) AS "totalAgentIncome",
        SUM(t.company_gci) - SUM(COALESCE(t.agent_commission_amount, 0)) AS "totalCompanyIncome",
        AVG(t.sale_amount) AS "averageSalePrice"
      FROM transactions t
      ${whereClause}
      GROUP BY t.lead_source
      ORDER BY "transactionCount" DESC
    `;
    
    return await db.execute(query);
  }

  /**
   * Get income distribution between agents and company
   */
  async getIncomeDistributionReport(filters: any): Promise<any> {
    // Base query conditions
    const conditions = [];
    
    // Apply date range filter
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      conditions.push(sql`t.transaction_date >= ${startDate}`);
      conditions.push(sql`t.transaction_date <= ${endDate}`);
    }
    
    // Apply agent filter if specified
    if (filters.agentId) {
      conditions.push(sql`t.agent_id = ${filters.agentId}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Main query to get income distribution metrics
    const query = sql`
      SELECT 
        SUM(t.company_gci) AS "totalGCI",
        SUM(t.agent_commission_amount) AS "totalAgentIncome",
        SUM(t.company_gci) - SUM(COALESCE(t.agent_commission_amount, 0)) AS "totalCompanyIncome",
        SUM(t.showing_agent_fee) AS "totalShowingAgentFees",
        SUM(t.referral_amount) AS "totalReferralFees",
        COUNT(DISTINCT t.agent_id) AS "activeAgentCount",
        COUNT(t.id) AS "transactionCount"
      FROM transactions t
      ${whereClause}
    `;
    
    const results = await db.execute(query);
    return results[0] || {};
  }

  /**
   * Get transaction analysis by zip code
   */
  async getZipCodeAnalysisReport(filters: any): Promise<any[]> {
    // Base query conditions
    const conditions = [];
    
    // Apply date range filter
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      conditions.push(sql`t.transaction_date >= ${startDate}`);
      conditions.push(sql`t.transaction_date <= ${endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    // Extract zip code from property address using regex
    const query = sql`
      WITH zipcode_extract AS (
        SELECT 
          t.*,
          SUBSTRING(t.property_address FROM '\\d{5}') AS zip_code
        FROM transactions t
        ${whereClause}
      )
      SELECT 
        COALESCE(zip_code, 'Unknown') AS "zipCode",
        COUNT(*) AS "transactionCount",
        SUM(sale_amount) AS "totalVolume",
        SUM(company_gci) AS "totalGCI",
        SUM(agent_commission_amount) AS "totalAgentIncome",
        SUM(company_gci) - SUM(COALESCE(agent_commission_amount, 0)) AS "totalCompanyIncome",
        AVG(sale_amount) AS "averageSalePrice"
      FROM zipcode_extract
      GROUP BY zip_code
      ORDER BY "transactionCount" DESC
    `;
    
    return await db.execute(query);
  }
}