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
      // Check only for revenue shares - transactions are allowed because we archive the agent name
      const recipientShares = await db
        .select()
        .from(revenueShares)
        .where(eq(revenueShares.recipientAgentId, id));
      
      const sourceShares = await db
        .select()
        .from(revenueShares)
        .where(eq(revenueShares.sourceAgentId, id));
      
      // If agent has revenue share records, don't delete
      if (recipientShares.length > 0 || sourceShares.length > 0) {
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
      // Use raw SQL to select only columns that exist in the database
      const sql = `
        SELECT 
          id, 
          agent_id as "agentId", 
          property_address as "propertyAddress", 
          sale_amount as "saleAmount", 
          commission_percentage as "commissionPercentage", 
          company_gci as "companyGCI", 
          transaction_date as "transactionDate", 
          created_at as "createdAt", 
          client_name as "clientName", 
          transaction_type as "transactionType", 
          lead_source as "leadSource", 
          is_company_provided as "isCompanyProvided", 
          is_self_generated as "isSelfGenerated", 
          referral_percentage as "referralPercentage", 
          referral_amount as "referralAmount", 
          showing_agent_id as "showingAgentId", 
          showing_agent_fee as "showingAgentFee", 
          agent_commission_amount as "agentCommissionAmount"
        FROM transactions
        ORDER BY transaction_date DESC
      `;
      
      const result = await db.execute(sql);
      return result as Transaction[];
    } catch (error) {
      console.error("Error retrieving transactions:", error);
      // Return empty array instead of throwing an error
      return [];
    }
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    try {
      // Use raw SQL to select all columns that exist in the database
      const sql = `
        SELECT 
          id, 
          agent_id as "agentId", 
          property_address as "propertyAddress", 
          sale_amount as "saleAmount", 
          commission_percentage as "commissionPercentage", 
          company_gci as "companyGCI", 
          transaction_date as "transactionDate", 
          created_at as "createdAt", 
          client_name as "clientName", 
          transaction_type as "transactionType", 
          lead_source as "leadSource", 
          is_company_provided as "isCompanyProvided", 
          is_self_generated as "isSelfGenerated", 
          referral_percentage as "referralPercentage", 
          referral_amount as "referralAmount", 
          showing_agent_id as "showingAgentId", 
          showing_agent_fee as "showingAgentFee", 
          agent_commission_amount as "agentCommissionAmount",
          source,
          company_name as "companyName",
          escrow_office as "escrowOffice",
          escrow_officer as "escrowOfficer",
          referrer,
          lender,
          seller_commission_percentage as "sellerCommissionPercentage",
          buyer_commission_percentage as "buyerCommissionPercentage",
          compliance_fee as "complianceFee",
          referral_fee as "referralFee",
          showing_agent as "showingAgent",
          team_agents_income as "teamAgentsIncome",
          personal_income as "personalIncome",
          actual_check_amount as "actualCheckAmount",
          manual_commission_amount as "manualCommissionAmount",
          additional_agent_id as "additionalAgentId",
          additional_agent_fee as "additionalAgentFee",
          additional_agent_percentage as "additionalAgentPercentage",
          agent_name_archived as "agentNameArchived",
          referral_type as "referralType",
          referral_agent_name as "referralAgentName",
          referral_brokerage_name as "referralBrokerageName",
          office_gross_commission as "officeGrossCommission",
          transaction_coordinator_fee as "transactionCoordinatorFee",
          compliance_fee_paid_by_client as "complianceFeePaidByClient",
          deposit_amount as "depositAmount",
          deposit_date as "depositDate",
          additional_agent_cost as "additionalAgentCost"
        FROM transactions
        WHERE id = $1
      `;
      
      const result = await db.execute(sql, [id]) as any[];
      return result.length ? result[0] as Transaction : undefined;
    } catch (error) {
      console.error("Error retrieving transaction:", error);
      return undefined;
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      console.log("Creating transaction:", JSON.stringify(insertTransaction));
      
      // Instead of using parameterized values, let's use a direct SQL query with interpolated values
      // This approach is typically not recommended for security reasons, but we're doing it
      // as a temporary fix for the parameter binding issue
      
      // Format date properly
      const formattedDate = new Date(insertTransaction.transactionDate).toISOString();
      
      // Construct the SQL query with direct value interpolation
      const sql = `
        INSERT INTO transactions (
          agent_id, property_address, sale_amount, commission_percentage, 
          company_gci, transaction_date, transaction_type, lead_source,
          is_company_provided, is_self_generated, referral_percentage, 
          referral_amount, showing_agent_id, showing_agent_fee, 
          agent_commission_amount, client_name
        ) VALUES (
          ${insertTransaction.agentId}, 
          '${insertTransaction.propertyAddress.replace(/'/g, "''")}',
          ${insertTransaction.saleAmount},
          ${insertTransaction.commissionPercentage},
          ${insertTransaction.companyGCI},
          '${formattedDate}',
          '${insertTransaction.transactionType || 'buyer'}',
          '${insertTransaction.leadSource || 'self_generated'}',
          ${insertTransaction.isCompanyProvided || false},
          ${insertTransaction.isSelfGenerated || true},
          ${insertTransaction.referralPercentage || 0},
          ${insertTransaction.referralAmount || 0},
          ${insertTransaction.showingAgentId ? insertTransaction.showingAgentId : 'NULL'},
          ${insertTransaction.showingAgentFee || 0},
          ${insertTransaction.agentCommissionAmount || 0},
          ${insertTransaction.clientName ? `'${insertTransaction.clientName.replace(/'/g, "''")}'` : 'NULL'}
        ) RETURNING 
          id, 
          agent_id as "agentId", 
          property_address as "propertyAddress", 
          sale_amount as "saleAmount", 
          commission_percentage as "commissionPercentage", 
          company_gci as "companyGCI", 
          transaction_date as "transactionDate", 
          created_at as "createdAt", 
          client_name as "clientName", 
          transaction_type as "transactionType", 
          lead_source as "leadSource", 
          is_company_provided as "isCompanyProvided", 
          is_self_generated as "isSelfGenerated", 
          referral_percentage as "referralPercentage", 
          referral_amount as "referralAmount", 
          showing_agent_id as "showingAgentId", 
          showing_agent_fee as "showingAgentFee", 
          agent_commission_amount as "agentCommissionAmount"
      `;
      
      console.log("Executing SQL:", sql);
      
      // Execute the query - no parameters needed as they're already interpolated
      const result = await db.execute(sql);
      
      if (!result || result.length === 0) {
        throw new Error("Failed to create transaction: No result returned");
      }
      
      const transaction = result[0] as Transaction;
      console.log("Transaction created successfully:", JSON.stringify(transaction));
      
      try {
        // Process revenue shares for this transaction
        await this.processRevenueShare(transaction);
      } catch (error) {
        console.error("Error processing revenue shares, but transaction was created:", error);
        // Continue even if revenue share processing fails
      }
      
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
        'isCompanyProvided', 'isSelfGenerated', 'agentCommissionAmount', 
        'clientName', 'referralPercentage', 'referralAmount',
        'showingAgentId', 'showingAgentFee', 'additionalAgentCost',
        'source', 'companyName', 'escrowOffice', 'escrowOfficer', 'referrer',
        'lender', 'sellerCommissionPercentage', 'buyerCommissionPercentage',
        'complianceFee', 'referralFee', 'showingAgent', 'teamAgentsIncome',
        'personalIncome', 'actualCheckAmount', 'manualCommissionAmount',
        'additionalAgentId', 'additionalAgentFee', 'additionalAgentPercentage',
        'agentNameArchived', 'referralType', 'referralAgentName', 
        'referralBrokerageName', 'officeGrossCommission', 'transactionCoordinatorFee',
        'complianceFeePaidByClient', 'depositAmount', 'depositDate',
        'depositPostedDate', 'commissionSplit', 'commissionNotes'
      ];
      
      // Convert camelCase fields to snake_case for SQL and collect values
      const updateParts = [];
      const values = [];
      let paramCounter = 1;
      
      for (const key in transactionUpdate) {
        if (allowedFields.includes(key)) {
          let value = transactionUpdate[key as keyof typeof transactionUpdate];
          
          // Handle date conversion
          if (key === 'transactionDate' && typeof value === 'string') {
            value = new Date(value);
          }
          
          // Convert camelCase to snake_case
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          
          updateParts.push(`${snakeKey} = $${paramCounter++}`);
          values.push(value);
        }
      }
      
      if (updateParts.length === 0) {
        console.log("No valid fields to update");
        return existingTransaction;
      }
      
      // Add transaction ID as last parameter
      values.push(id);
      
      // Include id in update parts
      const sql = `
        UPDATE transactions
        SET ${updateParts.join(', ')}
        WHERE id = ${id}
        RETURNING 
          id, 
          agent_id as "agentId", 
          property_address as "propertyAddress", 
          sale_amount as "saleAmount", 
          commission_percentage as "commissionPercentage", 
          company_gci as "companyGCI", 
          transaction_date as "transactionDate", 
          created_at as "createdAt", 
          client_name as "clientName", 
          transaction_type as "transactionType", 
          lead_source as "leadSource", 
          is_company_provided as "isCompanyProvided", 
          is_self_generated as "isSelfGenerated", 
          referral_percentage as "referralPercentage", 
          referral_amount as "referralAmount", 
          showing_agent_id as "showingAgentId", 
          showing_agent_fee as "showingAgentFee", 
          agent_commission_amount as "agentCommissionAmount",
          source,
          company_name as "companyName",
          escrow_office as "escrowOffice",
          escrow_officer as "escrowOfficer",
          referrer,
          lender,
          seller_commission_percentage as "sellerCommissionPercentage",
          buyer_commission_percentage as "buyerCommissionPercentage",
          compliance_fee as "complianceFee",
          referral_fee as "referralFee",
          showing_agent as "showingAgent",
          team_agents_income as "teamAgentsIncome",
          personal_income as "personalIncome",
          actual_check_amount as "actualCheckAmount",
          manual_commission_amount as "manualCommissionAmount",
          additional_agent_id as "additionalAgentId",
          additional_agent_fee as "additionalAgentFee",
          additional_agent_percentage as "additionalAgentPercentage",
          additional_agent_cost as "additionalAgentCost",
          agent_name_archived as "agentNameArchived",
          referral_type as "referralType",
          referral_agent_name as "referralAgentName",
          referral_brokerage_name as "referralBrokerageName",
          office_gross_commission as "officeGrossCommission",
          transaction_coordinator_fee as "transactionCoordinatorFee",
          compliance_fee_paid_by_client as "complianceFeePaidByClient",
          deposit_amount as "depositAmount",
          deposit_date as "depositDate"
      `;
      
      console.log("Executing update SQL:", sql, values);
      
      const result = await db.execute(sql, values) as any[];
      
      if (!result || result.length === 0) {
        throw new Error("Failed to update transaction: No result returned");
      }
      
      const updatedTransaction = result[0] as Transaction;
      
      // If companyGCI has changed, update revenue shares
      if (oldCompanyGCI !== updatedTransaction.companyGCI) {
        try {
          // Delete old revenue shares
          await db
            .delete(revenueShares)
            .where(eq(revenueShares.transactionId, id));
          
          // Process new revenue shares
          await this.processRevenueShare(updatedTransaction);
        } catch (error) {
          console.error("Error updating revenue shares, but transaction was updated:", error);
          // Continue even if revenue share processing fails
        }
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
      // Use drizzle ORM methods instead of raw SQL to avoid column naming issues
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
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.id));
  }
  
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
      // Build the WHERE clause conditions
      const conditions = [];
      const params: any[] = [];
      let paramCounter = 1;
      
      // Apply date range filter
      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        
        conditions.push(`transaction_date >= $${paramCounter++}`);
        conditions.push(`transaction_date <= $${paramCounter++}`);
        params.push(startDate, endDate);
      }
      
      // Apply agent filter
      if (filters.agentId) {
        conditions.push(`agent_id = $${paramCounter++}`);
        params.push(filters.agentId);
      }
      
      // Apply transaction type filter
      if (filters.transactionType) {
        conditions.push(`transaction_type = $${paramCounter++}`);
        params.push(filters.transactionType);
      }
      
      // Apply lead source filter
      if (filters.leadSource) {
        conditions.push(`lead_source = $${paramCounter++}`);
        params.push(filters.leadSource);
      }
      
      // Apply address filter
      if (filters.address) {
        conditions.push(`property_address ILIKE $${paramCounter++}`);
        params.push(`%${filters.address}%`);
      }
      
      // Apply zip code filter
      if (filters.zipCode) {
        conditions.push(`property_address ILIKE $${paramCounter++}`);
        params.push(`%${filters.zipCode}%`);
      }
      
      // Apply sale amount range filters
      if (filters.minSaleAmount) {
        conditions.push(`sale_amount >= $${paramCounter++}`);
        params.push(filters.minSaleAmount);
      }
      
      if (filters.maxSaleAmount) {
        conditions.push(`sale_amount <= $${paramCounter++}`);
        params.push(filters.maxSaleAmount);
      }
      
      // Construct the WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Use raw SQL to select all columns that exist in the database
      const sql = `
        SELECT 
          id, 
          agent_id as "agentId", 
          property_address as "propertyAddress", 
          sale_amount as "saleAmount", 
          commission_percentage as "commissionPercentage", 
          company_gci as "companyGCI", 
          transaction_date as "transactionDate", 
          created_at as "createdAt", 
          client_name as "clientName", 
          transaction_type as "transactionType", 
          lead_source as "leadSource", 
          is_company_provided as "isCompanyProvided", 
          is_self_generated as "isSelfGenerated", 
          referral_percentage as "referralPercentage", 
          referral_amount as "referralAmount", 
          showing_agent_id as "showingAgentId", 
          showing_agent_fee as "showingAgentFee", 
          agent_commission_amount as "agentCommissionAmount",
          source,
          company_name as "companyName",
          escrow_office as "escrowOffice",
          escrow_officer as "escrowOfficer",
          referrer,
          lender,
          seller_commission_percentage as "sellerCommissionPercentage",
          buyer_commission_percentage as "buyerCommissionPercentage",
          compliance_fee as "complianceFee",
          referral_fee as "referralFee",
          showing_agent as "showingAgent",
          team_agents_income as "teamAgentsIncome",
          personal_income as "personalIncome",
          actual_check_amount as "actualCheckAmount",
          manual_commission_amount as "manualCommissionAmount",
          additional_agent_id as "additionalAgentId",
          additional_agent_fee as "additionalAgentFee",
          additional_agent_percentage as "additionalAgentPercentage",
          additional_agent_cost as "additionalAgentCost",
          agent_name_archived as "agentNameArchived",
          referral_type as "referralType",
          referral_agent_name as "referralAgentName",
          referral_brokerage_name as "referralBrokerageName",
          office_gross_commission as "officeGrossCommission",
          transaction_coordinator_fee as "transactionCoordinatorFee",
          compliance_fee_paid_by_client as "complianceFeePaidByClient",
          deposit_amount as "depositAmount",
          deposit_date as "depositDate"
        FROM transactions
        ${whereClause}
        ORDER BY transaction_date DESC
      `;
      
      console.log("Executing filtered transactions query:", sql, params);
      
      const result = await db.execute(sql, params) as any[];
      return result as Transaction[];
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