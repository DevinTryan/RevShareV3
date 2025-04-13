import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateCommission, calculateCompanyGCI, calculateAgentShare, calculateRevenueSharePool } from "@/utils/calculators";

const formSchema = z.object({
  agentId: z.number({ required_error: "Agent is required" }),
  propertyAddress: z.string().min(5, { message: "Property address is required" }),
  saleAmount: z.number().positive({ message: "Sale amount must be positive" }),
  commissionPercentage: z.number().positive({ message: "Commission percentage must be positive" }),
  transactionDate: z.string(),
});

interface AddTransactionFormProps {
  onTransactionAdded?: () => void;
}

const AddTransactionForm = ({ onTransactionAdded }: AddTransactionFormProps) => {
  const { toast } = useToast();
  const [totalCommission, setTotalCommission] = useState(0);
  const [agentShare, setAgentShare] = useState(0);
  const [companyGci, setCompanyGci] = useState(0);
  const [revenueSharePool, setRevenueSharePool] = useState(0);

  // Load agents for selection
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyAddress: "",
      saleAmount: 0,
      commissionPercentage: 3.0,
      transactionDate: new Date().toISOString().split('T')[0],
    },
  });

  // Watch for changes to calculate commission
  const saleAmount = form.watch("saleAmount");
  const commissionPercentage = form.watch("commissionPercentage");
  const selectedAgentId = form.watch("agentId");

  useEffect(() => {
    if (saleAmount && commissionPercentage) {
      const commission = calculateCommission(saleAmount, commissionPercentage);
      const companyGCI = calculateCompanyGCI(commission);
      const agentShareValue = calculateAgentShare(commission, companyGCI);
      const revenueShare = calculateRevenueSharePool(companyGCI, selectedAgentId, agents);
      
      setTotalCommission(commission);
      setCompanyGci(companyGCI);
      setAgentShare(agentShareValue);
      setRevenueSharePool(revenueShare);
    }
  }, [saleAmount, commissionPercentage, selectedAgentId, agents]);

  const createTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convert string date to ISO format
      const formattedData = {
        ...data,
        transactionDate: new Date(data.transactionDate).toISOString(),
      };
      
      const response = await apiRequest('POST', '/api/transactions', formattedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({
        title: "Transaction Added",
        description: "The transaction has been successfully recorded.",
      });
      form.reset({
        propertyAddress: "",
        saleAmount: 0,
        commissionPercentage: 3.0,
        transactionDate: new Date().toISOString().split('T')[0],
      });
      if (onTransactionAdded) onTransactionAdded();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add transaction: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTransactionMutation.mutate(data);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">New Transaction</h2>
      </div>
      
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="agentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Agent</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
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
                    <Input placeholder="Enter property address" {...field} />
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
                        placeholder="0.00" 
                        step="0.01"
                        min="0"
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
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
                    <FormLabel>Commission (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="3.0" 
                        step="0.1"
                        min="0"
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              
              <FormItem>
                <FormLabel>Company Share (%)</FormLabel>
                <Input 
                  type="number" 
                  value="15.0" 
                  disabled 
                />
              </FormItem>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h3 className="font-medium text-sm text-gray-700 mb-2">Transaction Summary</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-gray-600">Total Commission:</div>
                <div className="text-gray-900 font-medium">
                  ${totalCommission.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                
                <div className="text-gray-600">Agent's Share:</div>
                <div className="text-gray-900 font-medium">
                  ${agentShare.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                
                <div className="text-gray-600">Company's GCI:</div>
                <div className="text-gray-900 font-medium">
                  ${companyGci.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                
                <div className="text-gray-600">Revenue Share Pool:</div>
                <div className="text-gray-900 font-medium">
                  ${revenueSharePool.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-green-500 hover:bg-green-600"
              disabled={createTransactionMutation.isPending}
            >
              {createTransactionMutation.isPending ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                "Add Transaction"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddTransactionForm;
