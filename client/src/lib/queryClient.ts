import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_CONFIG, getApiUrl } from "./apiConfig";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use the getApiUrl helper to ensure the URL is properly formatted
  const fullUrl = url.startsWith('http') ? url : getApiUrl(url);
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: {
        ...API_CONFIG.defaultHeaders,
        ...(data ? { 'Content-Type': 'application/json' } : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: API_CONFIG.includeCredentials ? "include" : "same-origin",
      mode: 'cors'
    });

    // Don't throw here, let the caller handle the response status
    return res;
  } catch (error) {
    // This will catch network errors like CORS issues, connection refused, etc.
    console.error(`Network error when fetching ${fullUrl}:`, error);
    throw new Error(`Network error: Unable to connect to the server. Please check your connection and try again.`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use the getApiUrl helper to ensure the URL is properly formatted
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : getApiUrl(url);
    
    try {
      const res = await fetch(fullUrl, {
        credentials: API_CONFIG.includeCredentials ? "include" : "same-origin",
        headers: API_CONFIG.defaultHeaders,
        mode: 'cors'
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      
      return await res.json();
    } catch (error) {
      console.error(`Error fetching ${fullUrl}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
