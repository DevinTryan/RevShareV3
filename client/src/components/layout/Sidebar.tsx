import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navItems = [
    { path: "/", label: "Dashboard", icon: "ri-dashboard-line" },
    { path: "/agents", label: "Agents", icon: "ri-user-line" },
    { path: "/transactions", label: "Transactions", icon: "ri-exchange-dollar-line" },
    { path: "/revenue-share", label: "Revenue Share", icon: "ri-money-dollar-circle-line" },
    { path: "/reports", label: "Reports", icon: "ri-bar-chart-line" },
    { path: "/settings", label: "Settings", icon: "ri-settings-line" },
    { path: "/integrations/zapier", label: "Zapier", icon: "ri-link-m" },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-sm transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-primary-600">Talk Data</h1>
          <p className="text-sm text-gray-500">Agent Management System</p>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link 
                key={item.path}
                href={item.path}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                  location === item.path 
                    ? "bg-primary-50 text-primary-600" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <i className={`${item.icon} mr-3 text-lg`}></i>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email || 'user@company.com'}</p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <div className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer">
                  <i className="ri-more-2-fill text-gray-500"></i>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <i className="ri-user-settings-line mr-2"></i> Manage Users
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <i className="ri-user-3-line mr-2"></i> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600 focus:text-red-600" 
                  onClick={() => {
                    logoutMutation.mutate();
                    navigate('/auth');
                  }}
                >
                  <i className="ri-logout-box-line mr-2"></i> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
