import React from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleTransactionForm from "@/components/forms/SimpleTransactionForm";

export default function SimpleTransactionPage() {
  const [location] = useLocation();
  const isNewTransaction = location === "/simple-transaction/new";
  const transactionId = !isNewTransaction ? 
    parseInt(location.split("/")[2], 10) : null;

  // If editing, fetch the transaction data
  const { data: transaction, isLoading } = useQuery({
    queryKey: transactionId ? [`/api/transactions/${transactionId}`] : null,
    enabled: !!transactionId,
  });

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link href="/simple-transactions">
          <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Transactions</span>
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        <SimpleTransactionForm />
      </div>
    </div>
  );
}