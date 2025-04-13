import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";
import { UserRole } from "@shared/schema";
import { ReactNode } from "react";

interface ProtectedContentProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedContent({ children, roles }: ProtectedContentProps) {
  const { user, isLoading } = useAuth();

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

  return <>{children}</>;
}