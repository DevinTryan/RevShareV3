import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus } from "lucide-react";
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
    navigate(`/simple-transactions/${transactionId}`);
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
        <Link href="/simple-transaction/new">
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
              <Link href="/simple-transaction/new">
                <Button variant="link" className="mt-2">
                  Create your first transaction
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.isArray(transactions) && transactions.map((transaction: any) => (
            <Card
              key={transaction.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleTransactionClick(transaction.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">{transaction.propertyAddress}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getAgentName(transaction.agentId)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sale Amount:</span>
                    <span className="font-medium">{formatCurrency(transaction.saleAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company GCI:</span>
                    <span className="font-medium">{formatCurrency(transaction.companyGCI)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent GCI:</span>
                    <span className="font-medium">{formatCurrency(transaction.agentCommissionAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {transaction.transactionDate ? (
                        format(new Date(transaction.transactionDate), "MMM dd, yyyy")
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}