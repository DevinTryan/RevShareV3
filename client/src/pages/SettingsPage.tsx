import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SettingsPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  
  // Settings state
  const [companySettings, setCompanySettings] = useState({
    companyName: "RealEstate Co.",
    companyPercentage: 15,
    defaultCommissionRate: 3,
    maxRevenueShareTiers: 5,
    darkMode: false,
    emailNotifications: true,
    currency: "USD"
  });
  
  // Handle form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setCompanySettings({
        ...companySettings,
        [name]: parseFloat(value)
      });
    } else {
      setCompanySettings({
        ...companySettings,
        [name]: value
      });
    }
  };
  
  // Handle switch changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setCompanySettings({
      ...companySettings,
      [name]: checked
    });
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setCompanySettings({
      ...companySettings,
      [name]: value
    });
  };
  
  // Save settings
  const handleSaveSettings = () => {
    // In a real app, this would be an API call to save settings
    toast({
      title: "Settings Saved",
      description: "Your settings have been successfully saved.",
    });
  };
  
  // Reset database (for demo purposes)
  const handleResetDatabase = () => {
    // Would normally be an API call
    toast({
      title: "Database Reset",
      description: "The database has been reset successfully.",
    });
  };
  
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your application settings and preferences</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="general" className="py-2">
            General
          </TabsTrigger>
          <TabsTrigger value="company" className="py-2">
            Company
          </TabsTrigger>
          <TabsTrigger value="data" className="py-2">
            Data Management
          </TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-gray-500">
                    Use dark theme for the application
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={companySettings.darkMode}
                  onCheckedChange={(checked) => handleSwitchChange("darkMode", checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={companySettings.currency}
                  onValueChange={(value) => handleSelectChange("currency", value)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                    <SelectItem value="AUD">AUD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Receive email notifications for transactions and revenue shares
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={companySettings.emailNotifications}
                  onCheckedChange={(checked) => handleSwitchChange("emailNotifications", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Company Settings */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Manage your company details and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  name="companyName"
                  placeholder="Enter company name"
                  value={companySettings.companyName}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-percentage">Company Percentage (%)</Label>
                  <Input
                    id="company-percentage"
                    name="companyPercentage"
                    type="number"
                    placeholder="15"
                    min="0"
                    max="100"
                    step="0.1"
                    value={companySettings.companyPercentage}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-gray-500">
                    Percentage of commission the company takes
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default-commission">Default Commission Rate (%)</Label>
                  <Input
                    id="default-commission"
                    name="defaultCommissionRate"
                    type="number"
                    placeholder="3"
                    min="0"
                    max="100"
                    step="0.1"
                    value={companySettings.defaultCommissionRate}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-gray-500">
                    Default rate used in transaction calculator
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-tiers">Maximum Revenue Share Tiers</Label>
                <Input
                  id="max-tiers"
                  name="maxRevenueShareTiers"
                  type="number"
                  placeholder="5"
                  min="1"
                  max="10"
                  value={companySettings.maxRevenueShareTiers}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-gray-500">
                  Maximum number of tiers for revenue sharing (1-10)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Data Management */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>
                Export your data for backup or analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button className="w-full" variant="outline">
                  <i className="ri-download-line mr-2"></i> Export Agents
                </Button>
                <Button className="w-full" variant="outline">
                  <i className="ri-download-line mr-2"></i> Export Transactions
                </Button>
              </div>
              <Button className="w-full" variant="outline">
                <i className="ri-download-line mr-2"></i> Export Revenue Shares
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-red-500">Danger Zone</CardTitle>
              <CardDescription>
                Actions here can result in data loss. Proceed with caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full" 
                variant="destructive"
                onClick={handleResetDatabase}
              >
                Reset Database
              </Button>
              <p className="text-xs text-gray-500">
                This will permanently delete all data. This action cannot be undone.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 flex justify-end">
        <Button
          className="bg-green-500 hover:bg-green-600"
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </div>
    </>
  );
};

export default SettingsPage;