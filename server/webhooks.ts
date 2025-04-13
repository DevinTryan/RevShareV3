import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { storage } from './storage';
import { InsertTransaction, InsertAgent } from '@shared/schema';

// This secret would normally be stored in environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'zapier-webhook-secret';

// Interface for webhook registrations
interface WebhookRegistration {
  id: string;
  url: string;
  event: string;
  createdAt: Date;
}

// In-memory storage for webhook registrations (would be stored in database in production)
const webhooks: WebhookRegistration[] = [];

/**
 * Register a new webhook endpoint
 */
export async function registerWebhook(req: Request, res: Response) {
  try {
    const { url, event } = req.body;
    
    if (!url || !event) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'URL and event are required' 
      });
    }
    
    // Generate a unique ID for the webhook
    const id = crypto.randomUUID();
    
    // Store the webhook registration
    webhooks.push({
      id,
      url,
      event,
      createdAt: new Date()
    });
    
    return res.status(201).json({ 
      id, 
      message: 'Webhook registered successfully',
      url,
      event
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    return res.status(500).json({ error: 'Failed to register webhook' });
  }
}

/**
 * List all registered webhooks
 */
export async function listWebhooks(req: Request, res: Response) {
  try {
    return res.status(200).json(webhooks);
  } catch (error) {
    console.error('Error listing webhooks:', error);
    return res.status(500).json({ error: 'Failed to list webhooks' });
  }
}

/**
 * Delete a webhook by ID
 */
export async function deleteWebhook(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const index = webhooks.findIndex(wh => wh.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    webhooks.splice(index, 1);
    
    return res.status(200).json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return res.status(500).json({ error: 'Failed to delete webhook' });
  }
}

/**
 * Send data to all registered webhooks for a specific event
 */
export async function triggerWebhooks(event: string, data: any) {
  const eventWebhooks = webhooks.filter(wh => wh.event === event);
  
  if (eventWebhooks.length === 0) {
    return; // No webhooks registered for this event
  }
  
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };
  
  // Create signature for payload verification
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  // Send to all registered webhooks for this event
  for (const webhook of eventWebhooks) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Failed to send webhook to ${webhook.url}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error sending webhook to ${webhook.url}:`, error);
    }
  }
}

/**
 * Validate webhook signature in incoming requests from Zapier
 */
export function validateWebhookSignature(req: Request, res: Response, next: Function) {
  const signature = req.headers['x-webhook-signature'];
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }
  
  const calculatedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== calculatedSignature) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  
  next();
}

/**
 * Process a webhook from Zapier - for creating transactions
 */
export async function processTransactionWebhook(req: Request, res: Response) {
  try {
    const transactionData = req.body as InsertTransaction;
    
    // Validate required fields
    if (!transactionData.agentId || !transactionData.propertyAddress || 
        !transactionData.saleAmount || !transactionData.commissionPercentage) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'agentId, propertyAddress, saleAmount, and commissionPercentage are required'
      });
    }
    
    // Create the transaction
    const transaction = await storage.createTransaction(transactionData);
    
    return res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Error processing transaction webhook:', error);
    return res.status(500).json({ error: 'Failed to process transaction webhook' });
  }
}

/**
 * Process a webhook from Zapier - for creating agents
 */
export async function processAgentWebhook(req: Request, res: Response) {
  try {
    const agentData = req.body as InsertAgent;
    
    // Validate required fields
    if (!agentData.name || !agentData.agentType || !agentData.anniversaryDate) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'name, agentType, and anniversaryDate are required'
      });
    }
    
    // Create the agent
    const agent = await storage.createAgent(agentData);
    
    return res.status(201).json({
      message: 'Agent created successfully',
      agent
    });
  } catch (error) {
    console.error('Error processing agent webhook:', error);
    return res.status(500).json({ error: 'Failed to process agent webhook' });
  }
}

/**
 * Handle Zapier test webhook
 */
export async function handleZapierTest(req: Request, res: Response) {
  return res.status(200).json({
    message: 'Webhook test successful',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
}