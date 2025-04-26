import { pgTable, text, serial, integer, boolean, doublePrecision, timestamp, foreignKey, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { CONFIG } from "./config";

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

// Agent status
export enum AgentStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ON_LEAVE = "on_leave",
  TERMINATED = "terminated"
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
  // New fields for agent status and audit
  status: text("status").notNull().$type<AgentStatus>().default(AgentStatus.ACTIVE),
  statusChangeDate: timestamp("status_change_date"),
  statusChangeReason: text("status_change_reason"),
  lastModifiedBy: integer("last_modified_by").references((): any => users.id),
  lastModifiedAt: timestamp("last_modified_at").defaultNow()
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
  
  // New fields for audit and validation
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
  lastModifiedAt: timestamp("last_modified_at").defaultNow(),
  validationErrors: text("validation_errors"), // JSON string of validation errors
  isDisputed: boolean("is_disputed").default(false),
  disputeReason: text("dispute_reason"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolvedBy: integer("dispute_resolved_by").references(() => users.id)
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
  // New fields for audit
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
  lastModifiedAt: timestamp("last_modified_at").defaultNow()
});

// Users table definition for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Will be hashed
  email: text("email").notNull(),
  role: text("role").notNull().$type<UserRole>().default(UserRole.AGENT),
  agentId: integer("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  // New fields for security
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  isLocked: boolean("is_locked").default(false),
  lockExpiresAt: timestamp("lock_expires_at")
});

// New audit log table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g., "create_agent", "update_transaction"
  entityType: text("entity_type").notNull(), // e.g., "agent", "transaction"
  entityId: integer("entity_id").notNull(),
  oldValues: text("old_values"), // JSON string of old values
  newValues: text("new_values"), // JSON string of new values
  createdAt: timestamp("created_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent")
});

// Insert schemas with validation
export const insertAgentSchema = createInsertSchema(agents)
  .omit({ id: true, createdAt: true, lastModifiedBy: true, lastModifiedAt: true })
  .extend({
    agentCode: z.string().length(6).optional(),
    agentType: z.enum([AgentType.PRINCIPAL, AgentType.SUPPORT]),
    capType: z.enum([CapType.STANDARD, CapType.TEAM]).optional(),
    sponsorId: z.number().optional(),
    anniversaryDate: z.coerce.date(),
    gciSinceAnniversary: z.number().nonnegative().optional(),
    currentTier: z.number().min(1).max(9).optional(),
    totalSalesYTD: z.number().nonnegative().optional(),
    totalGCIYTD: z.number().nonnegative().optional(),
    careerSalesCount: z.number().nonnegative().optional(),
    status: z.enum([
      AgentStatus.ACTIVE,
      AgentStatus.INACTIVE,
      AgentStatus.ON_LEAVE,
      AgentStatus.TERMINATED
    ]).default(AgentStatus.ACTIVE)
  });

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true, lastModifiedBy: true, lastModifiedAt: true })
  .extend({
    transactionDate: z.coerce.date(),
    closeDate: z.coerce.date().optional(),
    saleAmount: z.number()
      .min(CONFIG.validation.minSaleAmount)
      .max(CONFIG.validation.maxSaleAmount),
    commissionPercentage: z.number().min(0).max(100),
    companyGCI: z.number().nonnegative().optional(),
    clientName: z.string().optional(),
    clientEmail: z.string().email().optional(),
    clientPhone: z.string().optional(),
    transactionType: z.enum(["buyer", "seller"]).default("buyer"),
    transactionStatus: z.enum(["pending", "closed", "cancelled"]).default("pending"),
    leadSource: z.nativeEnum(LeadSource).optional(),
    isCompanyProvided: z.boolean().default(false),
    isSelfGenerated: z.boolean().default(true),
    agentCommissionPercentage: z.number().min(0).max(100).optional(),
    agentCommissionAmount: z.number().nonnegative().optional(),
    referralPercentage: z.number().min(0).max(100).default(0),
    referralAmount: z.number().nonnegative().default(0),
    showingAgentFee: z.number().nonnegative().default(0),
    officeGrossCommission: z.number().nonnegative().default(0),
    transactionCoordinatorFee: z.number().nonnegative().default(0),
    complianceFee: z.number().nonnegative().default(0),
    depositAmount: z.number().nonnegative().default(0),
    additionalAgentFee: z.number().nonnegative().default(0),
    additionalAgentPercentage: z.number().min(0).max(100).default(0),
    additionalAgentCost: z.number().nonnegative().default(0),
    teamAgentsIncome: z.number().nonnegative().default(0),
    personalIncome: z.number().nonnegative().default(0),
    actualCheckAmount: z.number().nonnegative().default(0)
  });

export const insertRevenueShareSchema = createInsertSchema(revenueShares)
  .omit({ id: true, createdAt: true, lastModifiedBy: true, lastModifiedAt: true })
  .extend({
    amount: z.number().nonnegative(),
    tier: z.number().min(1).max(5)
  });

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, failedLoginAttempts: true, lastFailedLogin: true, isLocked: true, lockExpiresAt: true })
  .extend({
    username: z.string().min(3).max(50),
    password: z.string().min(8),
    email: z.string().email(),
    role: z.enum([UserRole.ADMIN, UserRole.AGENT]).default(UserRole.AGENT)
  });

export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    action: z.string(),
    entityType: z.string(),
    entityId: z.number(),
    oldValues: z.string().optional(),
    newValues: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional()
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

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export interface AgentWithDownline extends Agent {
  downline?: AgentWithDownline[];
  sponsor?: Agent;
  totalEarnings?: number;
}
