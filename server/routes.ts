import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAgentSchema, 
  insertTransactionSchema,
  AgentType,
  CapType,
  UserRole,
  User
} from "@shared/schema";
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
import { setupAuth } from "./auth";

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
      const agentData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
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
      
      const updatedAgent = await storage.updateAgent(id, agentData);
      
      if (!updatedAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json(updatedAgent);
    } catch (error) {
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAgent(id);
      
      if (!success) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete agent" });
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
      
      // If manually adjusting the company share vs agent share
      if (data.totalCommissionAmount && data.companyPercentage) {
        const totalCommission = data.totalCommissionAmount;
        const companyPercentage = data.companyPercentage;
        data.companyGCI = (totalCommission * companyPercentage) / 100;
      }
      
      const updatedTransaction = await storage.updateTransaction(id, data);
      
      if (!updatedTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Transaction update error:", error);
      res.status(500).json({ message: "Failed to update transaction" });
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
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
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
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
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

  // Create server
  const httpServer = createServer(app);

  return httpServer;
}
