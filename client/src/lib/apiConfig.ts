// This file contains configuration for connecting to the API
// Change this URL to point to your deployed API

export const API_CONFIG = {
  // Base URL for the API
  baseUrl: import.meta.env.VITE_API_URL || 'https://revenue-share-calculator-api.onrender.com',
  
  // Whether to include credentials (cookies) with requests
  includeCredentials: true,
  
  // Default headers for API requests
  defaultHeaders: {
    'Content-Type': 'application/json',
  }
};

// Helper function to build full API URLs
export function getApiUrl(path: string): string {
  // Make sure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.baseUrl}${normalizedPath}`;
}
