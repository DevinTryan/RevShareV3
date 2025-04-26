import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { UserRole, insertUserSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentContext } from "@/context/AgentContext";
import { Loader2 } from "lucide-react";

// Login form schema
const loginFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

// Registration form schema based on user schema
const registrationFormSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { agentsList, isLoadingAgents } = useAgentContext();
  const [activeTab, setActiveTab] = useState<string>("login");

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Registration form
  const registrationForm = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      role: UserRole.AGENT,
      agentId: undefined,
    },
  });
  
  // If already logged in, redirect to home
  if (user) {
    // Only redirect if not already on home/dashboard
    if (window.location.pathname !== '/') {
      return <Redirect to="/" />;
    }
  }

  // Handle login form submission
  const onLoginSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        // Redirect to dashboard after successful login
        window.location.href = '/';
      }
    });
  };

  // Handle registration form submission
  const onRegisterSubmit = (values: RegistrationFormValues) => {
    // Remove confirmPassword as it's not part of the API schema
    const { confirmPassword, ...userValues } = values;
    registerMutation.mutate(userValues);
  };

  return (
    <div className="container flex flex-col lg:flex-row h-screen items-center justify-center gap-8 py-10">
      {/* Left Column: Auth Forms */}
      <div className="w-full lg:w-1/2 max-w-md">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Welcome to Talk Realty</CardTitle>
            <CardDescription>Sign in or create an account to access the revenue share calculator</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              {/* Login Tab */}
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 pt-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              {/* Register Tab */}
              <TabsContent value="register">
                <Form {...registrationForm}>
                  <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)} className="space-y-4 pt-4">
                    <FormField
                      control={registrationForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registrationForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registrationForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Create a password" {...field} />
                          </FormControl>
                          <FormDescription>
                            Password must be at least 8 characters with uppercase, lowercase, and number.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registrationForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registrationForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={UserRole.ADMIN}>Administrator</SelectItem>
                              <SelectItem value={UserRole.AGENT}>Agent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {registrationForm.watch("role") === UserRole.AGENT && (
                      <FormField
                        control={registrationForm.control}
                        name="agentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Your Agent Profile</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString() || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your agent profile" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {isLoadingAgents ? (
                                  <div className="flex justify-center items-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                ) : (
                                  agentsList.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id.toString()}>
                                      {agent.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Link your account to your agent profile
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Right Column: Hero */}
      <div className="w-full lg:w-1/2 flex flex-col space-y-4 max-w-lg">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
          Talk Realty Revenue Share Calculator
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Accurately track and calculate agent commissions across our multi-tiered relationship model.
        </p>
        <ul className="space-y-2">
          <li className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white">✓</div>
            <span>Track 5-tier agent relationships</span>
          </li>
          <li className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white">✓</div>
            <span>Calculate commissions for Principal & Support agents</span>
          </li>
          <li className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white">✓</div>
            <span>Monitor cap status</span>
          </li>
          <li className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white">✓</div>
            <span>View revenue share reports</span>
          </li>
        </ul>
      </div>
    </div>
  );
}