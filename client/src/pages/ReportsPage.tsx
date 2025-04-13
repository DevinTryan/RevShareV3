import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Filter, PieChart, BarChart3, Activity, MapPin, Users, RefreshCw, Search } from "lucide-react";
import { LeadSource, AgentType } from "@shared/schema";
import { formatCurrency } from "../utils/formatters";
import { useAgentContext } from "@/context/AgentContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

// Custom tooltip component for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="text-sm font-semibold">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' 
              ? entry.name.toLowerCase().includes('volume') || entry.name.toLowerCase().includes('gci') || entry.name.toLowerCase().includes('income')
                ? formatCurrency(entry.value)
                : entry.value.toLocaleString()
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// COLORS for charts
const COLORS = ['#4f46e5', '#f43f5e', '#22c55e', '#eab308', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];
const PIE_COLORS = ['#4f46e5', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#f43f5e', '#8b5cf6', '#ec4899'];

// Helper to format date for API
const formatDateForAPI = (dateString: string) => {
  const date = new Date(dateString);
  return date.toISOString();
};

const ReportsPage = () => {
  const { agentsList } = useAgentContext();
  const [activeTab, setActiveTab] = useState("performance");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    to: new Date().toISOString().split('T')[0], // Today
  });
  
  // Filtering state
  const [filters, setFilters] = useState({
    agentId: "",
    transactionType: "",
    leadSource: "",
    address: "",
    zipCode: "",
    minSaleAmount: "",
    maxSaleAmount: "",
    selectedAgentIds: [] as number[],
  });
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Refs for CSV export
  const csvLinkRef = useRef<HTMLAnchorElement>(null);
  
  // API Queries
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['/api/reports/transactions', dateRange.from, dateRange.to, filters.agentId, filters.transactionType, filters.leadSource, filters.address, filters.zipCode, filters.minSaleAmount, filters.maxSaleAmount],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.append('startDate', formatDateForAPI(dateRange.from));
      searchParams.append('endDate', formatDateForAPI(dateRange.to));
      
      if (filters.agentId) searchParams.append('agentId', filters.agentId);
      if (filters.transactionType) searchParams.append('transactionType', filters.transactionType);
      if (filters.leadSource) searchParams.append('leadSource', filters.leadSource);
      if (filters.address) searchParams.append('address', filters.address);
      if (filters.zipCode) searchParams.append('zipCode', filters.zipCode);
      if (filters.minSaleAmount) searchParams.append('minSaleAmount', filters.minSaleAmount);
      if (filters.maxSaleAmount) searchParams.append('maxSaleAmount', filters.maxSaleAmount);
      
      const response = await fetch(`/api/reports/transactions?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return await response.json();
    },
    enabled: activeTab === 'transactions'
  });
  
  const { data: agentPerformance, isLoading: isLoadingAgentPerformance } = useQuery({
    queryKey: ['/api/reports/agent-performance', dateRange.from, dateRange.to, filters.agentId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.append('startDate', formatDateForAPI(dateRange.from));
      searchParams.append('endDate', formatDateForAPI(dateRange.to));
      
      if (filters.agentId) searchParams.append('agentId', filters.agentId);
      
      const response = await fetch(`/api/reports/agent-performance?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch agent performance');
      return await response.json();
    },
    enabled: activeTab === 'agents' || activeTab === 'performance'
  });
  
  const { data: leadSourceData, isLoading: isLoadingLeadSource } = useQuery({
    queryKey: ['/api/reports/lead-source', dateRange.from, dateRange.to, filters.agentId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.append('startDate', formatDateForAPI(dateRange.from));
      searchParams.append('endDate', formatDateForAPI(dateRange.to));
      
      if (filters.agentId) searchParams.append('agentId', filters.agentId);
      
      const response = await fetch(`/api/reports/lead-source?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch lead source data');
      return await response.json();
    },
    enabled: activeTab === 'performance'
  });
  
  const { data: incomeData, isLoading: isLoadingIncome } = useQuery({
    queryKey: ['/api/reports/income-distribution', dateRange.from, dateRange.to, filters.agentId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.append('startDate', formatDateForAPI(dateRange.from));
      searchParams.append('endDate', formatDateForAPI(dateRange.to));
      
      if (filters.agentId) searchParams.append('agentId', filters.agentId);
      
      const response = await fetch(`/api/reports/income-distribution?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch income distribution');
      return await response.json();
    },
    enabled: activeTab === 'performance'
  });
  
  const { data: zipCodeData, isLoading: isLoadingZipCode } = useQuery({
    queryKey: ['/api/reports/zip-code-analysis', dateRange.from, dateRange.to],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.append('startDate', formatDateForAPI(dateRange.from));
      searchParams.append('endDate', formatDateForAPI(dateRange.to));
      
      const response = await fetch(`/api/reports/zip-code-analysis?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch zip code analysis');
      return await response.json();
    },
    enabled: activeTab === 'transactions'
  });
  
  // Handle agent selection
  const toggleAgentSelection = (agentId: number) => {
    setFilters(prev => {
      if (prev.selectedAgentIds.includes(agentId)) {
        return { ...prev, selectedAgentIds: prev.selectedAgentIds.filter(id => id !== agentId) };
      } else {
        return { ...prev, selectedAgentIds: [...prev.selectedAgentIds, agentId] };
      }
    });
  };
  
  // Generate CSV data and trigger download
  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    // Extract headers from the first item
    const headers = Object.keys(data[0]);
    
    // Convert to CSV
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might need quotes (strings with commas, etc.)
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    if (csvLinkRef.current) {
      csvLinkRef.current.href = url;
      csvLinkRef.current.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      csvLinkRef.current.click();
      URL.revokeObjectURL(url);
    }
  };
  
  // Format data for charts
  const getFormattedAgentChartData = () => {
    if (!agentPerformance) return [];
    
    return agentPerformance
      .filter(agent => agent.transactionCount > 0)
      .slice(0, 10) // Top 10 for readability
      .map(agent => ({
        name: agent.agentName,
        'GCI': agent.totalGCI,
        'Transaction Count': agent.transactionCount,
        'Volume': agent.totalVolume,
        'Agent Income': agent.totalAgentIncome,
        'Company Income': agent.totalCompanyIncome,
      }));
  };
  
  const getFormattedLeadSourceData = () => {
    if (!leadSourceData) return [];
    
    return leadSourceData.map(source => ({
      name: source.leadSource.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: source.transactionCount,
      volume: source.totalVolume,
      gci: source.totalGCI,
    }));
  };
  
  const getFormattedZipCodeData = () => {
    if (!zipCodeData) return [];
    
    return zipCodeData
      .filter(zip => zip.transactionCount > 0)
      .slice(0, 10) // Top 10 for readability
      .map(zip => ({
        name: zip.zipCode,
        'Transaction Count': zip.transactionCount,
        'Average Sale Price': zip.averageSalePrice,
        'Total Volume': zip.totalVolume,
        'Total GCI': zip.totalGCI,
      }));
  };
  
  const isLoading = isLoadingTransactions || isLoadingAgentPerformance || isLoadingLeadSource || isLoadingIncome || isLoadingZipCode;
  
  return (
    <>
      {/* Hidden link for CSV download */}
      <a ref={csvLinkRef} style={{ display: 'none' }}></a>
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">Comprehensive analysis of transactions, agent performance and revenue</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)} 
            className="inline-flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button 
            className="inline-flex items-center" 
            onClick={() => {
              if (activeTab === 'transactions' && transactionsData) {
                downloadCSV(transactionsData, 'transactions-report');
              } else if (activeTab === 'agents' && agentPerformance) {
                downloadCSV(agentPerformance, 'agent-performance-report');
              } else if (activeTab === 'performance' && leadSourceData) {
                downloadCSV(leadSourceData, 'lead-source-report');
              }
            }}
            disabled={isLoading}
          >
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        </div>
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
        
        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-medium mb-3">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="agentFilter">Agent</Label>
                <Select
                  value={filters.agentId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, agentId: value }))}
                >
                  <SelectTrigger id="agentFilter">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Agents</SelectItem>
                    {agentsList.map(agent => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="typeFilter">Transaction Type</Label>
                <Select
                  value={filters.transactionType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, transactionType: value }))}
                >
                  <SelectTrigger id="typeFilter">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="leadSourceFilter">Lead Source</Label>
                <Select
                  value={filters.leadSource}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, leadSource: value }))}
                >
                  <SelectTrigger id="leadSourceFilter">
                    <SelectValue placeholder="Select Lead Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sources</SelectItem>
                    {Object.values(LeadSource).map(source => (
                      <SelectItem key={source} value={source}>
                        {source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="addressFilter">Address Contains</Label>
                <Input
                  id="addressFilter"
                  placeholder="Enter address..."
                  value={filters.address}
                  onChange={(e) => setFilters(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="zipCodeFilter">Zip Code</Label>
                <Input
                  id="zipCodeFilter"
                  placeholder="Enter zip code..."
                  value={filters.zipCode}
                  onChange={(e) => setFilters(prev => ({ ...prev, zipCode: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="minSaleAmount">Min Price</Label>
                  <Input
                    id="minSaleAmount"
                    placeholder="Min $"
                    type="number"
                    value={filters.minSaleAmount}
                    onChange={(e) => setFilters(prev => ({ ...prev, minSaleAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="maxSaleAmount">Max Price</Label>
                  <Input
                    id="maxSaleAmount"
                    placeholder="Max $"
                    type="number"
                    value={filters.maxSaleAmount}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxSaleAmount: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="performance" className="py-2">
            <PieChart className="h-4 w-4 mr-2" /> Performance
          </TabsTrigger>
          <TabsTrigger value="agents" className="py-2">
            <Users className="h-4 w-4 mr-2" /> Agent Reports
          </TabsTrigger>
          <TabsTrigger value="transactions" className="py-2">
            <BarChart3 className="h-4 w-4 mr-2" /> Transaction Reports
          </TabsTrigger>
        </TabsList>
        
        {/* Performance Reports */}
        <TabsContent value="performance" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Distribution</CardTitle>
                  <CardDescription>
                    Income distribution between agents and company for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {incomeData && (
                    <>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={[
                                { name: 'Agent Income', value: incomeData.totalAgentIncome || 0 },
                                { name: 'Company Income', value: incomeData.totalCompanyIncome || 0 },
                                { name: 'Showing Agent Fees', value: incomeData.totalShowingAgentFees || 0 },
                                { name: 'Referral Fees', value: incomeData.totalReferralFees || 0 },
                              ]}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {[
                                { name: 'Agent Income', value: incomeData.totalAgentIncome || 0 },
                                { name: 'Company Income', value: incomeData.totalCompanyIncome || 0 },
                                { name: 'Showing Agent Fees', value: incomeData.totalShowingAgentFees || 0 },
                                { name: 'Referral Fees', value: incomeData.totalReferralFees || 0 },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center">
                            <div className="p-3 rounded-full bg-primary-50 text-primary-600">
                              <Activity className="h-5 w-5" />
                            </div>
                            <div className="ml-3">
                              <p className="text-lg font-semibold">{formatCurrency(incomeData.totalGCI || 0)}</p>
                              <p className="text-sm text-gray-500">Total GCI</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center">
                            <div className="p-3 rounded-full bg-green-50 text-green-600">
                              <Users className="h-5 w-5" />
                            </div>
                            <div className="ml-3">
                              <p className="text-lg font-semibold">{incomeData.activeAgentCount || 0}</p>
                              <p className="text-sm text-gray-500">Active Agents</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center">
                            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                              <RefreshCw className="h-5 w-5" />
                            </div>
                            <div className="ml-3">
                              <p className="text-lg font-semibold">{incomeData.transactionCount || 0}</p>
                              <p className="text-sm text-gray-500">Transactions</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center">
                            <div className="p-3 rounded-full bg-amber-50 text-amber-600">
                              <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="ml-3">
                              <p className="text-lg font-semibold">
                                {incomeData.totalAgentIncome && incomeData.totalGCI 
                                  ? `${((incomeData.totalAgentIncome / incomeData.totalGCI) * 100).toFixed(0)}%`
                                  : '0%'
                                }
                              </p>
                              <p className="text-sm text-gray-500">Agent Income %</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Lead Source Analysis</CardTitle>
                  <CardDescription>
                    Distribution of transactions by lead source
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {leadSourceData && leadSourceData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getFormattedLeadSourceData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
                          <YAxis yAxisId="right" orientation="right" stroke={COLORS[1]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="value" name="Transaction Count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="volume" name="Volume ($)" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                      <p className="text-gray-500">No lead source data available for the selected filters</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        
        {/* Agent Reports */}
        <TabsContent value="agents" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Agent Performance Metrics</CardTitle>
                  <CardDescription>
                    Detailed agent performance metrics for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {agentPerformance && agentPerformance.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getFormattedAgentChartData()} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="GCI" name="GCI ($)" stackId="a" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Agent Income" name="Agent Income ($)" stackId="a" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Company Income" name="Company Income ($)" stackId="a" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                      <p className="text-gray-500">No agent performance data available for the selected filters</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Agent Performance Table</CardTitle>
                    <CardDescription>
                      Detailed metrics for all agents
                    </CardDescription>
                  </div>
                  <Input 
                    placeholder="Search agents..." 
                    className="max-w-sm"
                    style={{ display: 'none' }} // Temporarily hidden until search functionality is implemented
                  />
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-4 py-3">Agent</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Transactions</th>
                          <th className="px-4 py-3 text-right">Volume</th>
                          <th className="px-4 py-3 text-right">GCI</th>
                          <th className="px-4 py-3 text-right">Agent Income</th>
                          <th className="px-4 py-3 text-right">Company Income</th>
                          <th className="px-4 py-3 text-right">Avg. Sale Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentPerformance?.map((agent, index) => (
                          <tr key={agent.agentId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 font-medium">{agent.agentName}</td>
                            <td className="px-4 py-3">
                              <Badge variant={agent.agentType === AgentType.PRINCIPAL ? "default" : "secondary"}>
                                {agent.agentType}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">{agent.transactionCount}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(agent.totalVolume)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(agent.totalGCI)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(agent.totalAgentIncome)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(agent.totalCompanyIncome)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(agent.averageSalePrice)}</td>
                          </tr>
                        ))}
                        
                        {/* Show totals row */}
                        {agentPerformance && agentPerformance.length > 0 && (
                          <tr className="font-semibold bg-gray-100">
                            <td className="px-4 py-3">TOTALS</td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-right">
                              {agentPerformance.reduce((sum, agent) => sum + agent.transactionCount, 0)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(agentPerformance.reduce((sum, agent) => sum + agent.totalVolume, 0))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(agentPerformance.reduce((sum, agent) => sum + agent.totalGCI, 0))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(agentPerformance.reduce((sum, agent) => sum + agent.totalAgentIncome, 0))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(agentPerformance.reduce((sum, agent) => sum + agent.totalCompanyIncome, 0))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(
                                agentPerformance.reduce((sum, agent) => sum + agent.totalVolume, 0) / 
                                agentPerformance.reduce((sum, agent) => sum + agent.transactionCount, 0)
                              )}
                            </td>
                          </tr>
                        )}
                        
                        {(!agentPerformance || agentPerformance.length === 0) && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No agent data available for the selected period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        
        {/* Transaction Reports */}
        <TabsContent value="transactions" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction Volume by Zip Code</CardTitle>
                    <CardDescription>
                      Geographic distribution of transaction volume
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {zipCodeData && zipCodeData.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getFormattedZipCodeData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="Transaction Count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Average Sale Price" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                        <p className="text-gray-500">No zip code data available for the selected filters</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction Type Distribution</CardTitle>
                    <CardDescription>
                      Distribution of buyer vs seller transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {transactionsData && transactionsData.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={[
                                { 
                                  name: 'Buyer', 
                                  value: transactionsData.filter(t => t.transactionType === 'buyer').length,
                                  volume: transactionsData
                                    .filter(t => t.transactionType === 'buyer')
                                    .reduce((sum, t) => sum + t.saleAmount, 0)
                                },
                                { 
                                  name: 'Seller', 
                                  value: transactionsData.filter(t => t.transactionType === 'seller').length,
                                  volume: transactionsData
                                    .filter(t => t.transactionType === 'seller')
                                    .reduce((sum, t) => sum + t.saleAmount, 0)
                                },
                              ]}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {[
                                { name: 'Buyer', value: transactionsData.filter(t => t.transactionType === 'buyer').length },
                                { name: 'Seller', value: transactionsData.filter(t => t.transactionType === 'seller').length },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md">
                        <p className="text-gray-500">No transaction type data available for the selected filters</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Transactions List</CardTitle>
                    <CardDescription>
                      Detailed list of all transactions for the selected period
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input 
                      placeholder="Search transactions..." 
                      className="max-w-sm"
                      style={{ display: 'none' }} // Temporarily hidden until search functionality is implemented
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Address</th>
                          <th className="px-4 py-3">Agent</th>
                          <th className="px-4 py-3">Client</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Sale Amount</th>
                          <th className="px-4 py-3 text-right">GCI</th>
                          <th className="px-4 py-3">Lead Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionsData?.map((transaction, index) => {
                          const agent = agentsList.find(a => a.id === transaction.agentId);
                          return (
                            <tr key={transaction.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3">
                                {new Date(transaction.transactionDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 font-medium">{transaction.propertyAddress}</td>
                              <td className="px-4 py-3">{agent?.name || `Agent #${transaction.agentId}`}</td>
                              <td className="px-4 py-3">{transaction.clientName || 'N/A'}</td>
                              <td className="px-4 py-3">
                                <Badge variant={transaction.transactionType === 'buyer' ? "default" : "secondary"}>
                                  {transaction.transactionType}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">{formatCurrency(transaction.saleAmount)}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(transaction.companyGCI)}</td>
                              <td className="px-4 py-3">
                                {transaction.leadSource ? (
                                  <Badge variant="outline">
                                    {transaction.leadSource.replace('_', ' ')}
                                  </Badge>
                                ) : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                        
                        {(!transactionsData || transactionsData.length === 0) && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No transactions available for the selected period and filters
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
};

export default ReportsPage;