import { Router } from 'express';
import { HistoryService } from '../history-service';
import { getAuditLogFiles, exportAuditLogsToCSV } from '../audit';
import { requireAdmin } from '../auth';

const router = Router();

// Get history for any entity
router.get('/history/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const history = await HistoryService.getEntityHistory(
      entityType,
      parseInt(entityId),
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching entity history:', error);
    res.status(500).json({ error: 'Failed to fetch entity history' });
  }
});

// Get user history
router.get('/history/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const history = await HistoryService.getUserHistory(
      parseInt(userId),
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

// Get agent history
router.get('/history/agent/:agentId', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const history = await HistoryService.getAgentHistory(
      parseInt(agentId),
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching agent history:', error);
    res.status(500).json({ error: 'Failed to fetch agent history' });
  }
});

// Get transaction history
router.get('/history/transaction/:transactionId', requireAdmin, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const history = await HistoryService.getTransactionHistory(
      parseInt(transactionId),
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// Get audit log files
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const logs = await getAuditLogFiles(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Export audit logs to CSV
router.get('/audit-logs/export', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const filepath = await exportAuditLogsToCSV(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.download(filepath);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router; 