import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Transaction, Agent } from "@shared/schema";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import EditTransactionForm from "@/components/forms/EditTransactionForm";

interface CombinedTransaction extends Transaction {
  agent?: Agent;
  revenueShareTotal?: number;
}

interface TransactionsTableProps {
  limit?: number; // Optional limit for dashboard view
  showViewAll?: boolean;
  onViewAllClick?: () => void;
}

const TransactionsTable = ({ limit, showViewAll = false, onViewAllClick }: TransactionsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Fetch transactions
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });
  
  // Fetch agents
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });
  
  // Fetch revenue shares
  const { data: revenueShares, isLoading: isLoadingRevenueShares } = useQuery<any[]>({
    queryKey: ['/api/revenue-shares'],
  });
  
  // Combine data
  const combinedTransactions = useMemo(() => {
    if (!transactions || !agents) return [];
    
    return transactions.map(transaction => {
      const agent = agents.find(a => a.id === transaction.agentId);
      
      // Calculate total revenue share for this transaction
      let revenueShareTotal = 0;
      if (revenueShares) {
        const transactionShares = revenueShares.filter(share => share.transactionId === transaction.id);
        revenueShareTotal = transactionShares.reduce((sum, share) => sum + share.amount, 0);
      }
      
      return { ...transaction, agent, revenueShareTotal };
    }).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [transactions, agents, revenueShares]);
  
  // Apply pagination and limit
  const displayedTransactions = useMemo(() => {
    if (limit) {
      return combinedTransactions.slice(0, limit);
    }
    
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    return combinedTransactions.slice(start, end);
  }, [combinedTransactions, currentPage, perPage, limit]);
  
  // Handle pagination
  const totalPages = Math.ceil(combinedTransactions.length / perPage);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };
  
  // Function to get initials from agent name
  const getInitials = (name?: string): string => {
    if (!name) return "N/A";
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  // Function to get avatar color based on agent name
  const getAvatarColor = (name?: string): string => {
    if (!name) return "bg-gray-400";
    
    const colors = [
      'bg-primary-600',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-pink-500'
    ];
    
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };
  
  // Loading state
  if (isLoadingTransactions || isLoadingAgents || isLoadingRevenueShares) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  // Empty state
  if (!displayedTransactions.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No transactions found. Add your first transaction to get started.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="text-lg font-semibold text-gray-900 p-6 pb-2">
            Edit Transaction
          </DialogTitle>
          {editingTransaction && (
            <EditTransactionForm 
              transaction={editingTransaction} 
              onClose={() => setIsEditDialogOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
      
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">
          {limit ? 'Recent Transactions' : 'Transactions'}
        </h2>
        {showViewAll && onViewAllClick && (
          <button onClick={onViewAllClick} className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property & Agent
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sale Amount
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company GCI
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue Share
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedTransactions.map(transaction => (
              <tr 
                key={transaction.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setEditingTransaction(transaction);
                  setIsEditDialogOpen(true);
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <div className="text-sm font-bold text-gray-900 mb-1">{transaction.propertyAddress}</div>
                    <div className="flex items-center">
                      <div className={`h-8 w-8 rounded-full ${getAvatarColor(transaction.agent?.name)} flex items-center justify-center text-white font-medium`}>
                        {getInitials(transaction.agent?.name)}
                      </div>
                      <div className="ml-2">
                        <div className="text-xs text-gray-700">{transaction.agent?.name || "Unknown"}</div>
                        <div className="text-xs text-gray-500">{transaction.agent?.agentType === 'principal' ? 'Principal' : 'Support'}</div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(transaction.transactionDate), 'MMM dd, yyyy')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                  ${transaction.saleAmount.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                  ${transaction.companyGCI.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-success-600">
                  ${transaction.revenueShareTotal?.toLocaleString() || '0.00'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTransaction(transaction);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <i className="ri-edit-line mr-1"></i> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {!limit && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <select 
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 sm:text-sm rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              value={perPage}
              onChange={handlePerPageChange}
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <i className="ri-arrow-left-s-line"></i>
            </button>
            
            {[...Array(totalPages)].map((_, index) => (
              <button 
                key={index}
                className={`relative inline-flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === index + 1 ? 'text-primary-600 border-primary-500' : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handlePageChange(index + 1)}
              >
                {index + 1}
              </button>
            ))}
            
            <button 
              className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <i className="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsTable;
