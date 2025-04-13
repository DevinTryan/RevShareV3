import { useMemo } from 'react';
import { Transaction } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

interface TransactionPipelineProps {
  transactions: Transaction[];
}

const TransactionPipeline = ({ transactions }: TransactionPipelineProps) => {
  // Define pipeline stages
  const stages = [
    { id: 'new', label: 'New', color: 'bg-primary-500' },
    { id: 'pending', label: 'Pending', color: 'bg-amber-500' },
    { id: 'active', label: 'Active', color: 'bg-indigo-500' },
    { id: 'closed', label: 'Closed', color: 'bg-success-500' },
    { id: 'cancelled', label: 'Cancelled', color: 'bg-destructive' },
  ];

  // Calculate transactions in each stage
  const pipelineData = useMemo(() => {
    const stageMap = new Map(stages.map(stage => [stage.id, { 
      count: 0, 
      value: 0,
      transactions: [] as Transaction[]
    }]));
    
    // Map status values to stage IDs
    const statusToStage: Record<string, string> = {
      'new': 'new',
      'pending': 'pending',
      'active': 'active',
      'closed': 'closed',
      'cancelled': 'cancelled',
    };
    
    // Count transactions in each stage
    transactions.forEach(tx => {
      const stageId = statusToStage[tx.transactionStatus || 'pending'];
      const stageData = stageMap.get(stageId);
      
      if (stageData) {
        stageData.count += 1;
        stageData.value += tx.saleAmount; // Add sale amount to stage value
        stageData.transactions.push(tx);
      }
    });
    
    // Calculate totals for percentages
    const totalCount = Array.from(stageMap.values()).reduce((sum, stage) => sum + stage.count, 0);
    const totalValue = Array.from(stageMap.values()).reduce((sum, stage) => sum + stage.value, 0);
    
    return stages.map(stage => {
      const data = stageMap.get(stage.id) || { count: 0, value: 0, transactions: [] };
      return {
        ...stage,
        count: data.count,
        value: data.value,
        transactions: data.transactions,
        countPercentage: totalCount ? (data.count / totalCount) * 100 : 0,
        valuePercentage: totalValue ? (data.value / totalValue) * 100 : 0,
      };
    });
  }, [transactions]);

  // Calculate total pipeline value
  const totalPipelineValue = useMemo(() => {
    return pipelineData.reduce((sum, stage) => sum + stage.value, 0);
  }, [pipelineData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Transaction Pipeline</CardTitle>
        <CardDescription>
          Current value: ${totalPipelineValue.toLocaleString()} across {transactions.length} transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {pipelineData.map((stage) => (
            <div key={stage.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${stage.color}`}></div>
                  <span className="font-medium text-sm">{stage.label}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {stage.count} transactions (${stage.value.toLocaleString()})
                </div>
              </div>
              <Progress
                value={stage.valuePercentage}
                className="h-2"
                indicatorClassName={stage.color}
              />
              
              {/* Show the most recent transactions in this stage (limit to 2) */}
              {stage.count > 0 && (
                <div className="pl-5 border-l-2 border-gray-200 mt-2 space-y-2">
                  {stage.transactions
                    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
                    .slice(0, 2)
                    .map((tx) => (
                      <div key={tx.id} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <div className="font-medium">{tx.propertyAddress}</div>
                        <div className="flex justify-between mt-1">
                          <span>${tx.saleAmount.toLocaleString()}</span>
                          <span>{format(new Date(tx.transactionDate), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    ))}
                  {stage.count > 2 && (
                    <div className="text-xs text-blue-600 font-medium">
                      +{stage.count - 2} more transactions
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionPipeline;