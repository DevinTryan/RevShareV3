import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { UserRole } from "@shared/schema";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  roles?: UserRole[];
}

export function ProtectedRoute({
  path,
  component: Component,
  roles,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/auth" />;
        }

        // Check if user role is allowed
        if (roles && !roles.includes(user.role)) {
          return <Redirect to="/unauthorized" />;
        }

        return <Component />;
      }}
    </Route>
  );
}

export function AdminRoute({ path, component }: { path: string, component: React.ComponentType }) {
  return <ProtectedRoute path={path} component={component} roles={[UserRole.ADMIN]} />;
}

export function AgentRoute({ path, component }: { path: string, component: React.ComponentType }) {
  return <ProtectedRoute path={path} component={component} />;
}