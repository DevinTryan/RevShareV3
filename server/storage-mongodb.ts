import { 
  Agent, InsertAgent, AgentType, CapType, AgentStatus,
  Transaction, InsertTransaction,
  RevenueShare, InsertRevenueShare,
  AgentWithDownline,
  User, InsertUser,
  UserRole,
  LeadSource
} from "@shared/schema";
import session from "express-session";
import mongoose from "mongoose";
import { IStorage } from "./storage";
import { Agent as AgentModel, IAgent } from "./db/models/agentModel";
import { Transaction as TransactionModel, ITransaction } from "./db/models/transactionModel";
import { RevenueShare as RevenueShareModel, IRevenueShare } from "./db/models/revenueShareModel";
import { User as UserModel, IUser } from "./db/models/userModel";
import { connectToMongoDB } from "./db/mongodb";
import MongoStore from "connect-mongo";

export class MongoDBStorage implements IStorage {
  public sessionStore: session.Store | undefined;
  private initialized: boolean = false;
  private nextAgentId: number = 1;
  private nextTransactionId: number = 1;
  private nextRevenueShareId: number = 1;
  private nextUserId: number = 1;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;

    try {
      // Connect to MongoDB
      await connectToMongoDB();

      // Setup session store with connect-mongo
      this.sessionStore = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || "mongodb+srv://devin:rwSiigf8Kb09BkvG@cluster0.c3xfsbp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
        dbName: "revenueShareCalculator",
        collectionName: "sessions",
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native'
      });

      // Initialize ID counters based on existing data
      await this.initializeIdCounters();

      this.initialized = true;
      console.log('MongoDB storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MongoDB storage:', error);
      throw error;
    }
  }

  private async initializeIdCounters() {
    try {
      // Find the highest IDs in each collection to initialize our counters
      const highestAgentId = await AgentModel.findOne().sort({ id: -1 });
      if (highestAgentId) this.nextAgentId = highestAgentId.id + 1;

      const highestTransactionId = await TransactionModel.findOne().sort({ id: -1 });
      if (highestTransactionId) this.nextTransactionId = highestTransactionId.id + 1;

      const highestRevenueShareId = await RevenueShareModel.findOne().sort({ id: -1 });
      if (highestRevenueShareId) this.nextRevenueShareId = highestRevenueShareId.id + 1;

      const highestUserId = await UserModel.findOne().sort({ id: -1 });
      if (highestUserId) this.nextUserId = highestUserId.id + 1;

      console.log(`Initialized ID counters - Agent: ${this.nextAgentId}, Transaction: ${this.nextTransactionId}, RevenueShare: ${this.nextRevenueShareId}, User: ${this.nextUserId}`);
    } catch (error) {
      console.error('Error initializing ID counters:', error);
      // Use default starting values if there was an error
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('MongoDB storage not initialized');
    }
  }

  // Convert Mongoose document to plain object and normalize ID
  private documentToObject<T>(doc: any): T {
    if (!doc) return doc;
    
    const obj = doc.toObject ? doc.toObject() : doc;
    // Keep the MongoDB _id, but make it non-enumerable so it doesn't interfere with app logic
    Object.defineProperty(obj, '_id', { enumerable: false });
    return obj as T;
  }

  // Agent operations
  async getAgents(): Promise<Agent[]> {
    this.ensureInitialized();
    const agents = await AgentModel.find();
    return agents.map(agent => this.documentToObject<Agent>(agent));
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    this.ensureInitialized();
    const agent = await AgentModel.findOne({ id });
    return agent ? this.documentToObject<Agent>(agent) : undefined;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    this.ensureInitialized();
    const id = this.nextAgentId++;
    const now = new Date();
    
    // Create agent with proper defaults for null fields
    const agent = {
      id,
      ...insertAgent,
      agentCode: insertAgent.agentCode ?? null,
      capType: insertAgent.capType ?? null,
      currentCap: 0,
      gciSinceAnniversary: 0,
      sponsorId: insertAgent.sponsorId ?? null,
      currentTier: 1,
      totalSalesYTD: 0,
      totalGCIYTD: 0,
      careerSalesCount: 0,
      statusChangeDate: null,
      statusChangeReason: null,
      createdAt: now,
      lastModifiedBy: null,
      lastModifiedAt: null
    } as Agent;

    const newAgent = await AgentModel.create(agent);
    return this.documentToObject<Agent>(newAgent);
  }

  async updateAgent(id: number, agent: Partial<Agent>): Promise<Agent | undefined> {
    this.ensureInitialized();
    const existingAgent = await AgentModel.findOne({ id });
    if (!existingAgent) return undefined;

    // Update fields
    Object.assign(existingAgent, agent);
    existingAgent.lastModifiedAt = new Date();
    
    await existingAgent.save();
    return this.documentToObject<Agent>(existingAgent);
  }

  async deleteAgent(id: number): Promise<boolean> {
    this.ensureInitialized();
    const result = await AgentModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getAgentWithDownline(id: number): Promise<AgentWithDownline | undefined> {
    this.ensureInitialized();
    const agent = await AgentModel.findOne({ id });
    if (!agent) return undefined;

    const agentObj = this.documentToObject<Agent>(agent);
    
    // Get all agents with this agent as sponsor
    const downlineAgents = await AgentModel.find({ sponsorId: id });
    const downline = await Promise.all(
      downlineAgents.map(async (a) => {
        const downlineAgent = this.documentToObject<Agent>(a);
        // Recursively get each agent's downline
        const withDownline = await this.getAgentWithDownline(downlineAgent.id);
        return withDownline!;
      })
    );

    // Get the sponsor if exists
    let sponsor: Agent | undefined;
    if (agentObj.sponsorId) {
      const sponsorAgent = await AgentModel.findOne({ id: agentObj.sponsorId });
      if (sponsorAgent) {
        sponsor = this.documentToObject<Agent>(sponsorAgent);
      }
    }

    // Calculate total earnings by summing up all revenue shares
    const revenueShares = await RevenueShareModel.find({ agentId: id });
    const totalEarnings = revenueShares.reduce((sum, rs) => sum + rs.amount, 0);

    return {
      ...agentObj,
      downline: downline.length > 0 ? downline : undefined,
      sponsor,
      totalEarnings: totalEarnings || 0
    };
  }

  async getAgentsWithDownline(): Promise<AgentWithDownline[]> {
    this.ensureInitialized();
    const agents = await AgentModel.find();
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
    this.ensureInitialized();
    // Root level agents have no sponsor
    const rootAgents = await AgentModel.find({ sponsorId: null });
    return rootAgents.map(agent => this.documentToObject<Agent>(agent));
  }

  // Transaction operations
  async getTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();
    const transactions = await TransactionModel.find();
    return transactions.map(tx => this.documentToObject<Transaction>(tx));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    this.ensureInitialized();
    const transaction = await TransactionModel.findOne({ id });
    return transaction ? this.documentToObject<Transaction>(transaction) : undefined;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    this.ensureInitialized();
    const id = this.nextTransactionId++;
    const now = new Date();
    
    // Create transaction with proper type compatibility
    const transaction = {
      id,
      ...insertTransaction,
      companyGCI: insertTransaction.companyGCI || 0,
      createdAt: now,
      lastModifiedBy: null,
      lastModifiedAt: null
    } as Transaction;

    const newTransaction = await TransactionModel.create(transaction);
    return this.documentToObject<Transaction>(newTransaction);
  }

  async updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined> {
    this.ensureInitialized();
    const existingTransaction = await TransactionModel.findOne({ id });
    if (!existingTransaction) return undefined;

    // Update fields
    Object.assign(existingTransaction, transaction);
    existingTransaction.lastModifiedAt = new Date();
    
    await existingTransaction.save();
    return this.documentToObject<Transaction>(existingTransaction);
  }

  async deleteTransaction(id: number): Promise<boolean> {
    this.ensureInitialized();
    const result = await TransactionModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getAgentTransactions(agentId: number): Promise<Transaction[]> {
    this.ensureInitialized();
    const transactions = await TransactionModel.find({ agentId });
    return transactions.map(tx => this.documentToObject<Transaction>(tx));
  }

  // Revenue share operations
  async getRevenueShares(): Promise<RevenueShare[]> {
    this.ensureInitialized();
    const revenueShares = await RevenueShareModel.find();
    return revenueShares.map(rs => this.documentToObject<RevenueShare>(rs));
  }

  async getRevenueSharesByTransaction(transactionId: number): Promise<RevenueShare[]> {
    this.ensureInitialized();
    const revenueShares = await RevenueShareModel.find({ transactionId });
    return revenueShares.map(rs => this.documentToObject<RevenueShare>(rs));
  }

  async getRevenueSharesByAgent(agentId: number): Promise<RevenueShare[]> {
    this.ensureInitialized();
    const revenueShares = await RevenueShareModel.find({ agentId });
    return revenueShares.map(rs => this.documentToObject<RevenueShare>(rs));
  }

  async createRevenueShare(revenueShare: InsertRevenueShare): Promise<RevenueShare> {
    this.ensureInitialized();
    const id = this.nextRevenueShareId++;
    const now = new Date();
    const newRevenueShare: RevenueShare = {
      id,
      ...revenueShare,
      createdAt: now,
      lastModifiedBy: null,
      lastModifiedAt: null
    };

    const createdRevenueShare = await RevenueShareModel.create(newRevenueShare);
    return this.documentToObject<RevenueShare>(createdRevenueShare);
  }

  // User operations
  async getUsers(): Promise<User[]> {
    this.ensureInitialized();
    const users = await UserModel.find();
    return users.map(user => this.documentToObject<User>(user));
  }

  async getUser(id: number): Promise<User | undefined> {
    this.ensureInitialized();
    const user = await UserModel.findOne({ id });
    return user ? this.documentToObject<User>(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    this.ensureInitialized();
    const user = await UserModel.findOne({ username });
    return user ? this.documentToObject<User>(user) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    this.ensureInitialized();
    const id = this.nextUserId++;
    const now = new Date();
    
    // Create user with proper type compatibility
    const newUser = {
      id,
      ...user,
      createdAt: now,
      agentId: user.agentId ?? null,
      lastLogin: null,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      isLocked: false,
      lockExpiresAt: null,
      resetToken: null,
      resetTokenExpiry: null
    } as User;

    const createdUser = await UserModel.create(newUser);
    return this.documentToObject<User>(createdUser);
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    this.ensureInitialized();
    const existingUser = await UserModel.findOne({ id });
    if (!existingUser) return undefined;

    // Update fields
    Object.assign(existingUser, user);
    
    await existingUser.save();
    return this.documentToObject<User>(existingUser);
  }

  async deleteUser(id: number): Promise<boolean> {
    this.ensureInitialized();
    const result = await UserModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    this.ensureInitialized();
    const user = await UserModel.findOne({ email });
    return user ? this.documentToObject<User>(user) : undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    this.ensureInitialized();
    const user = await UserModel.findOne({ resetToken: token });
    return user ? this.documentToObject<User>(user) : undefined;
  }

  async getAgentUser(agentId: number): Promise<User | undefined> {
    this.ensureInitialized();
    const user = await UserModel.findOne({ agentId });
    return user ? this.documentToObject<User>(user) : undefined;
  }

  // Reports operations
  async getFilteredTransactions(filters: any): Promise<Transaction[]> {
    this.ensureInitialized();
    let query: any = {};
    
    // Apply filters
    if (filters.agentId) {
      query.agentId = filters.agentId;
    }
    
    if (filters.startDate && filters.endDate) {
      query.transactionDate = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    } else if (filters.startDate) {
      query.transactionDate = { $gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      query.transactionDate = { $lte: new Date(filters.endDate) };
    }
    
    if (filters.transactionType) {
      query.transactionType = filters.transactionType;
    }
    
    if (filters.leadSource) {
      query.leadSource = filters.leadSource;
    }
    
    if (filters.minAmount) {
      query.saleAmount = { $gte: filters.minAmount };
    }
    
    if (filters.maxAmount) {
      if (query.saleAmount) {
        query.saleAmount.$lte = filters.maxAmount;
      } else {
        query.saleAmount = { $lte: filters.maxAmount };
      }
    }
    
    const transactions = await TransactionModel.find(query);
    return transactions.map(tx => this.documentToObject<Transaction>(tx));
  }

  async getAgentPerformanceReport(filters: any): Promise<any[]> {
    this.ensureInitialized();
    const transactions = await this.getFilteredTransactions(filters);
    const agentMap = new Map<number, any>();
    
    // Get all agents first
    const allAgents = await this.getAgents();
    for (const agent of allAgents) {
      agentMap.set(agent.id, {
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        transactionCount: 0,
        totalVolume: 0,
        totalGCI: 0,
        totalIncome: 0,
        averageSalePrice: 0,
        referralFeesEarned: 0,
        isBrokerage: agent.agentType === AgentType.PRINCIPAL,
        transactions: []
      });
    }
    
    // Process transactions
    for (const tx of transactions) {
      if (!agentMap.has(tx.agentId)) continue;
      
      const agentData = agentMap.get(tx.agentId);
      agentData.transactions.push(tx);
      agentData.transactionCount++;
      agentData.totalVolume += tx.saleAmount;
      agentData.totalGCI += tx.companyGCI;
      agentData.totalIncome += tx.agentCommissionAmount || 0;
      
      // Track referral fees if this agent received them
      if (tx.referralAmount && tx.referralAgentName === agentData.agentName) {
        agentData.referralFeesEarned += tx.referralAmount;
      }
    }
    
    // Calculate metrics and remove transaction arrays
    return Array.from(agentMap.values())
      .filter(agent => agent.transactionCount > 0)
      .map(agent => {
        agent.averageSalePrice = agent.transactionCount > 0 
          ? agent.totalVolume / agent.transactionCount 
          : 0;
        
        // Remove transactions array from result
        delete agent.transactions;
        
        return agent;
      })
      .sort((a, b) => b.totalVolume - a.totalVolume); // Sort by volume (highest first)
  }

  async getLeadSourceReport(filters: any): Promise<any[]> {
    this.ensureInitialized();
    const transactions = await this.getFilteredTransactions(filters);
    const leadSourceMap = new Map<string, any>();
    
    // Initialize lead source map with all possible sources
    const leadSources = Object.values(LeadSource);
    leadSources.forEach(source => {
      leadSourceMap.set(source, {
        leadSource: source,
        transactionCount: 0,
        totalVolume: 0,
        totalGCI: 0,
        totalAgentIncome: 0,
        totalCompanyIncome: 0,
        averageSalePrice: 0,
        transactions: []
      });
    });
    
    // Add "Unknown" category
    leadSourceMap.set("unknown", {
      leadSource: "unknown",
      transactionCount: 0,
      totalVolume: 0,
      totalGCI: 0,
      totalAgentIncome: 0,
      totalCompanyIncome: 0,
      averageSalePrice: 0,
      transactions: []
    });
    
    // Process transactions
    for (const tx of transactions) {
      const leadSource = tx.leadSource || "unknown";
      const leadSourceData = leadSourceMap.get(leadSource);
      
      if (leadSourceData) {
        leadSourceData.transactions.push(tx);
      }
    }
    
    // Calculate metrics for each lead source
    const result = Array.from(leadSourceMap.values()).map(data => {
      const { transactions } = data;
      
      data.transactionCount = transactions.length;
      data.totalVolume = transactions.reduce((sum: number, tx: any) => sum + tx.saleAmount, 0);
      data.totalGCI = transactions.reduce((sum: number, tx: any) => sum + tx.companyGCI, 0);
      data.totalAgentIncome = transactions.reduce((sum: number, tx: any) => sum + (tx.agentCommissionAmount || 0), 0);
      data.totalCompanyIncome = data.totalGCI - data.totalAgentIncome;
      data.averageSalePrice = data.transactionCount > 0 
        ? data.totalVolume / data.transactionCount 
        : 0;
      
      // Remove transactions array from result
      delete data.transactions;
      
      return data;
    });
    
    // Sort by transaction count (highest first) and filter out empty categories
    return result
      .filter(item => item.transactionCount > 0)
      .sort((a, b) => b.transactionCount - a.transactionCount);
  }

  async getIncomeDistributionReport(filters: any): Promise<any> {
    this.ensureInitialized();
    const transactions = await this.getFilteredTransactions(filters);
    
    const totalGCI = transactions.reduce((sum: number, tx: any) => sum + tx.companyGCI, 0);
    const totalAgentIncome = transactions.reduce((sum: number, tx: any) => sum + (tx.agentCommissionAmount || 0), 0);
    const totalCompanyIncome = totalGCI - totalAgentIncome;
    const totalShowingAgentFees = transactions.reduce((sum: number, tx: any) => sum + (tx.showingAgentFee || 0), 0);
    const totalReferralFees = transactions.reduce((sum: number, tx: any) => sum + (tx.referralAmount || 0), 0);
    
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
    this.ensureInitialized();
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
      data.totalVolume = transactions.reduce((sum: number, tx: any) => sum + tx.saleAmount, 0);
      data.totalGCI = transactions.reduce((sum: number, tx: any) => sum + tx.companyGCI, 0);
      data.totalAgentIncome = transactions.reduce((sum: number, tx: any) => sum + (tx.agentCommissionAmount || 0), 0);
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
