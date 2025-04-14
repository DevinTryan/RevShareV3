import { pgTable, text, serial, integer, boolean, doublePrecision, timestamp, foreignKey, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agent types
export enum AgentType {
  PRINCIPAL = "principal",
  SUPPORT = "support"
}

// Cap types
export enum CapType {
  STANDARD = "standard", // $16,000
  TEAM = "team" // $8,000
}

// Lead source categories
export enum LeadSource {
  SELF_GENERATED = "self_generated",
  COMPANY_PROVIDED = "company_provided",
  REFERRAL = "referral",
  SOI = "soi",
  ZILLOW = "zillow",
  GOOGLE = "google",
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  OPEN_HOUSE = "open_house",
  EXPIRED = "expired",
  PAST_CLIENT = "past_client",
  OTHER = "other"
}

// Tiers for Support Agents based on sales volume
export enum SupportAgentTier {
  TIER_1 = 1, // 0-$40,000 - 50%
  TIER_2 = 2, // $40,000-$80,000 - 60%
  TIER_3 = 3, // $80,000-$150,000 - 70%
  TIER_4 = 4, // $150,000-$225,000 - 75%
  TIER_5 = 5, // $225,000-$310,000 - 80%
  TIER_6 = 6, // $310,000-$400,000 - 84%
  TIER_7 = 7, // $400,000-$500,000 - 88%
  TIER_8 = 8, // $500,000-$650,000 - 90%
  TIER_9 = 9  // $650,000+ - 92%
}

// User roles
export enum UserRole {
  ADMIN = "admin",
  AGENT = "agent"
}

// Agent table definition
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentCode: text("agent_code").unique(), // Unique 6-digit agent ID code (000001, etc.)
  agentType: text("agent_type").notNull().$type<AgentType>(),
  capType: text("cap_type").$type<CapType>(),
  currentCap: doublePrecision("current_cap").default(0),
  anniversaryDate: timestamp("anniversary_date").notNull(),
  gciSinceAnniversary: doublePrecision("gci_since_anniversary").default(0), // GCI earned since anniversary date
  sponsorId: integer("sponsor_id").references((): any => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
  // New fields for commission tracking
  currentTier: integer("current_tier").default(1), // Current tier level for Support agents
  totalSalesYTD: doublePrecision("total_sales_ytd").default(0), // Total sales this year
  totalGCIYTD: doublePrecision("total_gci_ytd").default(0), // Total GCI this year
  careerSalesCount: integer("career_sales_count").default(0), // Number of career sales
});

// Transaction table definition
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  propertyAddress: text("property_address").notNull(),
  saleAmount: doublePrecision("sale_amount").notNull(),
  commissionPercentage: doublePrecision("commission_percentage").notNull(),
  companyGCI: doublePrecision("company_gci").notNull().default(0),
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  
  // Client information
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  
  // Transaction details
  transactionType: text("transaction_type").default("buyer"), // buyer or seller
  transactionStatus: text("transaction_status").default("pending"), // pending, closed, cancelled
  escrowNumber: text("escrow_number"),
  closeDate: timestamp("close_date"),
  
  // Lead and commission tracking
  leadSource: text("lead_source").$type<LeadSource>(),
  isCompanyProvided: boolean("is_company_provided").default(false),
  isSelfGenerated: boolean("is_self_generated").default(true),
  agentCommissionPercentage: doublePrecision("agent_commission_percentage"), // % commission that goes to agent
  agentCommissionAmount: doublePrecision("agent_commission_amount"), // actual $ amount to agent
  
  // Referral details
  referralPercentage: doublePrecision("referral_percentage").default(0), // if referral, what %
  referralAmount: doublePrecision("referral_amount").default(0), // $ paid in referral
  referralType: text("referral_type"), // type of referral
  referralAgentName: text("referral_agent_name"), // name of referring agent
  referralBrokerageName: text("referral_brokerage_name"), // name of referring brokerage
  
  // Showing agent details
  showingAgentId: integer("showing_agent_id").references(() => agents.id), // if there was a showing agent
  showingAgentFee: doublePrecision("showing_agent_fee").default(0), // $ paid to showing agent
  
  // Additional fees and adjustments
  officeGrossCommission: doublePrecision("office_gross_commission").default(0), // total commission to the office
  transactionCoordinatorFee: doublePrecision("transaction_coordinator_fee").default(0), // TC fee
  complianceFee: doublePrecision("compliance_fee").default(0), // compliance fee amount
  complianceFeePaidByClient: boolean("compliance_fee_paid_by_client").default(false), // who pays compliance fee
  
  // Earnest money/deposit tracking
  depositAmount: doublePrecision("deposit_amount").default(0), // earnest money amount
  depositDate: timestamp("deposit_date"), // date deposit received
  depositPostedDate: timestamp("deposit_posted_date"), // date posted to accounting
  
  // Additional commission info and comments
  commissionSplit: text("commission_split"), // commission split details
  commissionNotes: text("commission_notes"), // notes about commission
  
  // Multi-agent support
  additionalAgentId: integer("additional_agent_id").references(() => agents.id), // additional agent involved
  additionalAgentFee: doublePrecision("additional_agent_fee").default(0), // fee for additional agent
  additionalAgentPercentage: doublePrecision("additional_agent_percentage").default(0), // % for additional agent
  additionalAgentCost: doublePrecision("additional_agent_cost").default(0), // additional cost for agent
  
  // Extended transaction fields
  source: text("source"), // Source of the transaction
  companyName: text("company_name"), // Company name
  escrowOffice: text("escrow_office"), // Escrow office
  escrowOfficer: text("escrow_officer"), // Escrow officer
  referrer: text("referrer"), // Referrer
  lender: text("lender"), // Lender
  sellerCommissionPercentage: doublePrecision("seller_commission_percentage").default(0), // Seller commission %
  buyerCommissionPercentage: doublePrecision("buyer_commission_percentage").default(0), // Buyer commission %
  referralFee: doublePrecision("referral_fee").default(0), // Referral fee
  showingAgent: text("showing_agent"), // Showing agent name
  teamAgentsIncome: doublePrecision("team_agents_income").default(0), // Team agents income
  personalIncome: doublePrecision("personal_income").default(0), // Personal income
  actualCheckAmount: doublePrecision("actual_check_amount").default(0), // Actual check amount
  
  // Archived fields for deleted agents
  agentNameArchived: text("agent_name_archived"), // Keeps agent name after deletion
});

// Revenue share table definition
export const revenueShares = pgTable("revenue_shares", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  sourceAgentId: integer("source_agent_id").notNull().references(() => agents.id),
  recipientAgentId: integer("recipient_agent_id").notNull().references(() => agents.id),
  amount: doublePrecision("amount").notNull(),
  tier: integer("tier").notNull(), // 1-5 levels
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table definition for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().$type<UserRole>().default(UserRole.AGENT),
  agentId: integer("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

// Insert schemas
export const insertAgentSchema = createInsertSchema(agents)
  .omit({ id: true, createdAt: true })
  .extend({
    agentCode: z.string().length(6).optional(), // 6-digit agent code will be auto-generated if not provided
    agentType: z.enum([AgentType.PRINCIPAL, AgentType.SUPPORT]),
    capType: z.enum([CapType.STANDARD, CapType.TEAM]).optional(),
    sponsorId: z.number().optional(),
    anniversaryDate: z.coerce.date(),
    gciSinceAnniversary: z.number().nonnegative().optional(),
    currentTier: z.number().min(1).max(9).optional(),
    totalSalesYTD: z.number().nonnegative().optional(),
    totalGCIYTD: z.number().nonnegative().optional(),
    careerSalesCount: z.number().nonnegative().optional()
  });

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true })
  .extend({
    transactionDate: z.coerce.date(),
    saleAmount: z.number().positive({ message: "Sale amount must be positive" }),
    commissionPercentage: z.number().positive({ message: "Commission percentage must be positive" }),
    companyGCI: z.number().optional().transform(val => val || undefined),
    // New fields
    clientName: z.string().optional(),
    transactionType: z.enum(["buyer", "seller"]).default("buyer"),
    leadSource: z.nativeEnum(LeadSource).optional(),
    isCompanyProvided: z.boolean().optional(),
    isSelfGenerated: z.boolean().optional(),
    agentCommissionPercentage: z.number().optional(),
    agentCommissionAmount: z.number().optional(),
    referralPercentage: z.number().min(0).max(100).optional(),
    referralAmount: z.number().nonnegative().optional(),
    showingAgentId: z.number().optional(),
    showingAgentFee: z.number().nonnegative().optional(),
    // Extended transaction fields
    additionalAgentCost: z.number().min(0).optional(),
    source: z.string().optional(),
    companyName: z.string().optional(),
    escrowOffice: z.string().optional(),
    escrowOfficer: z.string().optional(),
    referrer: z.string().optional(),
    lender: z.string().optional(),
    sellerCommissionPercentage: z.number().min(0).optional(),
    buyerCommissionPercentage: z.number().min(0).optional(),
    referralFee: z.number().min(0).optional(),
    showingAgent: z.string().optional(),
    teamAgentsIncome: z.number().min(0).optional(),
    personalIncome: z.number().min(0).optional(),
    actualCheckAmount: z.number().min(0).optional()
  })
  .transform(data => {
    // If companyGCI is not provided, calculate it from saleAmount and commissionPercentage
    const totalCommission = (data.saleAmount * data.commissionPercentage) / 100;
    
    if (data.companyGCI === undefined) {
      // Calculate company split based on agent type and tier
      // This is a simplified version - the actual calculation will be in the business logic
      data.companyGCI = totalCommission * 0.15; // Default is 15% to company
    }
    
    // Calculate agent commission if not provided
    if (data.agentCommissionAmount === undefined && data.agentCommissionPercentage) {
      data.agentCommissionAmount = totalCommission * (data.agentCommissionPercentage / 100);
    } else if (data.agentCommissionAmount === undefined) {
      // Default agent commission is total commission minus company GCI and any referral amount
      data.agentCommissionAmount = totalCommission - data.companyGCI - (data.referralAmount || 0);
    }
    
    // Set lead source flags automatically based on leadSource if not explicitly set
    if (data.isCompanyProvided === undefined && data.leadSource) {
      data.isCompanyProvided = [
        LeadSource.COMPANY_PROVIDED, 
        LeadSource.ZILLOW, 
        LeadSource.GOOGLE
      ].includes(data.leadSource);
    }
    
    if (data.isSelfGenerated === undefined) {
      data.isSelfGenerated = !data.isCompanyProvided;
    }
    
    return data;
  });

export const insertRevenueShareSchema = createInsertSchema(revenueShares)
  .omit({ id: true, createdAt: true });

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, lastLogin: true, resetToken: true, resetTokenExpiry: true })
  .extend({
    role: z.nativeEnum(UserRole),
    // Require strong password with at least 8 characters, including one uppercase, one lowercase, one number
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
      message: "Password must be at least 8 characters and include uppercase, lowercase, and number"
    }),
    email: z.string().email({ message: "Invalid email address" }),
    // Agent ID is optional for admin users, required for agent users
    agentId: z.number().optional().superRefine((val, ctx) => {
      if (ctx.data?.role === UserRole.AGENT && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Agent ID is required for users with agent role"
        });
      }
    })
  });

// Types
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type RevenueShare = typeof revenueShares.$inferSelect;
export type InsertRevenueShare = z.infer<typeof insertRevenueShareSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Additional type for agent with downline information
export interface AgentWithDownline extends Agent {
  downline?: AgentWithDownline[];
  sponsor?: Agent;
  totalEarnings?: number;
}
