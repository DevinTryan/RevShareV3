import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Define a schema for the form with Zod
const transactionFormSchema = z.object({
  agentId: z.number({
    required_error: "Please select an agent",
  }),
  propertyAddress: z.string({
    required_error: "Please enter a property address",
  }),
  saleAmount: z.number({
    required_error: "Please enter a sale amount",
  }).positive(),
  companyGCI: z.number({
    required_error: "Please enter company GCI",
  }).gte(0),
  agentGCI: z.number({
    required_error: "Please enter agent GCI",
  }).gte(0),
  complianceFee: z.coerce.number().default(0),
  transactionDate: z.date({
    required_error: "Please select a transaction date",
  }),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface SimpleTransactionFormProps {
  transaction?: any;
}

export default function SimpleTransactionForm({ transaction }: SimpleTransactionFormProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isEditing = !!transaction;
  const [date, setDate] = useState<Date | undefined>(
    transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date()
  );
  const [totalGCI, setTotalGCI] = useState<number>(0);

  // Fetch agents for dropdown
  const { data: agents } = useQuery({
    queryKey: ['/api/agents'],
  });

  // Form setup
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      agentId: transaction?.agentId || undefined,
      propertyAddress: transaction?.propertyAddress || "",
      saleAmount: transaction?.saleAmount || 0,
      companyGCI: transaction?.companyGCI || 0,
      agentGCI: transaction?.agentCommissionAmount || 0,
      complianceFee: transaction?.complianceFee || 0,
      transactionDate: transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date(),
    },
  });
  
  // Initialize total GCI from transaction if available
  useEffect(() => {
    if (transaction) {
      const agentGCI = transaction.agentCommissionAmount || 0;
      const companyGCI = transaction.companyGCI || 0;
      setTotalGCI(agentGCI + companyGCI);
    }
  }, [transaction]);

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      // Calculate commission percentage (default to 3% if can't be calculated)
      const commissionPercent = totalGCI > 0 && values.saleAmount > 0 
        ? Number(((totalGCI / values.saleAmount) * 100).toFixed(2))
        : 3;
        
      const payload = {
        agentId: values.agentId,
        propertyAddress: values.propertyAddress,
        saleAmount: values.saleAmount,
        companyGCI: values.companyGCI,
        transactionDate: values.transactionDate.toISOString().split('T')[0],
        commissionPercentage: commissionPercent,
        complianceFee: values.complianceFee,
        agentCommissionAmount: values.agentGCI,
      };

      console.log("Creating transaction with payload:", payload);
      const response = await apiRequest("POST", "/api/transactions", payload);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create transaction: ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transaction created",
        description: "The transaction was successfully created",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      navigate("/simple-transactions");
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating transaction",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      if (!transaction?.id) {
        throw new Error("Transaction ID is missing");
      }
      
      // Calculate commission percentage (default to 3% if can't be calculated)
      const commissionPercent = totalGCI > 0 && values.saleAmount > 0 
        ? Number(((totalGCI / values.saleAmount) * 100).toFixed(2))
        : 3;
        
      const payload = {
        agentId: values.agentId,
        propertyAddress: values.propertyAddress,
        saleAmount: values.saleAmount,
        companyGCI: values.companyGCI,
        transactionDate: values.transactionDate.toISOString().split('T')[0],
        commissionPercentage: commissionPercent,
        complianceFee: values.complianceFee,
        agentCommissionAmount: values.agentGCI,
      };

      console.log("Updating transaction with payload:", payload);
      const response = await apiRequest("PUT", `/api/transactions/${transaction.id}`, payload);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update transaction: ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transaction updated",
        description: "The transaction was successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      navigate("/simple-transactions");
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating transaction",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update total GCI when inputs change
  useEffect(() => {
    const saleAmount = form.watch("saleAmount") || 0;
    const companyGCI = form.watch("companyGCI") || 0;
    const agentGCI = form.watch("agentGCI") || 0;
    
    setTotalGCI(companyGCI + agentGCI);
  }, [form]);

  // Form submission handler
  const onSubmit = (values: TransactionFormValues) => {
    if (isEditing) {
      updateTransactionMutation.mutate(values);
    } else {
      createTransactionMutation.mutate(values);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Transaction" : "Create New Transaction"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-4">
            {/* Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="agentId">Agent</Label>
              <Select
                onValueChange={(value) => form.setValue("agentId", Number(value))}
                defaultValue={form.getValues("agentId")?.toString()}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents && Array.isArray(agents) ? 
                    agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    )) : 
                    <SelectItem value="">No agents found</SelectItem>
                  }
                </SelectContent>
              </Select>
              {form.formState.errors.agentId && (
                <p className="text-sm text-red-500">{form.formState.errors.agentId.message}</p>
              )}
            </div>

            {/* Property Address */}
            <div className="space-y-2">
              <Label htmlFor="propertyAddress">Property Address</Label>
              <Input
                id="propertyAddress"
                placeholder="123 Main St, City, State"
                {...form.register("propertyAddress")}
              />
              {form.formState.errors.propertyAddress && (
                <p className="text-sm text-red-500">{form.formState.errors.propertyAddress.message}</p>
              )}
            </div>

            {/* Sale Amount */}
            <div className="space-y-2">
              <Label htmlFor="saleAmount">Total Sales Price ($)</Label>
              <Input
                id="saleAmount"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                {...form.register("saleAmount", { valueAsNumber: true })}
              />
              {form.formState.errors.saleAmount && (
                <p className="text-sm text-red-500">{form.formState.errors.saleAmount.message}</p>
              )}
            </div>

            {/* Total GCI (read-only, calculated) */}
            <div className="space-y-2">
              <Label htmlFor="totalGCI">Total GCI ($)</Label>
              <Input
                id="totalGCI"
                type="number"
                value={totalGCI.toFixed(2)}
                readOnly
                className="bg-gray-100"
              />
            </div>

            {/* Company GCI */}
            <div className="space-y-2">
              <Label htmlFor="companyGCI">Company GCI ($)</Label>
              <Input
                id="companyGCI"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                {...form.register("companyGCI", { valueAsNumber: true })}
              />
              {form.formState.errors.companyGCI && (
                <p className="text-sm text-red-500">{form.formState.errors.companyGCI.message}</p>
              )}
            </div>

            {/* Agent GCI */}
            <div className="space-y-2">
              <Label htmlFor="agentGCI">Agent GCI ($)</Label>
              <Input
                id="agentGCI"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                {...form.register("agentGCI", { valueAsNumber: true })}
              />
              {form.formState.errors.agentGCI && (
                <p className="text-sm text-red-500">{form.formState.errors.agentGCI.message}</p>
              )}
            </div>

            {/* Compliance Fee */}
            <div className="space-y-2">
              <Label htmlFor="complianceFee">Company Compliance Fee ($)</Label>
              <Input
                id="complianceFee"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                {...form.register("complianceFee", { valueAsNumber: true })}
              />
              {form.formState.errors.complianceFee && (
                <p className="text-sm text-red-500">{form.formState.errors.complianceFee.message}</p>
              )}
            </div>

            {/* Transaction Date */}
            <div className="space-y-2">
              <Label htmlFor="transactionDate">Transaction Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      setDate(newDate);
                      form.setValue("transactionDate", newDate || new Date());
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.transactionDate && (
                <p className="text-sm text-red-500">{form.formState.errors.transactionDate.message}</p>
              )}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={createTransactionMutation.isPending || updateTransactionMutation.isPending}
          >
            {isEditing 
              ? (updateTransactionMutation.isPending ? "Updating..." : "Update Transaction")
              : (createTransactionMutation.isPending ? "Creating..." : "Create Transaction")
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}