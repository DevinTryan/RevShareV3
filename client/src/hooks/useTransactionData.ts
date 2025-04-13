import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Transaction, InsertTransaction, RevenueShare } from "@shared/schema";

export function useTransactionData() {
  // Get all transactions
  const { 
    data: transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Get transactions for a specific agent
  const getAgentTransactions = (agentId: number) => {
    return useQuery<Transaction[]>({
      queryKey: [`/api/agents/${agentId}/transactions`],
    });
  };

  // Get revenue shares for a transaction
  const getTransactionRevenueShares = (transactionId: number) => {
    return useQuery<RevenueShare[]>({
      queryKey: [`/api/transactions/${transactionId}/revenue-shares`],
    });
  };

  // Get revenue shares for an agent
  const getAgentRevenueShares = (agentId: number) => {
    return useQuery<RevenueShare[]>({
      queryKey: [`/api/agents/${agentId}/revenue-shares`],
    });
  };

  // Create a new transaction
  const createTransactionMutation = useMutation({
    mutationFn: async (transaction: InsertTransaction) => {
      const response = await apiRequest('POST', '/api/transactions', transaction);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/revenue-shares'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] }); // Refresh agents to update caps
    },
  });

  return {
    transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
    getAgentTransactions,
    getTransactionRevenueShares,
    getAgentRevenueShares,
    createTransaction: createTransactionMutation.mutate,
    isCreatingTransaction: createTransactionMutation.isPending,
  };
}
