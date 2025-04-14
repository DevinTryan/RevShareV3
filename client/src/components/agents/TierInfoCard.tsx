import React from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTierInfo, calculateTierProgress, getGciToNextTier, formatCurrency } from "@/lib/tierUtils";
import { Badge } from "@/components/ui/badge";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TierInfoCardProps {
  gciYtd: number;
  currentTier?: number;
  compact?: boolean;
}

const TierInfoCard: React.FC<TierInfoCardProps> = ({ 
  gciYtd, 
  currentTier = 1,
  compact = false 
}) => {
  const tierInfo = calculateTierInfo(gciYtd);
  const progressPercentage = calculateTierProgress(gciYtd, tierInfo);
  const gciToNextTier = getGciToNextTier(gciYtd, tierInfo);
  
  // Color mapping for tiers (increasing intensity with tier level)
  const tierColors = [
    "bg-blue-100 text-blue-800 border-blue-300",
    "bg-blue-200 text-blue-800 border-blue-300",
    "bg-blue-300 text-blue-800 border-blue-400",
    "bg-indigo-200 text-indigo-800 border-indigo-300",
    "bg-indigo-300 text-indigo-800 border-indigo-400",
    "bg-purple-200 text-purple-800 border-purple-300",
    "bg-purple-300 text-purple-800 border-purple-400",
    "bg-violet-300 text-violet-800 border-violet-400",
    "bg-violet-400 text-violet-800 border-violet-500",
  ];
  
  const tierColor = tierColors[tierInfo.tier - 1] || tierColors[0];
  
  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Badge className={`${tierColor} font-semibold px-2 py-1`}>
          Tier {tierInfo.tier}
        </Badge>
        <span className="text-sm text-gray-600">{tierInfo.commissionPercentage}% commission</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent className="w-80">
              <div className="space-y-2">
                <p className="font-semibold">Support Agent Tier Information</p>
                <p>Current YTD GCI: {formatCurrency(gciYtd)}</p>
                <p>Current Tier: {tierInfo.tier} ({tierInfo.commissionPercentage}% commission)</p>
                {tierInfo.nextTierGci && (
                  <>
                    <p>Progress to next tier: {progressPercentage.toFixed(0)}%</p>
                    <p>GCI needed for next tier: {formatCurrency(gciToNextTier)}</p>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  
  return (
    <Card className="border overflow-hidden">
      <CardHeader className={`${tierColor} py-2 px-4`}>
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Tier {tierInfo.tier}</span>
          <Badge className="bg-white text-gray-800">
            {tierInfo.commissionPercentage}% Commission
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-2 px-4 space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>YTD GCI: {formatCurrency(gciYtd)}</span>
            {tierInfo.nextTierGci && (
              <span>Next: {formatCurrency(tierInfo.nextTierGci)}</span>
            )}
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        {tierInfo.nextTierGci ? (
          <p className="text-sm text-gray-600">
            {formatCurrency(gciToNextTier)} more GCI needed for Tier {tierInfo.tier + 1}
          </p>
        ) : (
          <p className="text-sm text-gray-600">Maximum tier reached</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TierInfoCard;