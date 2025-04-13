import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Agent, AgentType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { calculateCommission, calculateCompanyGCI, calculateAgentShare, calculateRevenueSharePool } from "@/utils/calculators";

const formSchema = z.object({
  agentId: z.number({ required_error: "Agent is required" }),
  propertyAddress: z.string().min(5, { message: "Property address is required" }),
  saleAmount: z.number().positive({ message: "Sale amount must be positive" }),
  commissionPercentage: z.number().positive({ message: "Commission percentage must be positive" }),
  manualCommission: z.boolean().default(false),
  totalCommission: z.number().optional(),
  companyGCI: z.number().optional(),
  transactionDate: z.string(),
});

interface AddTransactionFormProps {
  onTransactionAdded?: () => void;
}

const AddTransactionForm = ({ onTransactionAdded }: AddTransactionFormProps) => {
  const { toast } = useToast();
  const [totalCommission, setTotalCommission] = useState(0);
  const [manualCommission, setManualCommission] = useState(false);
  const [agentShare, setAgentShare] = useState(0);
  const [companyGci, setCompanyGci] = useState(0);
  const [revenueSharePool, setRevenueSharePool] = useState(0);
  const [revenueShareBreakdown, setRevenueShareBreakdown] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("details");

  // Load agents for selection
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Load downline structure for revenue share calculations
  const { data: agentsWithDownline } = useQuery<any[]>({
    queryKey: ['/api/agents/downline'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyAddress: "",
      saleAmount: 0,
      commissionPercentage: 3.0,
      manualCommission: false,
      totalCommission: 0,
      companyGCI: 0,
      transactionDate: new Date().toISOString().split('T')[0],
    },
  });

  // Watch for changes to calculate commission
  const saleAmount = form.watch("saleAmount");
  const commissionPercentage = form.watch("commissionPercentage");
  const selectedAgentId = form.watch("agentId");
  const isManualCommission = form.watch("manualCommission");
  const manualTotalCommission = form.watch("totalCommission");
  const manualCompanyGCI = form.watch("companyGCI");

  // Function to get sponsorship chain for an agent
  const getSponsorshipChain = (agentId: number, agents: Agent[]): Agent[] => {
    const chain: Agent[] = [];
    if (!agents) return chain;
    
    let currentId = agentId;
    while (currentId) {
      const agent = agents.find(a => a.id === currentId);
      if (!agent) break;
      
      chain.push(agent);
      if (!agent.sponsorId) break;
      currentId = agent.sponsorId;
    }
    
    return chain;
  };

  // Calculate revenue share breakdown for visualization
  const calculateRevenueShareBreakdown = (
    sourceAgentId: number, 
    companyGCI: number,
    agents: Agent[] | undefined
  ) => {
    if (!agents || !sourceAgentId || !companyGCI) return [];
    
    const sourceAgent = agents.find(a => a.id === sourceAgentId);
    if (!sourceAgent) return [];
    
    // Get the sponsorship chain (upline)
    const sponsorChain = getSponsorshipChain(sourceAgentId, agents);
    
    // If there's no sponsor (root agent), return empty breakdown
    if (sponsorChain.length <= 1) return [];
    
    // Remove the source agent from the chain
    sponsorChain.shift();
    
    // Calculate share for each tier
    const maxTiers = 5;
    const tierRates: Record<string, number> = {
      'principal': 0.125, // 12.5% for principal agents
      'support': 0.02     // 2% for support agents
    };
    
    const breakdown = sponsorChain.slice(0, maxTiers).map((agent, index) => {
      const tierLevel = index + 1;
      const tierRate = tierRates[agent.agentType] || 0;
      const amount = companyGCI * tierRate;
      
      return {
        tier: tierLevel,
        agent,
        rate: tierRate,
        amount: amount
      };
    });
    
    return breakdown;
  };

  useEffect(() => {
    if (isManualCommission) {
      // If manual commission mode is on, use the user-specified values
      if (manualTotalCommission && manualCompanyGCI) {
        const agentShareValue = manualTotalCommission - manualCompanyGCI;
        const revenueShare = calculateRevenueSharePool(manualCompanyGCI, selectedAgentId, agents);
        
        setTotalCommission(manualTotalCommission);
        setCompanyGci(manualCompanyGCI);
        setAgentShare(agentShareValue);
        setRevenueSharePool(revenueShare);
        
        // Calculate breakdown
        const breakdown = calculateRevenueShareBreakdown(selectedAgentId, manualCompanyGCI, agents);
        setRevenueShareBreakdown(breakdown);
      }
    } else {
      // Standard calculation
      if (saleAmount && commissionPercentage) {
        const commission = calculateCommission(saleAmount, commissionPercentage);
        const companyGCI = calculateCompanyGCI(commission);
        const agentShareValue = calculateAgentShare(commission, companyGCI);
        const revenueShare = calculateRevenueSharePool(companyGCI, selectedAgentId, agents);
        
        setTotalCommission(commission);
        setCompanyGci(companyGCI);
        setAgentShare(agentShareValue);
        setRevenueSharePool(revenueShare);
        
        // Set form values for manual mode
        form.setValue("totalCommission", commission);
        form.setValue("companyGCI", companyGCI);
        
        // Calculate breakdown
        const breakdown = calculateRevenueShareBreakdown(selectedAgentId, companyGCI, agents);
        setRevenueShareBreakdown(breakdown);
      }
    }
  }, [saleAmount, commissionPercentage, selectedAgentId, agents, isManualCommission, manualTotalCommission, manualCompanyGCI, form]);

  const createTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convert string date to ISO format and exclude fields not needed in database
      const { manualCommission, totalCommission, ...rest } = data;
      
      const formattedData = {
        ...rest,
        transactionDate: new Date(data.transactionDate).toISOString(),
        companyGCI: isManualCommission ? manualCompanyGCI : companyGci
      };
      
      const response = await apiRequest('POST', '/api/transactions', formattedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/revenue-shares'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      toast({
        title: "Transaction Added",
        description: "The transaction has been successfully recorded with revenue shares.",
      });
      form.reset({
        propertyAddress: "",
        saleAmount: 0,
        commissionPercentage: 3.0,
        manualCommission: false,
        totalCommission: 0,
        companyGCI: 0,
        transactionDate: new Date().toISOString().split('T')[0],
      });
      setManualCommission(false);
      setActiveTab("details");
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

  // Function to get avatar color
  const getAvatarColor = (name: string): string => {
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

  // Function to get initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">New Transaction</h2>
      </div>
      
      <div className="p-4">
        <Tabs 
          defaultValue="details" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="details">Transaction Details</TabsTrigger>
            <TabsTrigger value="revenue-share">Revenue Share</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
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
                            disabled={isManualCommission}
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
                            disabled={isManualCommission}
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
                  
                  <FormField
                    control={form.control}
                    name="manualCommission"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-3 rounded-lg border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium text-gray-900">
                            Manual Commission
                          </FormLabel>
                          <p className="text-xs text-gray-500">
                            Override automatic calculations
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              setManualCommission(checked);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                {isManualCommission && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                    <FormField
                      control={form.control}
                      name="totalCommission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Commission ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              step="0.01"
                              min="0"
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              value={field.value || 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyGCI"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company GCI ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              step="0.01"
                              min="0"
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              value={field.value || 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
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
                    <div className="text-green-600 font-medium">
                      ${revenueSharePool.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                  </div>
                  
                  {revenueShareBreakdown.length > 0 && (
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        className="text-sm text-primary-600 hover:text-primary-700"
                        onClick={() => setActiveTab("revenue-share")}
                      >
                        View Revenue Share Breakdown →
                      </button>
                    </div>
                  )}
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
          </TabsContent>
          
          <TabsContent value="revenue-share">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Revenue Share Breakdown</h3>
              
              {selectedAgentId && revenueShareBreakdown.length > 0 ? (
                <div>
                  <div className="mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-gray-600">Company GCI:</div>
                      <div className="text-gray-900 font-medium">
                        ${companyGci.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <div className="text-gray-600">Total Revenue Share:</div>
                      <div className="text-green-600 font-medium">
                        ${revenueSharePool.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {revenueShareBreakdown.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full ${getAvatarColor(item.agent.name)} flex items-center justify-center text-white font-medium`}>
                            {getInitials(item.agent.name)}
                          </div>
                          <div className="ml-3">
                            <div className="font-medium">{item.agent.name}</div>
                            <div className="flex items-center text-xs">
                              <Badge variant={item.agent.agentType === AgentType.PRINCIPAL ? 'principal' : 'support'} className="mr-2">
                                {item.agent.agentType === AgentType.PRINCIPAL ? 'Principal' : 'Support'}
                              </Badge>
                              <span className="text-gray-500">Tier {item.tier}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-600 font-medium">${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          <div className="text-xs text-gray-500">{(item.rate * 100).toFixed(1)}% of GCI</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  {!selectedAgentId ? (
                    <p>Select an agent first to see revenue share breakdown</p>
                  ) : (
                    <p>No revenue share distribution for this transaction</p>
                  )}
                </div>
              )}
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-primary-600 hover:text-primary-700"
                  onClick={() => setActiveTab("details")}
                >
                  ← Back to Transaction Details
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AddTransactionForm;
