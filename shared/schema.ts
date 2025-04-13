import { pgTable, text, serial, integer, boolean, doublePrecision, timestamp, foreignKey } from "drizzle-orm/pg-core";
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

// Agent table definition
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentType: text("agent_type").notNull().$type<AgentType>(),
  capType: text("cap_type").$type<CapType>(),
  currentCap: doublePrecision("current_cap").default(0),
  anniversaryDate: timestamp("anniversary_date").notNull(),
  sponsorId: integer("sponsor_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction table definition
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  propertyAddress: text("property_address").notNull(),
  saleAmount: doublePrecision("sale_amount").notNull(),
  commissionPercentage: doublePrecision("commission_percentage").notNull(),
  companyGCI: doublePrecision("company_gci").notNull(), // 15% of total commission
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

// Insert schemas
export const insertAgentSchema = createInsertSchema(agents)
  .omit({ id: true, createdAt: true })
  .extend({
    agentType: z.enum([AgentType.PRINCIPAL, AgentType.SUPPORT]),
    capType: z.enum([CapType.STANDARD, CapType.TEAM]).optional(),
    sponsorId: z.number().optional(),
    anniversaryDate: z.coerce.date()
  });

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true })
  .extend({
    transactionDate: z.coerce.date(),
    saleAmount: z.number().positive(),
    commissionPercentage: z.number().positive(),
    companyGCI: z.number().positive()
  });

export const insertRevenueShareSchema = createInsertSchema(revenueShares)
  .omit({ id: true, createdAt: true });

// Types
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type RevenueShare = typeof revenueShares.$inferSelect;
export type InsertRevenueShare = z.infer<typeof insertRevenueShareSchema>;

// Additional type for agent with downline information
export interface AgentWithDownline extends Agent {
  downline?: AgentWithDownline[];
  sponsor?: Agent;
  totalEarnings?: number;
}
