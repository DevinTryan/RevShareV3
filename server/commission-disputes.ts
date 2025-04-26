import { db } from './db';
import { transactions, users, auditLogs } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from './audit';
import { Request } from 'express';

interface CommissionAdjustment {
  transactionId: number;
  adjustmentAmount: number;
  reason: string;
  adjustedBy: number;
  adjustedAt: Date;
}

/**
 * Create a commission dispute
 */
export async function createCommissionDispute(
  transactionId: number,
  reason: string,
  userId: number,
  req?: Request
): Promise<void> {
  // Update transaction with dispute information
  await db
    .update(transactions)
    .set({
      isDisputed: true,
      disputeReason: reason,
      lastModifiedBy: userId,
      lastModifiedAt: new Date()
    })
    .where(eq(transactions.id, transactionId));

  // Create audit log
  await createAuditLog(
    userId,
    'create_dispute',
    'transaction',
    transactionId,
    null,
    { reason },
    req
  );
}

/**
 * Resolve a commission dispute
 */
export async function resolveCommissionDispute(
  transactionId: number,
  resolution: string,
  userId: number,
  req?: Request
): Promise<void> {
  // Update transaction with resolution information
  await db
    .update(transactions)
    .set({
      isDisputed: false,
      disputeReason: null,
      disputeResolvedAt: new Date(),
      disputeResolvedBy: userId,
      lastModifiedBy: userId,
      lastModifiedAt: new Date()
    })
    .where(eq(transactions.id, transactionId));

  // Create audit log
  await createAuditLog(
    userId,
    'resolve_dispute',
    'transaction',
    transactionId,
    null,
    { resolution },
    req
  );
}

/**
 * Apply a commission adjustment
 */
export async function applyCommissionAdjustment(
  adjustment: CommissionAdjustment,
  req?: Request
): Promise<void> {
  // Get the current transaction
  const transaction = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, adjustment.transactionId))
    .limit(1);

  if (transaction.length === 0) {
    throw new Error('Transaction not found');
  }

  const currentTransaction = transaction[0];
  const currentAmount = currentTransaction.agentCommissionAmount || 0;

  // Calculate new commission amount
  const newCommissionAmount = currentAmount + adjustment.adjustmentAmount;

  // Update transaction with adjustment
  await db
    .update(transactions)
    .set({
      agentCommissionAmount: newCommissionAmount,
      lastModifiedBy: adjustment.adjustedBy,
      lastModifiedAt: adjustment.adjustedAt
    })
    .where(eq(transactions.id, adjustment.transactionId));

  // Create audit log
  await createAuditLog(
    adjustment.adjustedBy,
    'adjust_commission',
    'transaction',
    adjustment.transactionId,
    {
      oldAmount: currentAmount,
      adjustmentAmount: adjustment.adjustmentAmount
    },
    {
      newAmount: newCommissionAmount,
      reason: adjustment.reason
    },
    req
  );
}

/**
 * Get all disputed transactions
 */
export async function getDisputedTransactions() {
  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.isDisputed, true))
    .orderBy(transactions.lastModifiedAt);
}

/**
 * Get commission adjustment history for a transaction
 */
export async function getCommissionAdjustmentHistory(transactionId: number) {
  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, 'transaction'),
        eq(auditLogs.entityId, transactionId),
        eq(auditLogs.action, 'adjust_commission')
      )
    )
    .orderBy(auditLogs.createdAt);
}

/**
 * Validate commission adjustment
 */
export function validateCommissionAdjustment(
  currentAmount: number,
  adjustmentAmount: number
): { isValid: boolean; message?: string } {
  // Ensure adjustment doesn't result in negative commission
  if (currentAmount + adjustmentAmount < 0) {
    return {
      isValid: false,
      message: 'Adjustment would result in negative commission amount'
    };
  }

  // Ensure adjustment is not too large (e.g., more than 50% of current amount)
  if (Math.abs(adjustmentAmount) > currentAmount * 0.5) {
    return {
      isValid: false,
      message: 'Adjustment amount is too large (more than 50% of current amount)'
    };
  }

  return { isValid: true };
} 