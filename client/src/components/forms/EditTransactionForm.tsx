import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Agent, Transaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const editTransactionSchema = z.object({
  agentId: z.number({ required_error: "Agent is required" }),
  propertyAddress: z.string().min(5, { message: "Property address is required" }),
  saleAmount: z.number().positive({ message: "Sale amount must be positive" }),
  commissionPercentage: z.number().positive({ message: "Commission percentage must be positive" }),
  totalCommissionAmount: z.number().positive({ message: "Total commission must be positive" }),
  companyPercentage: z.number().min(0).max(100, { message: "Company percentage must be between 0 and 100" }),
  transactionDate: z.string(),
});

interface EditTransactionFormProps {
  transaction: Transaction;
  onClose: () => void;
}

const EditTransactionForm = ({ transaction, onClose }: EditTransactionFormProps) => {
  const { toast } = useToast();
  const [totalCommission, setTotalCommission] = useState(0);

  // Load agents for selection
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Calculate total commission from sale amount and commission percentage
  useEffect(() => {
    const calculatedCommission = (transaction.saleAmount * transaction.commissionPercentage) / 100;
    setTotalCommission(calculatedCommission);
  }, [transaction]);

  // Calculate company percentage from total commission and company GCI
  const initialCompanyPercentage = (transaction.companyGCI / totalCommission) * 100;

  const form = useForm<z.infer<typeof editTransactionSchema>>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      agentId: transaction.agentId,
      propertyAddress: transaction.propertyAddress,
      saleAmount: transaction.saleAmount,
      commissionPercentage: transaction.commissionPercentage,
      totalCommissionAmount: totalCommission,
      companyPercentage: Math.round(initialCompanyPercentage),
      transactionDate: new Date(transaction.transactionDate).toISOString().split('T')[0],
    },
  });

  // Watch for changes in form values to update calculations
  const saleAmount = form.watch("saleAmount");
  const commissionPercentage = form.watch("commissionPercentage");
  const companyPercentage = form.watch("companyPercentage");

  // Update calculated values when inputs change
  useEffect(() => {
    const newTotalCommission = (saleAmount * commissionPercentage) / 100;
    setTotalCommission(newTotalCommission);
    form.setValue("totalCommissionAmount", newTotalCommission);
  }, [saleAmount, commissionPercentage, form]);

  // Calculate company GCI based on percentage
  const companyGCI = (totalCommission * companyPercentage) / 100;
  // Calculate agent share
  const agentShare = totalCommission - companyGCI;

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editTransactionSchema>) => {
      // Calculate company GCI based on total commission and company percentage
      const companyGCI = (data.totalCommissionAmount * data.companyPercentage) / 100;
      
      // Format the data for API
      const updateData = {
        agentId: data.agentId,
        propertyAddress: data.propertyAddress,
        saleAmount: data.saleAmount,
        commissionPercentage: data.commissionPercentage,
        companyGCI: companyGCI,
        transactionDate: new Date(data.transactionDate).toISOString(),
      };
      
      const response = await apiRequest(
        'PUT', 
        `/api/transactions/${transaction.id}`, 
        updateData
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/revenue-shares'] });
      toast({
        title: "Transaction Updated",
        description: "The transaction has been successfully updated.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update transaction: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'DELETE', 
        `/api/transactions/${transaction.id}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/revenue-shares'] });
      toast({
        title: "Transaction Deleted",
        description: "The transaction has been successfully deleted.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete transaction: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editTransactionSchema>) => {
    updateTransactionMutation.mutate(data);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this transaction? This will also delete all associated revenue shares.")) {
      deleteTransactionMutation.mutate();
    }
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="agentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value.toString()}
                    disabled={isLoadingAgents}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {agents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name} ({agent.agentType === 'principal' ? 'Principal' : 'Support'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="propertyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="saleAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commissionPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Percentage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Commission Split</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Commission:</span>
                  <span className="font-semibold">${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                <div className="flex mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${companyPercentage}%` }}></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Company: {companyPercentage}% (${companyGCI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  <span>Agent: {(100 - companyPercentage)}% (${agentShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="companyPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Percentage: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col-reverse md:flex-row justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
              >
                {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
              </Button>
              
              <div className="flex space-x-2 mb-3 md:mb-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
                >
                  {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default EditTransactionForm;