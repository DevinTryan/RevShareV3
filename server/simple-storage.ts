import { eq } from "drizzle-orm";
import { db } from "./db";
import { transactions, type Transaction, type InsertTransaction } from "@shared/simple-schema";
import { agents, type Agent, type InsertAgent } from "@shared/simple-schema";

/**
 * Implementation of the storage interface for simple transactions
 */
export class SimpleStorage {
  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents);
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(id: number): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.id, id));
    return result.length ? result[0] : undefined;
  }

  /**
   * Create a new agent
   */
  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const result = await db.insert(agents).values(insertAgent).returning();
    return result[0];
  }

  /**
   * Get all transactions
   */
  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(transactions.transactionDate);
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result.length ? result[0] : undefined;
  }

  /**
   * Create a new transaction
   */
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    console.log("Creating simple transaction:", JSON.stringify(insertTransaction));
    const result = await db.insert(transactions).values(insertTransaction).returning();
    return result[0];
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(id: number, transactionUpdate: Partial<Transaction>): Promise<Transaction | undefined> {
    try {
      const existingTransaction = await this.getTransaction(id);
      if (!existingTransaction) return undefined;

      const result = await db
        .update(transactions)
        .set(transactionUpdate)
        .where(eq(transactions.id, id))
        .returning();

      return result.length ? result[0] : undefined;
    } catch (error) {
      console.error("Error updating simple transaction:", error);
      return undefined;
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(transactions)
        .where(eq(transactions.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting simple transaction:", error);
      return false;
    }
  }

  /**
   * Get transactions for a specific agent
   */
  async getAgentTransactions(agentId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.agentId, agentId))
      .orderBy(transactions.transactionDate);
  }
}

export const simpleStorage = new SimpleStorage();