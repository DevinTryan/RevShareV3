import React from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleTransactionForm from "@/components/forms/SimpleTransactionForm";

export default function SimpleTransactionPage() {
  const [location] = useLocation();
  const isNewTransaction = location === "/transactions/new";
  
  // Extract transaction ID from path
  const pathParts = location.split("/");
  const lastPart = pathParts[pathParts.length - 1];
  const transactionId = !isNewTransaction && !isNaN(parseInt(lastPart, 10)) ? 
    parseInt(lastPart, 10) : null;
    
  console.log("Transaction page location:", location);
  console.log("Is new transaction:", isNewTransaction);
  console.log("Transaction ID:", transactionId);

  // If editing, fetch the transaction data
  const { data: transaction, isLoading } = useQuery({
    queryKey: transactionId ? [`/api/transactions/${transactionId}`] : ['skip-query'],
    enabled: !!transactionId,
  });

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link href="/transactions">
          <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Transactions</span>
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <SimpleTransactionForm transaction={transaction} />
        )}
      </div>
    </div>
  );
}