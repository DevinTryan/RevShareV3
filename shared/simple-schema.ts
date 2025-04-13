import { pgTable, serial, integer, doublePrecision, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agent types
export enum AgentType {
  PRINCIPAL = "principal",
  SUPPORT = "support"
}

// Agent table definition
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentType: text("agent_type").notNull().$type<AgentType>(),
  createdAt: timestamp("created_at").defaultNow()
});

// Simple Transaction table definition
export const transactions = pgTable("simple_transactions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  transactionDate: timestamp("transaction_date").notNull(),
  propertyAddress: text("property_address").notNull(),
  totalSalesPrice: doublePrecision("total_sales_price").notNull(),
  totalGCI: doublePrecision("total_gci").notNull(),
  agentGCI: doublePrecision("agent_gci").notNull(),
  companyGCI: doublePrecision("company_gci").notNull(),
  complianceFee: doublePrecision("compliance_fee").default(0),
  createdAt: timestamp("created_at").defaultNow()
});

// Define insert schemas for validation
export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

// Define types based on the schemas
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;