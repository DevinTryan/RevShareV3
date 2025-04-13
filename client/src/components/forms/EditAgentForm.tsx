import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Agent, AgentType, CapType } from "@shared/schema";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const editAgentSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  agentType: z.enum(["principal", "support"]),
  sponsorId: z.number().nullable(),
  capType: z.enum(["standard", "team"]).nullable(),
  anniversaryDate: z.string(),
});

interface EditAgentFormProps {
  agent: Agent;
  onClose: () => void;
}

const EditAgentForm = ({ agent, onClose }: EditAgentFormProps) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all agents for sponsor selection
  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  const form = useForm<z.infer<typeof editAgentSchema>>({
    resolver: zodResolver(editAgentSchema),
    defaultValues: {
      name: agent.name,
      agentType: agent.agentType as AgentType,
      sponsorId: agent.sponsorId,
      capType: agent.capType as CapType,
      anniversaryDate: new Date(agent.anniversaryDate).toISOString().split('T')[0],
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editAgentSchema>) => {
      const formattedData = {
        ...data,
        anniversaryDate: new Date(data.anniversaryDate).toISOString(),
      };
      
      console.log('Sending agent update:', formattedData);
      const response = await apiRequest('PUT', `/api/agents/${agent.id}`, formattedData);
      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || 'Failed to update agent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
      toast({
        title: "Agent Updated",
        description: "The agent has been successfully updated.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update agent: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async () => {
      setIsDeleting(true);
      console.log('Deleting agent with ID:', agent.id);
      const response = await apiRequest('DELETE', `/api/agents/${agent.id}`);
      if (!response.ok) {
        const errorResponse = await response.json().catch(() => ({}));
        throw new Error(errorResponse.message || 'Failed to delete agent');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents/downline'] });
      toast({
        title: "Agent Deleted",
        description: "The agent has been successfully deleted.",
      });
      onClose();
    },
    onError: (error) => {
      setIsDeleting(false);
      toast({
        title: "Error",
        description: `Failed to delete agent: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editAgentSchema>) => {
    updateAgentMutation.mutate(data);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this agent? This will affect all associated transactions and revenue shares.")) {
      deleteAgentMutation.mutate();
    }
  };

  // Filter out the current agent from sponsor options to prevent self-sponsorship
  const sponsorOptions = agents?.filter(a => a.id !== agent.id) || [];

  return (
    <div className="p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter agent name" />
                </FormControl>
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
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="principal" id="principal" />
                      <label htmlFor="principal" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Principal</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="support" id="support" />
                      <label htmlFor="support" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Support</label>
                    </div>
                  </RadioGroup>
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
                <FormLabel>Sponsor</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
                  defaultValue={field.value?.toString() || "null"}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sponsor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="null">No Sponsor</SelectItem>
                    {sponsorOptions.map((agent) => (
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
            name="capType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cap Type</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "null" ? null : value as CapType)}
                  defaultValue={field.value || "null"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cap type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="null">No Cap</SelectItem>
                    <SelectItem value="standard">Standard ($16,000)</SelectItem>
                    <SelectItem value="team">Team ($8,000)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <div className="flex flex-col-reverse md:flex-row justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={updateAgentMutation.isPending || deleteAgentMutation.isPending}
            >
              {isDeleting ? "Deleting..." : "Delete Agent"}
            </Button>
            
            <div className="flex space-x-2 mb-3 md:mb-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateAgentMutation.isPending || deleteAgentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateAgentMutation.isPending || deleteAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default EditAgentForm;