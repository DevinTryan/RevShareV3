import { db } from './db';
import { auditLogs, InsertAuditLog } from '../shared/schema';
import { Request } from 'express';
import { and, eq, desc, gte, lte } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write to all logs with level 'info' and below to 'combined.log'
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Write all logs error (and below) to 'error.log'
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

interface DetailedAuditLog extends InsertAuditLog {
  details?: {
    changedFields?: string[];
    previousValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: Record<string, any>;
  };
}

/**
 * Create an audit log entry with enhanced details
 */
export async function createAuditLog(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  oldValues?: any,
  newValues?: any,
  req?: Request,
  metadata?: Record<string, any>
): Promise<void> {
  const timestamp = new Date();
  const changedFields = newValues ? Object.keys(newValues) : [];
  
  const auditLog: DetailedAuditLog = {
    userId,
    action,
    entityType,
    entityId,
    oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
    newValues: newValues ? JSON.stringify(newValues) : undefined,
    ipAddress: req?.ip,
    userAgent: req?.headers['user-agent'],
    details: {
      changedFields,
      previousValues: oldValues,
      newValues,
      metadata
    }
  };

  // Log to database
  await db.insert(auditLogs).values(auditLog);

  // Log to file system
  logger.info('Audit Log Entry', {
    ...auditLog,
    timestamp,
    requestPath: req?.path,
    requestMethod: req?.method,
    userRole: req?.user?.role
  });
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

/**
 * Get audit log file contents
 */
export async function getAuditLogFiles(
  startDate?: Date,
  endDate?: Date
): Promise<{ combined: string; error: string }> {
  const combinedPath = path.join(logsDir, 'combined.log');
  const errorPath = path.join(logsDir, 'error.log');
  
  const combined = fs.existsSync(combinedPath) ? 
    fs.readFileSync(combinedPath, 'utf8') : '';
  const error = fs.existsSync(errorPath) ? 
    fs.readFileSync(errorPath, 'utf8') : '';

  if (startDate && endDate) {
    // Filter logs by date range
    const filterByDate = (logs: string) => {
      return logs
        .split('\n')
        .filter(line => {
          if (!line) return false;
          const log = JSON.parse(line);
          const logDate = new Date(log.timestamp);
          return logDate >= startDate && logDate <= endDate;
        })
        .join('\n');
    };

    return {
      combined: filterByDate(combined),
      error: filterByDate(error)
    };
  }

  return { combined, error };
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogsToCSV(
  startDate: Date,
  endDate: Date
): Promise<string> {
  const logs = await getAuditLogsByDateRange(startDate, endDate);
  const csvRows = logs.map(log => ({
    timestamp: log.createdAt,
    userId: log.userId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    ipAddress: log.ipAddress,
    changes: log.newValues,
    previousState: log.oldValues
  }));

  const csvContent = [
    Object.keys(csvRows[0]).join(','),
    ...csvRows.map(row => Object.values(row).join(','))
  ].join('\n');

  const filename = `audit_logs_${startDate.toISOString()}_${endDate.toISOString()}.csv`;
  const filepath = path.join(logsDir, filename);
  fs.writeFileSync(filepath, csvContent);

  return filepath;
} 