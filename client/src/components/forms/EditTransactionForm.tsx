import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Agent, Transaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import RevenueShareBreakdown from "@/components/transactions/RevenueShareBreakdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Schema for additional agents on the transaction
const additionalAgentSchema = z.object({
  agentId: z.number({ required_error: "Agent is required" }),
  percentage: z.number().min(0).max(100, { message: "Percentage must be between 0 and 100" }),
  additionalCost: z.number().min(0, { message: "Additional cost must be positive or zero" }),
});

// Updated transaction schema with more options
const editTransactionSchema = z.object({
  primaryAgentId: z.number({ required_error: "Primary agent is required" }),
  propertyAddress: z.string().min(5, { message: "Property address is required" }),
  saleAmount: z.number().positive({ message: "Sale amount must be positive" }),
  commissionPercentage: z.number().positive({ message: "Commission percentage must be positive" }),
  totalCommissionAmount: z.number().positive({ message: "Total commission must be positive" }),
  manualCommissionEntry: z.boolean().default(false),
  manualCommissionAmount: z.number().min(0).optional(),
  companyPercentage: z.number().min(0).max(100, { message: "Company percentage must be between 0 and 100" }),
  manualCompanyGCI: z.boolean().default(false),
  manualCompanyGCIAmount: z.number().min(0).optional(),
  additionalAgentCost: z.number().min(0).default(0),
  transactionDate: z.string(),
  additionalAgents: z.array(additionalAgentSchema).default([]),
});

interface EditTransactionFormProps {
  transaction: Transaction;
  onClose: () => void;
}

const EditTransactionForm = ({ transaction, onClose }: EditTransactionFormProps) => {
  const { toast } = useToast();
  const [totalCommission, setTotalCommission] = useState(0);
  const [useManualCommission, setUseManualCommission] = useState(false);
  const [useManualCompanyGCI, setUseManualCompanyGCI] = useState(false);

  // Load agents for selection
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Calculate initial values
  useEffect(() => {
    const calculatedCommission = (transaction.saleAmount * transaction.commissionPercentage) / 100;
    setTotalCommission(calculatedCommission);
  }, [transaction]);

  // Calculate company percentage from total commission and company GCI
  const initialCompanyPercentage = ((transaction.companyGCI || 0) / totalCommission) * 100;

  // Set up form with extended fields
  const form = useForm<z.infer<typeof editTransactionSchema>>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      primaryAgentId: transaction.agentId,
      propertyAddress: transaction.propertyAddress,
      saleAmount: transaction.saleAmount,
      commissionPercentage: transaction.commissionPercentage,
      totalCommissionAmount: totalCommission,
      manualCommissionEntry: false,
      manualCommissionAmount: totalCommission,
      companyPercentage: Math.round(initialCompanyPercentage) || 0,
      manualCompanyGCI: false,
      manualCompanyGCIAmount: transaction.companyGCI,
      additionalAgentCost: transaction.additionalAgentCost || 0,
      transactionDate: new Date(transaction.transactionDate).toISOString().split('T')[0],
      additionalAgents: transaction.additionalAgents?.map(agent => ({
        agentId: agent.agentId,
        percentage: agent.percentage || 0,
        additionalCost: agent.additionalCost || 0
      })) || [],
    },
  });

  // Set up field array for additional agents
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additionalAgents",
  });

  // Watch for changes in form values to update calculations
  const saleAmount = form.watch("saleAmount");
  const commissionPercentage = form.watch("commissionPercentage");
  const companyPercentage = form.watch("companyPercentage");
  const manualCommissionEntry = form.watch("manualCommissionEntry");
  const manualCommissionAmount = form.watch("manualCommissionAmount") || 0;
  const manualCompanyGCI = form.watch("manualCompanyGCI");
  const manualCompanyGCIAmount = form.watch("manualCompanyGCIAmount") || 0;
  const additionalAgentCost = form.watch("additionalAgentCost") || 0;
  const additionalAgents = form.watch("additionalAgents") || [];

  // Update UI state based on form values
  useEffect(() => {
    setUseManualCommission(manualCommissionEntry);
    setUseManualCompanyGCI(manualCompanyGCI);
  }, [manualCommissionEntry, manualCompanyGCI]);

  // Update calculated values when inputs change
  useEffect(() => {
    if (!manualCommissionEntry) {
      const newTotalCommission = (saleAmount * commissionPercentage) / 100;
      setTotalCommission(newTotalCommission);
      form.setValue("totalCommissionAmount", newTotalCommission);
      form.setValue("manualCommissionAmount", newTotalCommission);
    } else {
      setTotalCommission(manualCommissionAmount);
      form.setValue("totalCommissionAmount", manualCommissionAmount);
    }
  }, [saleAmount, commissionPercentage, form, manualCommissionEntry, manualCommissionAmount]);

  // Calculate amount distribution
  const effectiveTotalCommission = useManualCommission ? manualCommissionAmount : totalCommission;
  const companyGCI = useManualCompanyGCI 
    ? manualCompanyGCIAmount 
    : (effectiveTotalCommission * companyPercentage) / 100;
  
  // Calculate primary agent share (after subtracting company GCI and additional agents)
  const totalAdditionalAgentPercentage = additionalAgents.reduce((sum, agent) => sum + agent.percentage, 0);
  const totalAdditionalAgentCosts = additionalAgents.reduce((sum, agent) => sum + agent.additionalCost, 0);
  const primaryAgentSharePercentage = 100 - companyPercentage - totalAdditionalAgentPercentage;
  const primaryAgentShare = (effectiveTotalCommission * primaryAgentSharePercentage / 100) - additionalAgentCost - totalAdditionalAgentCosts;

  // Add a new additional agent
  const handleAddAdditionalAgent = () => {
    append({ agentId: agents?.[0]?.id || 0, percentage: 0, additionalCost: 0 });
  };

  // Handle transaction update
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editTransactionSchema>) => {
      // Prepare the data based on manual entries or calculations
      const finalCommissionAmount = data.manualCommissionEntry 
        ? data.manualCommissionAmount 
        : (data.saleAmount * data.commissionPercentage) / 100;
      
      const finalCompanyGCI = data.manualCompanyGCI 
        ? data.manualCompanyGCIAmount 
        : (finalCommissionAmount * data.companyPercentage) / 100;
      
      // Format the data for API
      const updateData = {
        agentId: data.primaryAgentId,
        propertyAddress: data.propertyAddress,
        saleAmount: data.saleAmount,
        commissionPercentage: data.commissionPercentage,
        companyGCI: finalCompanyGCI,
        additionalAgentCost: data.additionalAgentCost,
        transactionDate: new Date(data.transactionDate).toISOString(),
        manualCommissionAmount: data.manualCommissionEntry ? data.manualCommissionAmount : null,
        additionalAgents: data.additionalAgents.map(agent => ({
          agentId: agent.agentId,
          percentage: agent.percentage,
          additionalCost: agent.additionalCost
        })),
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

  // Handle transaction deletion
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

  // Find agent by ID
  const getAgentName = (agentId: number) => {
    return agents?.find(a => a.id === agentId)?.name || "Unknown";
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="p-4">
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="edit">Basic Info</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="revenue-share">Revenue Share</TabsTrigger>
          </TabsList>
          
          {/* Basic Transaction Information */}
          <TabsContent value="edit">
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryAgentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Agent</FormLabel>
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
                            disabled={useManualCommission}
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={updateTransactionMutation.isPending}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={updateTransactionMutation.isPending}
                  >
                    {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          {/* Commission Settings */}
          <TabsContent value="commission">
            <Form {...form}>
              <form className="space-y-4">
                <div className="border rounded-md p-4 space-y-4">
                  <h3 className="text-lg font-medium">Commission Settings</h3>
                  
                  {/* Manual Commission Toggle */}
                  <FormField
                    control={form.control}
                    name="manualCommissionEntry"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Manual Commission Entry</FormLabel>
                          <FormDescription>
                            Override calculated commission with a manual amount
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Manual Commission Amount */}
                  {useManualCommission && (
                    <FormField
                      control={form.control}
                      name="manualCommissionAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Commission Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              value={field.value || 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Commission Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 my-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Total Commission:</span>
                      <span className="font-semibold">${effectiveTotalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {useManualCommission 
                        ? "Manually entered amount" 
                        : `${commissionPercentage}% of $${saleAmount.toLocaleString()}`}
                    </div>
                  </div>
                  
                  {/* Manual Company GCI Toggle */}
                  <FormField
                    control={form.control}
                    name="manualCompanyGCI"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Manual Company GCI</FormLabel>
                          <FormDescription>
                            Override calculated company GCI with a manual amount
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Company Split Settings */}
                  {!useManualCompanyGCI ? (
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
                  ) : (
                    <FormField
                      control={form.control}
                      name="manualCompanyGCIAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Company GCI Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              value={field.value || 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Commission Distribution Visual */}
                  <div className="bg-gray-50 rounded-lg p-4 my-4">
                    <h4 className="text-sm font-medium mb-3">Commission Distribution</h4>
                    
                    <div className="flex mb-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-primary-600 h-2.5 rounded-full" 
                          style={{ width: `${useManualCompanyGCI ? (companyGCI / effectiveTotalCommission * 100) : companyPercentage}%` }}>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 mt-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">Company GCI:</span>
                        <span>${companyGCI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">Primary Agent Share:</span>
                        <span>${primaryAgentShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {additionalAgents.map((agent, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="font-medium">{getAgentName(agent.agentId)} ({agent.percentage}%):</span>
                          <span>${((effectiveTotalCommission * agent.percentage / 100) - agent.additionalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Additional Agent Cost for Primary Agent */}
                <div className="border rounded-md p-4 space-y-4">
                  <h3 className="text-lg font-medium">Additional Costs</h3>
                  <FormField
                    control={form.control}
                    name="additionalAgentCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Cost for Primary Agent ($)</FormLabel>
                        <FormDescription>
                          This amount will be deducted from the agent's commission
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Additional Agents Section */}
                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Additional Agents</h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleAddAdditionalAgent}
                      disabled={isLoadingAgents}
                    >
                      <i className="ri-user-add-line mr-2"></i> Add Agent
                    </Button>
                  </div>
                  
                  {fields.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      No additional agents. Add agents to split the commission.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <Card key={field.id} className="relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-8 w-8 p-0"
                            onClick={() => remove(index)}
                          >
                            <i className="ri-close-line"></i>
                          </Button>
                          
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name={`additionalAgents.${index}.agentId`}
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
                                            {agent.name}
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
                                name={`additionalAgents.${index}.percentage`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Percentage (%)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
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
                                name={`additionalAgents.${index}.additionalCost`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Additional Cost ($)</FormLabel>
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
                            </div>
                            
                            <div className="mt-2 text-xs text-gray-500">
                              {`${getAgentName(form.getValues(`additionalAgents.${index}.agentId`))} will receive ${((effectiveTotalCommission * form.getValues(`additionalAgents.${index}.percentage`) / 100) - form.getValues(`additionalAgents.${index}.additionalCost`)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
                  >
                    {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={updateTransactionMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={updateTransactionMutation.isPending}
                    >
                      {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          {/* Revenue Share Breakdown */}
          <TabsContent value="revenue-share" className="py-4">
            <RevenueShareBreakdown transaction={transaction} />
            
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EditTransactionForm;