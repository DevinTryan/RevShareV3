import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Transaction, Agent, RevenueShare } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";

interface RevenueShareBreakdownProps {
  transaction: Transaction;
}

interface ExtendedRevenueShare extends RevenueShare {
  recipient?: Agent;
  source?: Agent;
  percentage?: number;
}

const RevenueShareBreakdown = ({ transaction }: RevenueShareBreakdownProps) => {
  const [revenueShares, setRevenueShares] = useState<ExtendedRevenueShare[]>([]);

  // Fetch all revenue shares for this transaction
  const { data: transactionShares, isLoading: isLoadingShares } = useQuery<RevenueShare[]>({
    queryKey: [`/api/transactions/${transaction.id}/revenue-shares`],
  });

  // Fetch all agents to get their names
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  // Process the revenue shares once we have the data
  useEffect(() => {
    if (transactionShares && agents) {
      // Calculate the total revenue share amount
      const totalRevenueShare = transactionShares.reduce((sum, share) => sum + share.amount, 0);
      
      // Create extended revenue shares with agent information and percentages
      const extendedShares = transactionShares.map(share => {
        const recipient = agents.find(a => a.id === share.recipientAgentId);
        const source = agents.find(a => a.id === share.sourceAgentId);
        const percentage = (share.amount / transaction.companyGCI) * 100;
        
        return {
          ...share,
          recipient,
          source,
          percentage
        };
      });
      
      // Sort by tier for a logical display order
      setRevenueShares(extendedShares.sort((a, b) => a.tier - b.tier));
    }
  }, [transactionShares, agents, transaction]);

  if (isLoadingShares || isLoadingAgents) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If no revenue shares exist
  if (!revenueShares.length) {
    return (
      <div className="p-4 text-center text-gray-500">
        No revenue share information available for this transaction.
      </div>
    );
  }

  // Function to get initials from agent name
  const getInitials = (name?: string): string => {
    if (!name) return "N/A";
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };

  // Function to get avatar color based on agent name
  const getAvatarColor = (name?: string): string => {
    if (!name) return "bg-gray-400";
    
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Revenue Share Breakdown</h3>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Total Commission:</span>
          <span className="font-semibold">${((transaction.saleAmount * transaction.commissionPercentage) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Company GCI:</span>
          <span className="font-semibold">${transaction.companyGCI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Total Revenue Share:</span>
          <span className="font-semibold text-success-600">
            ${revenueShares.reduce((sum, share) => sum + share.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Accordion type="single" collapsible defaultValue="recipients">
          <AccordionItem value="recipients">
            <AccordionTrigger className="px-4 py-2 hover:bg-gray-50">
              Revenue Share Recipients
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="divide-y divide-gray-200">
                {revenueShares.map((share) => (
                  <div key={share.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-8 w-8 rounded-full ${getAvatarColor(share.recipient?.name)} flex items-center justify-center text-white font-medium`}>
                          {getInitials(share.recipient?.name)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {share.recipient?.name || "Unknown"}
                          </div>
                          <div className="flex items-center text-xs">
                            <Badge variant={share.recipient?.agentType === 'principal' ? 'principal' : 'support'} className="mr-2">
                              {share.recipient?.agentType === 'principal' ? 'Principal' : 'Support'}
                            </Badge>
                            <span className="text-gray-500">Tier {share.tier}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-success-600">
                          ${share.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {share.percentage?.toFixed(2)}% of Company GCI
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <Progress value={share.percentage} className="h-1.5" />
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      From: {share.source?.name || "Direct Transaction"}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default RevenueShareBreakdown;