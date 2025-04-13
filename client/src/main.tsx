import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AgentProvider } from "./context/AgentContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AgentProvider>
      <App />
      <Toaster />
    </AgentProvider>
  </QueryClientProvider>
);
