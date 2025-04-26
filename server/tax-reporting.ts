import { db } from './db';
import { transactions, agents, Transaction, Agent } from '../shared/schema';
import { eq, and, gte, lte, or, SQL } from 'drizzle-orm';

interface TaxYear {
  year: number;
  startDate: Date;
  endDate: Date;
}

interface AgentReport {
  agentId: number;
  agentName: string;
  totalCommission: number;
  transactionCount: number;
}

/**
 * Get tax year information
 */
export function getTaxYear(year: number): TaxYear {
  return {
    year,
    startDate: new Date(year, 0, 1), // January 1st
    endDate: new Date(year, 11, 31) // December 31st
  };
}

/**
 * Generate 1099 report for an agent
 */
export async function generateAgent1099Report(
  agentId: number,
  year: number
): Promise<{
  agent: Agent;
  totalCommission: number;
  transactions: Transaction[];
  taxYear: TaxYear;
}> {
  const taxYear = getTaxYear(year);

  // Get agent information
  const agent = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (agent.length === 0) {
    throw new Error('Agent not found');
  }

  // Get all transactions for the agent in the tax year
  const agentTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.agentId, agentId),
        gte(transactions.transactionDate, taxYear.startDate),
        lte(transactions.transactionDate, taxYear.endDate)
      )
    )
    .orderBy(transactions.transactionDate);

  // Calculate total commission
  const totalCommission = agentTransactions.reduce(
    (sum: number, transaction: Transaction) => sum + (transaction.agentCommissionAmount || 0),
    0
  );

  return {
    agent: agent[0],
    totalCommission,
    transactions: agentTransactions,
    taxYear
  };
}

/**
 * Generate tax summary report for all agents
 */
export async function generateTaxSummaryReport(year: number): Promise<{
  year: number;
  agents: AgentReport[];
  totalCommission: number;
  totalTransactions: number;
}> {
  const taxYear = getTaxYear(year);

  // Get all transactions for the tax year
  const yearTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, taxYear.startDate),
        lte(transactions.transactionDate, taxYear.endDate)
      )
    );

  // Group transactions by agent
  const agentSummaries = new Map<number, { totalCommission: number; transactionCount: number }>();

  for (const transaction of yearTransactions) {
    const agentId = transaction.agentId;
    const current = agentSummaries.get(agentId) || { totalCommission: 0, transactionCount: 0 };

    agentSummaries.set(agentId, {
      totalCommission: current.totalCommission + (transaction.agentCommissionAmount || 0),
      transactionCount: current.transactionCount + 1
    });
  }

  // Get agent names
  const agentIds = Array.from(agentSummaries.keys());
  const agentList = await db
    .select()
    .from(agents)
    .where(
      agentIds.length > 0
        ? agentIds.map(id => eq(agents.id, id)).reduce((acc: SQL, curr: SQL): SQL => or(acc, curr) as SQL)
        : eq(agents.id, 0) // Fallback condition that will never match
    );

  // Create final report
  const agentReports: AgentReport[] = agentList.map(agent => ({
    agentId: agent.id,
    agentName: agent.name,
    ...agentSummaries.get(agent.id)!
  }));

  const totalCommission = agentReports.reduce((sum: number, report: AgentReport) => sum + report.totalCommission, 0);
  const totalTransactions = agentReports.reduce((sum: number, report: AgentReport) => sum + report.transactionCount, 0);

  return {
    year,
    agents: agentReports,
    totalCommission,
    totalTransactions
  };
}

/**
 * Generate tax report for a specific date range
 */
export async function generateTaxReportByDateRange(
  startDate: Date,
  endDate: Date
): Promise<{
  startDate: Date;
  endDate: Date;
  agents: AgentReport[];
  totalCommission: number;
  totalTransactions: number;
}> {
  // Get all transactions in the date range
  const dateRangeTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )
    );

  // Group transactions by agent
  const agentSummaries = new Map<number, { totalCommission: number; transactionCount: number }>();

  for (const transaction of dateRangeTransactions) {
    const agentId = transaction.agentId;
    const current = agentSummaries.get(agentId) || { totalCommission: 0, transactionCount: 0 };

    agentSummaries.set(agentId, {
      totalCommission: current.totalCommission + (transaction.agentCommissionAmount || 0),
      transactionCount: current.transactionCount + 1
    });
  }

  // Get agent names
  const agentIds = Array.from(agentSummaries.keys());
  const agentList = await db
    .select()
    .from(agents)
    .where(
      agentIds.length > 0
        ? agentIds.map(id => eq(agents.id, id)).reduce((acc: SQL, curr: SQL): SQL => or(acc, curr) as SQL)
        : eq(agents.id, 0) // Fallback condition that will never match
    );

  // Create final report
  const agentReports: AgentReport[] = agentList.map(agent => ({
    agentId: agent.id,
    agentName: agent.name,
    ...agentSummaries.get(agent.id)!
  }));

  const totalCommission = agentReports.reduce((sum: number, report: AgentReport) => sum + report.totalCommission, 0);
  const totalTransactions = agentReports.reduce((sum: number, report: AgentReport) => sum + report.transactionCount, 0);

  return {
    startDate,
    endDate,
    agents: agentReports,
    totalCommission,
    totalTransactions
  };
} 