import React, { useState, ChangeEvent } from 'react';
import { format } from 'date-fns';
import './AdminHistory.css';

interface HistoryEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  timestamp: string;
  changes: string;
  performedBy: number;
}

type HistoryType = 'user' | 'agent' | 'transaction';

export function AdminHistory() {
  const [historyType, setHistoryType] = useState<HistoryType>('user');
  const [entityId, setEntityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const showMessage = (type: 'error' | 'success', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchHistory = async () => {
    if (!entityId) {
      showMessage('error', 'Please enter an ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/history/${historyType}/${entityId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      showMessage('error', 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const exportAuditLogs = async () => {
    if (!startDate || !endDate) {
      showMessage('error', 'Please select both start and end dates');
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/audit-logs/export?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showMessage('success', 'Audit logs exported successfully');
    } catch (error) {
      showMessage('error', 'Failed to export audit logs');
    }
  };

  const handleHistoryTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setHistoryType(e.target.value as HistoryType);
  };

  const handleEntityIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEntityId(e.target.value);
  };

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  return (
    <div className="admin-history">
      <h1 className="title">History & Audit Logs</h1>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <h2>View History</h2>
          <div className="control-row">
            <select
              value={historyType}
              onChange={handleHistoryTypeChange}
              className="select"
            >
              <option value="user">User History</option>
              <option value="agent">Agent History</option>
              <option value="transaction">Transaction History</option>
            </select>
            <input
              type="text"
              placeholder="Enter ID"
              value={entityId}
              onChange={handleEntityIdChange}
              className="input"
            />
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="button primary"
            >
              {loading ? 'Loading...' : 'View History'}
            </button>
          </div>
        </div>

        <div className="control-group">
          <h2>Export Audit Logs</h2>
          <div className="control-row">
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="input"
            />
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="input"
            />
            <button
              onClick={exportAuditLogs}
              className="button secondary"
            >
              Export Logs
            </button>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Changes</th>
                <th>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{format(new Date(entry.timestamp), 'PPpp')}</td>
                  <td>
                    <span className={`badge ${entry.action.toLowerCase().includes('create') ? 'green' :
                      entry.action.toLowerCase().includes('update') ? 'blue' :
                      entry.action.toLowerCase().includes('delete') ? 'red' : 'gray'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td>
                    <div className="changes-cell">
                      {typeof entry.changes === 'string' ? 
                        entry.changes : 
                        JSON.stringify(entry.changes, null, 2)
                      }
                    </div>
                  </td>
                  <td>{entry.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 