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
import { Separator } from "@/components/ui/separator";

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
  
  // New fields from the list
  source: z.string().optional(),
  companyName: z.string().optional(),
  escrowOffice: z.string().optional(),
  escrowOfficer: z.string().optional(),
  referrer: z.string().optional(),
  lender: z.string().optional(),
  sellerCommissionPercentage: z.number().min(0).default(0),
  buyerCommissionPercentage: z.number().min(0).default(0),
  complianceFee: z.number().min(0).default(0),
  referralPercentage: z.number().min(0).max(100).default(0),
  referralFee: z.number().min(0).default(0),
  showingAgent: z.string().optional(),
  showingAgentFee: z.number().min(0).default(0),
  teamAgentsIncome: z.number().min(0).default(0),
  personalIncome: z.number().min(0).default(0),
  actualCheckAmount: z.number().min(0).default(0),
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
  const [activeTab, setActiveTab] = useState("basic");

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
      
      // New fields
      source: transaction.source || '',
      companyName: transaction.companyName || '',
      escrowOffice: transaction.escrowOffice || '',
      escrowOfficer: transaction.escrowOfficer || '',
      referrer: transaction.referrer || '',
      lender: transaction.lender || '',
      sellerCommissionPercentage: transaction.sellerCommissionPercentage || 0,
      buyerCommissionPercentage: transaction.buyerCommissionPercentage || 0,
      complianceFee: transaction.complianceFee || 0,
      referralPercentage: transaction.referralPercentage || 0,
      referralFee: transaction.referralFee || 0,
      showingAgent: transaction.showingAgent || '',
      showingAgentFee: transaction.showingAgentFee || 0,
      teamAgentsIncome: transaction.teamAgentsIncome || 0,
      personalIncome: transaction.personalIncome || 0,
      actualCheckAmount: transaction.actualCheckAmount || 0,
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
  const sellerCommissionPercentage = form.watch("sellerCommissionPercentage") || 0;
  const buyerCommissionPercentage = form.watch("buyerCommissionPercentage") || 0;
  const complianceFee = form.watch("complianceFee") || 0;
  const referralPercentage = form.watch("referralPercentage") || 0;
  const referralFee = form.watch("referralFee") || 0;

  // Update UI state based on form values
  useEffect(() => {
    setUseManualCommission(manualCommissionEntry);
    setUseManualCompanyGCI(manualCompanyGCI);
  }, [manualCommissionEntry, manualCompanyGCI]);

  // Update calculated values when inputs change
  useEffect(() => {
    if (!manualCommissionEntry) {
      const totalCommissionPercentage = sellerCommissionPercentage + buyerCommissionPercentage || commissionPercentage;
      const newTotalCommission = (saleAmount * totalCommissionPercentage) / 100;
      setTotalCommission(newTotalCommission);
      form.setValue("totalCommissionAmount", newTotalCommission);
      form.setValue("manualCommissionAmount", newTotalCommission);
      form.setValue("commissionPercentage", totalCommissionPercentage);
    } else {
      setTotalCommission(manualCommissionAmount);
      form.setValue("totalCommissionAmount", manualCommissionAmount);
    }
    
    // Update referral fee based on percentage if not manually set
    if (referralPercentage > 0 && referralFee === 0) {
      const newReferralFee = (totalCommission * referralPercentage) / 100;
      form.setValue("referralFee", newReferralFee);
    }
  }, [saleAmount, commissionPercentage, form, manualCommissionEntry, manualCommissionAmount, 
      sellerCommissionPercentage, buyerCommissionPercentage, referralPercentage, referralFee, totalCommission]);

  // Calculate amount distribution
  const effectiveTotalCommission = useManualCommission ? manualCommissionAmount : totalCommission;
  const companyGCI = useManualCompanyGCI 
    ? manualCompanyGCIAmount 
    : (effectiveTotalCommission * companyPercentage) / 100;
  
  // Calculate total income after referral
  const totalIncomeAfterReferral = effectiveTotalCommission - referralFee - complianceFee;
  
  // Calculate primary agent share (after subtracting company GCI and additional agents)
  const totalAdditionalAgentPercentage = additionalAgents.reduce((sum, agent) => sum + agent.percentage, 0);
  const totalAdditionalAgentCosts = additionalAgents.reduce((sum, agent) => sum + agent.additionalCost, 0);
  const showingAgentFee = form.watch("showingAgentFee") || 0;
  const primaryAgentSharePercentage = 100 - companyPercentage - totalAdditionalAgentPercentage;
  const primaryAgentShare = (effectiveTotalCommission * primaryAgentSharePercentage / 100) - additionalAgentCost - totalAdditionalAgentCosts - showingAgentFee;

  // Add a new additional agent
  const handleAddAdditionalAgent = () => {
    append({ agentId: agents?.[0]?.id || 0, percentage: 0, additionalCost: 0 });
  };

  // Handle transaction update
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editTransactionSchema>) => {
      console.log("Running transaction update mutation with data:", data);
      
      // Prepare the data based on manual entries or calculations
      const finalCommissionAmount = data.manualCommissionEntry 
        ? data.manualCommissionAmount || 0
        : (data.saleAmount * data.commissionPercentage) / 100;
      
      const finalCompanyGCI = data.manualCompanyGCI 
        ? data.manualCompanyGCIAmount || 0
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
        
        // Additional fields
        source: data.source,
        companyName: data.companyName,
        escrowOffice: data.escrowOffice,
        escrowOfficer: data.escrowOfficer,
        referrer: data.referrer,
        lender: data.lender,
        sellerCommissionPercentage: data.sellerCommissionPercentage,
        buyerCommissionPercentage: data.buyerCommissionPercentage,
        complianceFee: data.complianceFee,
        referralPercentage: data.referralPercentage,
        referralFee: data.referralFee,
        showingAgent: data.showingAgent,
        showingAgentFee: data.showingAgentFee,
        teamAgentsIncome: data.teamAgentsIncome,
        personalIncome: data.personalIncome,
        actualCheckAmount: data.actualCheckAmount,
      };
      
      console.log("Sending API request with data:", updateData);
      
      try {
        const response = await apiRequest(
          'PUT', 
          `/api/transactions/${transaction.id}`, 
          updateData
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        return response.json();
      } catch (error) {
        console.error("Error updating transaction:", error);
        throw error;
      }
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
    console.log("Form submitted with data:", data);
    
    // Add debugging to check for form validation errors
    if (Object.keys(form.formState.errors).length > 0) {
      console.error("Form has validation errors:", form.formState.errors);
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }
    
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

  // Calculate transaction date parts (Month, Quarter, Year)
  const transactionDate = new Date(transaction.transactionDate);
  const month = transactionDate.toLocaleString('default', { month: 'long' });
  const quarter = `Q${Math.floor(transactionDate.getMonth() / 3) + 1}`;
  const year = transactionDate.getFullYear();

  return (
    <div className="bg-white rounded-lg w-full max-w-5xl mx-auto">
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="commission">Commission</TabsTrigger>
                <TabsTrigger value="additional">Additional Info</TabsTrigger>
                <TabsTrigger value="revenue-share">Revenue Share</TabsTrigger>
              </TabsList>
              
              {/* Basic Transaction Information */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    name="transactionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          {month} {year} ({quarter})
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                        <FormLabel>Total Commission Percentage (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value}
                            disabled={useManualCommission || (sellerCommissionPercentage > 0 || buyerCommissionPercentage > 0)}
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
                    name="sellerCommissionPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seller Commission Percentage (%)</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="buyerCommissionPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyer Commission Percentage (%)</FormLabel>
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button" 
                    onClick={() => setActiveTab("commission")}
                  >
                    Next: Commission Details
                  </Button>
                </div>
              </TabsContent>
              
              {/* Commission Settings */}
              <TabsContent value="commission" className="space-y-4">
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
                  
                  {/* Fees Section */}
                  <h4 className="text-md font-medium mt-6">Fees & Referrals</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="complianceFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compliance Fee ($)</FormLabel>
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
                      name="referralPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referral Percentage (%)</FormLabel>
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="referralFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referral Fee (${(totalCommission * referralPercentage / 100).toFixed(2)})</FormLabel>
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
                      name="showingAgentFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Showing Agent Fee ($)</FormLabel>
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
                    <Separator className="my-2" />
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>Compliance Fee:</div>
                      <div className="text-right">-${complianceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      
                      <div>Referral Fee ({referralPercentage}%):</div>
                      <div className="text-right">-${referralFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      
                      <div className="font-medium">Net Income After Fees:</div>
                      <div className="text-right font-medium">${totalIncomeAfterReferral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
                  
                  {/* Income Fields */}
                  <h4 className="text-md font-medium mt-6">Income Distribution</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="teamAgentsIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Agents Income ($)</FormLabel>
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
                      name="personalIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Income ($)</FormLabel>
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
                  
                  <FormField
                    control={form.control}
                    name="actualCheckAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Check Amount Received ($)</FormLabel>
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
                    variant="outline"
                    onClick={() => setActiveTab("basic")}
                  >
                    Back
                  </Button>
                  
                  <Button
                    type="button" 
                    onClick={() => setActiveTab("additional")}
                  >
                    Next: Additional Info
                  </Button>
                </div>
              </TabsContent>
              
              {/* Additional Info */}
              <TabsContent value="additional" className="space-y-4">
                <div className="border rounded-md p-4 space-y-4">
                  <h3 className="text-lg font-medium">Additional Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="escrowOffice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escrow Office</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="escrowOfficer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escrow Officer</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="referrer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referrer</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lender</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="showingAgent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Showing Agent</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("commission")}
                  >
                    Back
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
                    >
                      {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={updateTransactionMutation.isPending}
                    >
                      {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Revenue Share Breakdown */}
              <TabsContent value="revenue-share" className="py-4">
                <RevenueShareBreakdown transaction={transaction} />
                
                <div className="flex justify-between mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("additional")}
                  >
                    Back
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={updateTransactionMutation.isPending || deleteTransactionMutation.isPending}
                    >
                      {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={updateTransactionMutation.isPending}
                    >
                      {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default EditTransactionForm;