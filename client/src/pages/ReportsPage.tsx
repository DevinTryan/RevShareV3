import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState("performance");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    to: new Date().toISOString().split('T')[0], // Today
  });

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and view reports on revenue share performance</p>
        </div>
        <Button className="inline-flex items-center">
          <i className="ri-download-line mr-2"></i> Export Reports
        </Button>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="performance" className="py-2">
            Performance
          </TabsTrigger>
          <TabsTrigger value="agents" className="py-2">
            Agent Reports
          </TabsTrigger>
          <TabsTrigger value="transactions" className="py-2">
            Transaction Reports
          </TabsTrigger>
        </TabsList>
        
        {/* Performance Reports */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Share Performance</CardTitle>
              <CardDescription>
                Overview of revenue share performance during the selected period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-500">Chart will be displayed here</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-primary-50 text-primary-600">
                      <i className="ri-money-dollar-circle-line text-xl"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-lg font-semibold">$25,430</p>
                      <p className="text-sm text-gray-500">Total Revenue Share</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-50 text-green-600">
                      <i className="ri-user-received-line text-xl"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-lg font-semibold">45</p>
                      <p className="text-sm text-gray-500">Active Agents</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                      <i className="ri-exchange-funds-line text-xl"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-lg font-semibold">128</p>
                      <p className="text-sm text-gray-500">Transactions</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Agent Reports */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Reports</CardTitle>
              <CardDescription>
                Detailed agent performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-500">Agent performance chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Transaction Reports */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Reports</CardTitle>
              <CardDescription>
                Detailed transaction metrics and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-500">Transaction trend chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
};

export default ReportsPage;