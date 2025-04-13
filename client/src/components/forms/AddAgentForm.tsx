import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AgentType, CapType, Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  agentType: z.enum([AgentType.PRINCIPAL, AgentType.SUPPORT]),
  sponsorId: z.number().optional(),
  capType: z.enum([CapType.STANDARD, CapType.TEAM]).optional(),
  anniversaryDate: z.string(),
});

interface AddAgentFormProps {
  onAgentAdded?: () => void;
  preselectedSponsorId?: number;
}

const AddAgentForm = ({ onAgentAdded, preselectedSponsorId }: AddAgentFormProps) => {
  const { toast } = useToast();
  const [showCapOptions, setShowCapOptions] = useState(true);

  // Load agents for sponsor selection
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      agentType: AgentType.PRINCIPAL,
      sponsorId: preselectedSponsorId,
      capType: CapType.STANDARD,
      anniversaryDate: new Date().toISOString().split('T')[0],
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convert string date to ISO format
      const formattedData = {
        ...data,
        anniversaryDate: new Date(data.anniversaryDate).toISOString(),
      };
      
      // If support agent, remove capType
      if (data.agentType === AgentType.SUPPORT) {
        delete formattedData.capType;
      }
      
      const response = await apiRequest('POST', '/api/agents', formattedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
      toast({
        title: "Agent Added",
        description: "The agent has been successfully added to the system.",
      });
      form.reset({
        name: "",
        agentType: AgentType.PRINCIPAL,
        sponsorId: preselectedSponsorId,
        capType: CapType.STANDARD,
        anniversaryDate: new Date().toISOString().split('T')[0],
      });
      if (onAgentAdded) onAgentAdded();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add agent: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createAgentMutation.mutate(data);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">Add New Agent</h2>
      </div>
      
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sponsorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsor/Recruiter</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
                    defaultValue={field.value?.toString() || "0"}
                    disabled={isLoadingAgents}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sponsor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">No sponsor (Root agent)</SelectItem>
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
              name="agentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        setShowCapOptions(value === AgentType.PRINCIPAL);
                      }}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value={AgentType.PRINCIPAL} />
                        </FormControl>
                        <FormLabel className="font-normal">Principal Agent</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value={AgentType.SUPPORT} />
                        </FormControl>
                        <FormLabel className="font-normal">Support Agent</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {showCapOptions && (
              <div className="border-t pt-4 border-gray-200">
                <FormField
                  control={form.control}
                  name="capType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cap Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value={CapType.STANDARD} />
                            </FormControl>
                            <FormLabel className="font-normal">Standard ($16,000)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value={CapType.TEAM} />
                            </FormControl>
                            <FormLabel className="font-normal">Team Agent ($8,000)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <FormField
              control={form.control}
              name="anniversaryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anniversary Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={createAgentMutation.isPending}
            >
              {createAgentMutation.isPending ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                "Add Agent"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddAgentForm;
