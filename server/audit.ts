import { db } from './db';
import { auditLogs, InsertAuditLog } from '../shared/schema';
import { Request } from 'express';
import { and, eq, desc, gte, lte } from 'drizzle-orm';

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  oldValues?: any,
  newValues?: any,
  req?: Request
): Promise<void> {
  const auditLog: InsertAuditLog = {
    userId,
    action,
    entityType,
    entityId,
    oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
    newValues: newValues ? JSON.stringify(newValues) : undefined,
    ipAddress: req?.ip,
    userAgent: req?.headers['user-agent']
  };

  await db.insert(auditLogs).values(auditLog);
}

/**
 * Get audit logs for an entity
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: number,
  limit: number = 100,
  offset: number = 0
) {
  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: number,
  limit: number = 100,
  offset: number = 0
) {
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get audit logs by action type
 */
export async function getAuditLogsByAction(
  action: string,
  limit: number = 100,
  offset: number = 0
) {
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, action))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get audit logs within a date range
 */
export async function getAuditLogsByDateRange(
  startDate: Date,
  endDate: Date,
  limit: number = 100,
  offset: number = 0
) {
  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, startDate),
        lte(auditLogs.createdAt, endDate)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
} 