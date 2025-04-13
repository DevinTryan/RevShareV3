import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  showBackButton?: boolean;
  actionButton?: React.ReactNode;
  toggleMenu?: () => void;
}

const PageHeader = ({ 
  title, 
  description, 
  showBackButton = true, 
  actionButton,
  toggleMenu
}: PageHeaderProps) => {
  const [, navigate] = useLocation();
  
  // Function to go back
  const goBack = () => {
    // Use window.history to go back
    window.history.back();
  };
  
  return (
    <div className="flex flex-col space-y-2 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          {toggleMenu && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden mr-2"
              onClick={toggleMenu}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={goBack}
              className="mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        
        {actionButton && (
          <div>{actionButton}</div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;