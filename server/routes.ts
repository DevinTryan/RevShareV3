import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAgentSchema, 
  insertTransactionSchema,
  AgentType,
  CapType,
  UserRole,
  User,
  agents,
  transactions
} from "../shared/schema.js";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  registerWebhook, 
  listWebhooks, 
  deleteWebhook, 
  validateWebhookSignature, 
  processTransactionWebhook, 
  processAgentWebhook,
  handleZapierTest,
  triggerWebhooks 
} from "./webhooks";
import { setupAuth, hashPassword } from "./auth";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication and get middleware
  const { requireAuth, requireAdmin, requireAgentAccess } = setupAuth(app);
  // API Routes for Agents
  app.get("/api/agents", requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/downline", requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await storage.getAgentsWithDownline();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents with downline" });
    }
  });

  app.get("/api/agents/root", requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await storage.getAgentsByRootLevelOnly();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch root level agents" });
    }
  });

  app.get("/api/agents/:id", requireAgentAccess, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.get("/api/agents/:id/downline", requireAgentAccess, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgentWithDownline(id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent with downline" });
    }
  });

  app.post("/api/agents", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get the data
      const rawData = req.body;
      console.log("Creating agent with data:", JSON.stringify(rawData, null, 2));

      // Process anniversary date before validation
      if (rawData.anniversaryDate && typeof rawData.anniversaryDate === 'string') {
        try {
          console.log("Original anniversaryDate:", rawData.anniversaryDate);
          // If it's just a date without time, add the time portion
          if (rawData.anniversaryDate.length <= 10) {
            rawData.anniversaryDate = new Date(rawData.anniversaryDate + "T00:00:00.000Z");
          } else {
            rawData.anniversaryDate = new Date(rawData.anniversaryDate);
          }
          console.log("Converted anniversaryDate:", rawData.anniversaryDate);
        } catch (dateError) {
          console.error("Error converting anniversaryDate:", dateError);
          return res.status(400).json({
            message: "Invalid date format for anniversaryDate. Please use YYYY-MM-DD format."
          });
        }
      }

      const agentData = insertAgentSchema.parse(rawData);
      const agent = await storage.createAgent(agentData);
      
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const agentData = req.body;
      
      console.log("Updating agent with ID:", id);
      console.log("Update data:", JSON.stringify(agentData, null, 2));
      
      // First check if the agent exists
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      // Make sure all required fields are present
      if (!agentData.name || !agentData.agentType) {
        return res.status(400).json({
          message: "Missing required fields. Name and agent type are required."
        });
      }
      
      // Process the data before updating
      const processedData = { ...agentData };
      
      // Convert anniversaryDate to a proper Date object if it's a string
      if (processedData.anniversaryDate && typeof processedData.anniversaryDate === 'string') {
        try {
          console.log("Original anniversaryDate:", processedData.anniversaryDate);
          // If it's just a date without time, add the time portion
          if (processedData.anniversaryDate.length <= 10) {
            processedData.anniversaryDate = new Date(processedData.anniversaryDate + "T00:00:00.000Z");
          } else {
            processedData.anniversaryDate = new Date(processedData.anniversaryDate);
          }
          console.log("Converted anniversaryDate:", processedData.anniversaryDate);
        } catch (error) {
          console.error("Error converting anniversaryDate:", error);
          return res.status(400).json({
            message: "Invalid date format for anniversaryDate. Please use YYYY-MM-DD format."
          });
        }
      }
      
      // Ensure gciSinceAnniversary is a number
      if (processedData.gciSinceAnniversary !== undefined) {
        processedData.gciSinceAnniversary = Number(processedData.gciSinceAnniversary);
      }
      
      // Attempt to update
      const updatedAgent = await storage.updateAgent(id, processedData);
      
      if (!updatedAgent) {
        return res.status(500).json({ message: "Failed to update agent" });
      }
      
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: `Failed to update agent: ${error.message}` });
    }
  });

  app.delete("/api/agents/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      console.log("Deleting agent with ID:", id);
      
      // First check if the agent exists
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      // Instead of preventing deletion, save agent name for transactions
      // This way transactions will still display the agent name even after deletion
      try {
        const hasTransactions = await db
          .select({ count: sql`count(*)` })
          .from(transactions)
          .where(eq(transactions.agentId, id));
          
        if (hasTransactions.length > 0 && Number(hasTransactions[0].count) > 0) {
          // Create an "archived" field to store agent name for transactions
          await db.execute(sql`
            ALTER TABLE transactions 
            ADD COLUMN IF NOT EXISTS agent_name_archived TEXT
          `);
          
          // Save the agent name to all transactions before deletion
          await db.execute(sql`
            UPDATE transactions
            SET agent_name_archived = ${agent.name}
            WHERE agent_id = ${id}
          `);
          
          console.log(`Agent name '${agent.name}' archived for ${hasTransactions[0].count} transactions`);
        }
      } catch (txError) {
        console.error("Error updating transaction agent names:", txError);
        // Continue with deletion even if archiving fails
      }
      
      // Check if agent has downline
      const agentWithDownline = await storage.getAgentWithDownline(id);
      if (agentWithDownline?.downline && agentWithDownline.downline.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete agent with sponsored agents. Please reassign or delete sponsored agents first." 
        });
      }
      
      // Try to delete the agent
      const success = await storage.deleteAgent(id);
      
      if (!success) {
        return res.status(400).json({ 
          message: "Could not delete agent. The agent may have revenue shares or other related records." 
        });
      }
      
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: `Failed to delete agent: ${error.message}` });
    }
  });

  // API Routes for Transactions
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.get("/api/agents/:id/transactions", requireAgentAccess, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const transactions = await storage.getAgentTransactions(agentId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("Transaction data received:", JSON.stringify(req.body));
      
      // Calculate companyGCI if not provided
      const data = req.body;
      if (!data.companyGCI && data.saleAmount && data.commissionPercentage) {
        const commission = (data.saleAmount * data.commissionPercentage) / 100;
        data.companyGCI = commission * 0.15; // 15% of commission is company GCI
      }
      
      const transactionData = insertTransactionSchema.parse(data);
      console.log("Parsed transaction data:", JSON.stringify(transactionData));
      
      const transaction = await storage.createTransaction(transactionData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Transaction creation error:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });
  
  app.put("/api/transactions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      
      console.log("Transaction update received:", JSON.stringify(data, null, 2));
      
      // If manually adjusting the company share vs agent share
      if (data.totalCommissionAmount && data.companyPercentage) {
        const totalCommission = data.totalCommissionAmount;
        const companyPercentage = data.companyPercentage;
        data.companyGCI = (totalCommission * companyPercentage) / 100;
      }
      
      // Handle additionalAgents specially if it exists
      if (data.additionalAgents && Array.isArray(data.additionalAgents)) {
        console.log(`Processing ${data.additionalAgents.length} additional agents`);
        
        // For now we're handling only the first additional agent in the array
        // You may want to extend this to handle multiple agents in the future
        if (data.additionalAgents.length > 0) {
          const firstAgent = data.additionalAgents[0];
          data.additionalAgentId = firstAgent.agentId;
          data.additionalAgentFee = firstAgent.additionalCost || 0;
          data.additionalAgentPercentage = firstAgent.percentage || 0;
        }
        
        // Remove the additionalAgents array before passing to storage layer
        delete data.additionalAgents;
      }
      
      const updatedTransaction = await storage.updateTransaction(id, data);
      
      if (!updatedTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Transaction update error:", error);
      res.status(500).json({ 
        message: "Failed to update transaction", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.delete("/api/transactions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTransaction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // API Routes for Revenue Shares
  app.get("/api/revenue-shares", requireAuth, async (req: Request, res: Response) => {
    try {
      const revenueShares = await storage.getRevenueShares();
      res.json(revenueShares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch revenue shares" });
    }
  });

  app.get("/api/transactions/:id/revenue-shares", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      const revenueShares = await storage.getRevenueSharesByTransaction(transactionId);
      res.json(revenueShares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction revenue shares" });
    }
  });

  app.get("/api/agents/:id/revenue-shares", requireAgentAccess, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const revenueShares = await storage.getRevenueSharesByAgent(agentId);
      res.json(revenueShares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent revenue shares" });
    }
  });

  // Reports API Endpoints
  app.get("/api/reports/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        agentId,
        transactionType,
        leadSource,
        address,
        zipCode,
        minSaleAmount,
        maxSaleAmount
      } = req.query;

      // Build the filters
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.startDate = startDate as string;
        filters.endDate = endDate as string;
      }
      
      if (agentId) {
        filters.agentId = parseInt(agentId as string);
      }
      
      if (transactionType) {
        filters.transactionType = transactionType as string;
      }
      
      if (leadSource) {
        filters.leadSource = leadSource as string;
      }
      
      if (address) {
        filters.address = address as string;
      }
      
      if (zipCode) {
        filters.zipCode = zipCode as string;
      }
      
      if (minSaleAmount) {
        filters.minSaleAmount = parseFloat(minSaleAmount as string);
      }
      
      if (maxSaleAmount) {
        filters.maxSaleAmount = parseFloat(maxSaleAmount as string);
      }
      
      const transactions = await storage.getFilteredTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error("Reports error:", error);
      res.status(500).json({ message: "Failed to generate transaction report" });
    }
  });

  app.get("/api/reports/agent-performance", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, agentId } = req.query;
      
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.startDate = startDate as string;
        filters.endDate = endDate as string;
      }
      
      if (agentId) {
        filters.agentId = parseInt(agentId as string);
      }
      
      const agentPerformance = await storage.getAgentPerformanceReport(filters);
      res.json(agentPerformance);
    } catch (error) {
      console.error("Agent performance report error:", error);
      res.status(500).json({ message: "Failed to generate agent performance report" });
    }
  });

  app.get("/api/reports/lead-source", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, agentId } = req.query;
      
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.startDate = startDate as string;
        filters.endDate = endDate as string;
      }
      
      if (agentId) {
        filters.agentId = parseInt(agentId as string);
      }
      
      const leadSourceReport = await storage.getLeadSourceReport(filters);
      res.json(leadSourceReport);
    } catch (error) {
      console.error("Lead source report error:", error);
      res.status(500).json({ message: "Failed to generate lead source report" });
    }
  });

  app.get("/api/reports/income-distribution", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, agentId } = req.query;
      
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.startDate = startDate as string;
        filters.endDate = endDate as string;
      }
      
      if (agentId) {
        filters.agentId = parseInt(agentId as string);
      }
      
      const incomeReport = await storage.getIncomeDistributionReport(filters);
      res.json(incomeReport);
    } catch (error) {
      console.error("Income distribution report error:", error);
      res.status(500).json({ message: "Failed to generate income distribution report" });
    }
  });

  app.get("/api/reports/zip-code-analysis", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.startDate = startDate as string;
        filters.endDate = endDate as string;
      }
      
      const zipCodeReport = await storage.getZipCodeAnalysisReport(filters);
      res.json(zipCodeReport);
    } catch (error) {
      console.error("Zip code analysis report error:", error);
      res.status(500).json({ message: "Failed to generate zip code analysis report" });
    }
  });

  // Webhook Routes for Zapier Integration
  
  // Management endpoints for webhooks
  app.post("/api/webhooks", requireAdmin, registerWebhook);
  app.get("/api/webhooks", requireAdmin, listWebhooks);
  app.delete("/api/webhooks/:id", requireAdmin, deleteWebhook);
  
  // Webhook endpoints for Zapier to send data to our app
  app.post("/api/webhooks/zapier/transaction", validateWebhookSignature, processTransactionWebhook);
  app.post("/api/webhooks/zapier/agent", validateWebhookSignature, processAgentWebhook);
  
  // Webhook test endpoint
  app.post("/api/webhooks/test", requireAdmin, handleZapierTest);
  
  // Health check endpoint for Render
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // User Management API Endpoints (Admin only)
  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.get("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  app.post("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userData = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create the user
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.put("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user
      const user = await storage.updateUser(id, userData);
      res.json(user);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent deleting the only admin user
      const users = await storage.getUsers();
      const admins = users.filter(user => user.role === 'admin');
      
      if (admins.length === 1 && admins[0].id === id) {
        return res.status(400).json({ message: "Cannot delete the only admin user" });
      }
      
      // Delete the user
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Hash the password before saving
      const hashedPassword = await hashPassword(password);
      
      // Update the user with the new password
      const user = await storage.updateUser(id, { password: hashedPassword });
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  
  // Add a hook to trigger webhooks whenever transactions are created
  const originalCreateTransaction = storage.createTransaction;
  storage.createTransaction = async (data) => {
    const transaction = await originalCreateTransaction(data);
    // Trigger webhook after transaction is created
    triggerWebhooks('transaction.created', transaction);
    return transaction;
  };
  
  // Add a hook for agent creation
  const originalCreateAgent = storage.createAgent;
  storage.createAgent = async (data) => {
    const agent = await originalCreateAgent(data);
    // Trigger webhook after agent is created
    triggerWebhooks('agent.created', agent);
    return agent;
  };

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = req.body;

      // Prevent admin registration through API
      if (userData.role === UserRole.ADMIN) {
        return res.status(403).json({ message: "Admin registration is not allowed" });
      }

      // Validate registration code
      const registrationCode = userData.registrationCode;
      if (!registrationCode) {
        return res.status(400).json({ message: "Registration code is required" });
      }

      // Check if registration code exists and is unused
      const existingCode = await db.query.registrationCodes.findFirst({
        where: (codes, { eq, and }) => and(
          eq(codes.code, registrationCode),
          eq(codes.used, 0)
        )
      });

      if (!existingCode) {
        return res.status(400).json({ message: "Invalid or used registration code" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(userData.password);

      // Create the user
      const user = await db.insert(users).values({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: UserRole.AGENT, // Force role to be agent
        agentId: userData.agentId
      });

      // Mark registration code as used
      await db.update(registrationCodes)
        .set({ 
          used: 1,
          usedBy: user.id,
          usedAt: new Date().toISOString()
        })
        .where(eq(registrationCodes.code, registrationCode));

      res.status(201).json(user);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Generate registration code (admin only)
  app.post("/api/admin/registration-codes", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Generate a random 8-character code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Store the code
      await db.insert(registrationCodes).values({
        code,
        createdBy: (req.user as User).id,
        createdAt: new Date().toISOString(),
        used: false
      });

      res.status(201).json({ code });
    } catch (error) {
      console.error("Error generating registration code:", error);
      res.status(500).json({ message: "Failed to generate registration code" });
    }
  });

  // List registration codes (admin only)
  app.get("/api/admin/registration-codes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const codes = await db.query.registrationCodes.findMany({
        orderBy: (codes, { desc }) => [desc(codes.createdAt)]
      });
      
      res.json(codes);
    } catch (error) {
      console.error("Error fetching registration codes:", error);
      res.status(500).json({ message: "Failed to fetch registration codes" });
    }
  });

  // Create server
  const httpServer = createServer(app);

  return httpServer;
}
