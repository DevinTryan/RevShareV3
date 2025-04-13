import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="rounded-full bg-red-100 p-4 mb-6">
        <ShieldAlert className="h-16 w-16 text-red-600" />
      </div>
      <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 text-center max-w-md">
        You don't have permission to access this page. Please contact an administrator if you believe this is an error.
      </p>
      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/">Go Home</Link>
        </Button>
        <Button asChild>
          <Link href="/auth">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}