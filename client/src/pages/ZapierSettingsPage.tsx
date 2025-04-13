import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Clipboard, Zap, ExternalLink, Plus, Trash2, Copy, Check, X } from "lucide-react";

// Interface for webhook data
interface Webhook {
  id: string;
  url: string;
  event: string;
  createdAt: string;
}

// Main Zapier Settings Component
function ZapierSettingsPage() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvent, setWebhookEvent] = useState("transaction.created");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Fetch webhooks
  const { data: webhooks, isLoading: isLoadingWebhooks, error } = useQuery<Webhook[]>({
    queryKey: ['/api/webhooks'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: { url: string; event: string }) => {
      const response = await apiRequest('POST', '/api/webhooks', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      toast({
        title: "Webhook Created",
        description: "Your Zapier integration has been set up successfully.",
      });
      setWebhookUrl("");
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create webhook: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/webhooks/${id}`);
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      toast({
        title: "Webhook Removed",
        description: "The Zapier integration has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete webhook: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle webhook creation
  const handleCreateWebhook = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid webhook URL.",
        variant: "destructive",
      });
      return;
    }
    
    createWebhookMutation.mutate({
      url: webhookUrl,
      event: webhookEvent,
    });
  };
  
  // Copy webhook URL to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // Test webhook URL
  const testWebhook = async (url: string, event: string) => {
    try {
      const testData = {
        event,
        test: true,
        timestamp: new Date().toISOString(),
        data: { message: "This is a test webhook from Talk Realty." }
      };
      
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      if (response.ok) {
        toast({
          title: "Test Successful",
          description: "The test webhook was sent successfully.",
        });
      } else {
        toast({
          title: "Test Failed",
          description: "Failed to send test webhook.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error testing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getWebhookBaseUrl = () => {
    return `${window.location.origin}/api/webhooks/zapier`;
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Zapier Integration</h1>
          <p className="text-muted-foreground">Connect your Talk Realty system with other apps through Zapier</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Zapier Integration</DialogTitle>
              <DialogDescription>
                Enter the webhook URL provided by Zapier to connect your apps.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="webhookUrl" className="text-sm font-medium">Webhook URL</label>
                <Input
                  id="webhookUrl"
                  placeholder="https://hooks.zapier.com/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="webhookEvent" className="text-sm font-medium">Event to Subscribe To</label>
                <select
                  id="webhookEvent"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                >
                  <option value="transaction.created">Transaction Created</option>
                  <option value="agent.created">Agent Created</option>
                  <option value="revenue_share.created">Revenue Share Created</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateWebhook} disabled={createWebhookMutation.isPending}>
                {createWebhookMutation.isPending ? "Adding..." : "Add Integration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="active">
        <TabsList className="mb-6">
          <TabsTrigger value="active">Active Integrations</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active">
          {isLoadingWebhooks ? (
            <div className="text-center py-8">Loading integrations...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Failed to load integrations. Please try again.
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="grid gap-6">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <Zap size={18} className="text-primary" />
                          <CardTitle className="text-lg">
                            {webhook.event === 'transaction.created' ? 'New Transaction' : 
                             webhook.event === 'agent.created' ? 'New Agent' :
                             webhook.event}
                          </CardTitle>
                        </div>
                        <CardDescription className="mt-1 text-sm">
                          Created on {formatDate(webhook.createdAt)}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-primary/10">
                        {webhook.event.split('.')[0]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden text-ellipsis">
                      <code className="text-xs bg-muted p-1 rounded">{webhook.url}</code>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => testWebhook(webhook.url, webhook.event)}
                      className="gap-1"
                    >
                      <Zap size={14} />
                      Test
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive border-destructive/20 hover:bg-destructive/5 gap-1"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this integration?')) {
                          deleteWebhookMutation.mutate(webhook.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg bg-muted/20">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap size={24} className="text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-2">No Integrations Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Connect your Talk Realty system with Zapier to automate workflows with 3000+ apps.
              </p>
              <Button onClick={() => setOpen(true)}>Add Your First Integration</Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>How to Set Up Zapier Integration</CardTitle>
              <CardDescription>
                Follow these steps to connect Talk Realty with your favorite apps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                  <span>Create a Zap in Zapier</span>
                </h3>
                <div className="ml-8">
                  <p className="text-muted-foreground mb-2">
                    Start by creating a new Zap in your Zapier account.
                  </p>
                  <a 
                    href="https://zapier.com/app/editor" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <span>Go to Zapier</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                  <span>Use Webhook URLs</span>
                </h3>
                <div className="ml-8 space-y-4">
                  <p className="text-muted-foreground">
                    Use one of the following webhook URLs in your Zapier setup:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">POST</Badge>
                        <span className="font-medium">Transaction Webhook</span>
                      </div>
                      <div className="relative">
                        <div className="flex items-center gap-2 bg-muted p-3 rounded-md text-sm font-mono">
                          {getWebhookBaseUrl()}/transaction
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={() => copyToClipboard(`${getWebhookBaseUrl()}/transaction`)}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">POST</Badge>
                        <span className="font-medium">Agent Webhook</span>
                      </div>
                      <div className="relative">
                        <div className="flex items-center gap-2 bg-muted p-3 rounded-md text-sm font-mono">
                          {getWebhookBaseUrl()}/agent
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={() => copyToClipboard(`${getWebhookBaseUrl()}/agent`)}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                  <span>Configure Notifications</span>
                </h3>
                <div className="ml-8">
                  <p className="text-muted-foreground mb-2">
                    Add your Zapier-provided webhook URL to receive notifications about:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>New transactions</li>
                    <li>New agent registrations</li>
                    <li>Revenue share distributions</li>
                  </ul>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">4</span>
                  <span>Test Your Integration</span>
                </h3>
                <div className="ml-8">
                  <p className="text-muted-foreground">
                    After setting up your integration, use the test button to verify the connection works properly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ZapierSettingsPage;