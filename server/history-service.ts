import { db } from './db';
import { sql } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import {
  dataHistory,
  userHistory,
  agentHistory,
  transactionHistory,
  InsertDataHistory,
  InsertUserHistory,
  InsertAgentHistory,
  InsertTransactionHistory
} from '../shared/schema';
import { Request } from 'express';
import { createAuditLog } from './audit';

export class HistoryService {
  /**
   * Track generic data changes
   */
  static async trackDataChange(
    entityType: string,
    entityId: number,
    userId: number,
    action: string,
    previousState?: any,
    newState?: any,
    metadata?: any,
    req?: Request
  ): Promise<void> {
    const historyEntry: InsertDataHistory = {
      entityType,
      entityId,
      userId,
      action,
      previousState: previousState ? JSON.stringify(previousState) : null,
      newState: newState ? JSON.stringify(newState) : null,
      metadata: metadata ? JSON.stringify(metadata) : null
    };

    await db.insert(dataHistory).values(historyEntry);
    
    // Also create an audit log entry
    await createAuditLog(
      userId,
      action,
      entityType,
      entityId,
      previousState,
      newState,
      req,
      metadata
    );
  }

  /**
   * Track user changes
   */
  static async trackUserChange(
    userId: number,
    performedBy: number,
    action: string,
    changes: any,
    req?: Request
  ): Promise<void> {
    const historyEntry: InsertUserHistory = {
      userId,
      action,
      changes: JSON.stringify(changes),
      performedBy
    };

    await db.insert(userHistory).values(historyEntry);
    
    // Also create an audit log entry
    await createAuditLog(
      performedBy,
      action,
      'user',
      userId,
      null,
      changes,
      req
    );
  }

  /**
   * Track agent changes
   */
  static async trackAgentChange(
    agentId: number,
    performedBy: number,
    action: string,
    changes: any,
    req?: Request
  ): Promise<void> {
    const historyEntry: InsertAgentHistory = {
      agentId,
      action,
      changes: JSON.stringify(changes),
      performedBy
    };

    await db.insert(agentHistory).values(historyEntry);
    
    // Also create an audit log entry
    await createAuditLog(
      performedBy,
      action,
      'agent',
      agentId,
      null,
      changes,
      req
    );
  }

  /**
   * Track transaction changes
   */
  static async trackTransactionChange(
    transactionId: number,
    performedBy: number,
    action: string,
    changes: any,
    req?: Request
  ): Promise<void> {
    const historyEntry: InsertTransactionHistory = {
      transactionId,
      action,
      changes: JSON.stringify(changes),
      performedBy
    };

    await db.insert(transactionHistory).values(historyEntry);
    
    // Also create an audit log entry
    await createAuditLog(
      performedBy,
      action,
      'transaction',
      transactionId,
      null,
      changes,
      req
    );
  }

  /**
   * Get history for any entity
   */
  static async getEntityHistory(
    entityType: string,
    entityId: number,
    limit: number = 100,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(dataHistory)
      .where(sql`${dataHistory.entityType} = ${entityType} AND ${dataHistory.entityId} = ${entityId}`)
      .orderBy(desc(dataHistory.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get user history
   */
  static async getUserHistory(
    userId: number,
    limit: number = 100,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(userHistory)
      .where(sql`${userHistory.userId} = ${userId}`)
      .orderBy(desc(userHistory.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get agent history
   */
  static async getAgentHistory(
    agentId: number,
    limit: number = 100,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(agentHistory)
      .where(sql`${agentHistory.agentId} = ${agentId}`)
      .orderBy(desc(agentHistory.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    transactionId: number,
    limit: number = 100,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(transactionHistory)
      .where(sql`${transactionHistory.transactionId} = ${transactionId}`)
      .orderBy(desc(transactionHistory.timestamp))
      .limit(limit)
      .offset(offset);
  }
} 