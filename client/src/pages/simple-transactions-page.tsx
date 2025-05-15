import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Edit } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

export default function SimpleTransactionsPage() {
  const [, navigate] = useLocation();

  // Fetch transactions
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ['/api/transactions'],
  });

  // Fetch agents for mapping agent IDs to names
  const { data: agents } = useQuery({
    queryKey: ['/api/agents'],
  });

  // Get agent name from ID
  const getAgentName = (agentId: number) => {
    if (!agents || !Array.isArray(agents)) return `Agent #${agentId}`;
    const agent = agents.find((a: any) => a.id === agentId);
    return agent ? agent.name : `Agent #${agentId}`;
  };

  // Handle click on a transaction
  const handleTransactionClick = (transactionId: number) => {
    navigate(`/transactions/${transactionId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error loading transactions: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Link href="/transactions/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Transaction
          </Button>
        </Link>
      </div>

      {!transactions || (Array.isArray(transactions) && transactions.length === 0) ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <p className="text-muted-foreground">No transactions found.</p>
              <Link href="/transactions/new">
                <Button variant="link" className="mt-2">
                  Create your first transaction
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-white">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="h-12 px-4 text-left font-medium">ID</th>
                  <th className="h-12 px-4 text-left font-medium">Date</th>
                  <th className="h-12 px-4 text-left font-medium">Agent</th>
                  <th className="h-12 px-4 text-left font-medium">Property Address</th>
                  <th className="h-12 px-4 text-right font-medium">Sale Amount</th>
                  <th className="h-12 px-4 text-right font-medium">Company GCI</th>
                  <th className="h-12 px-4 text-right font-medium">Agent GCI</th>
                  <th className="h-12 px-4 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(transactions) && transactions.map((transaction: any) => (
                  <tr 
                    key={transaction.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleTransactionClick(transaction.id)}
                  >
                    <td className="p-4 align-middle">{transaction.id}</td>
                    <td className="p-4 align-middle">
                      {transaction.transactionDate ? 
                        format(new Date(transaction.transactionDate), "MMM dd, yyyy") : 
                        "N/A"
                      }
                    </td>
                    <td className="p-4 align-middle">{getAgentName(transaction.agentId)}</td>
                    <td className="p-4 align-middle font-medium">{transaction.propertyAddress}</td>
                    <td className="p-4 align-middle text-right">{formatCurrency(transaction.saleAmount)}</td>
                    <td className="p-4 align-middle text-right">{formatCurrency(transaction.companyGCI)}</td>
                    <td className="p-4 align-middle text-right">{formatCurrency(transaction.agentCommissionAmount)}</td>
                    <td className="p-4 align-middle text-center">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="inline-flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          navigate(`/transactions/${transaction.id}`);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}