/**
 * API configuration utility to handle different environments
 */

// Get the API base URL based on the current environment
export function getApiBaseUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    
    // Determine API port based on current environment
    let apiPort = '3001'; // Default for development/production
    
    if (port === '4000') {
      // Docker production: frontend on 4000, API on 4001
      apiPort = '4001';
    } else if (port === '3000' && hostname === 'localhost') {
      // Production: frontend on 3000, API on 3001
      apiPort = '3001';
    } else if (port === '' || port === '80' || port === '443') {
      // Production with standard ports - try same origin first
      return `${protocol}//${hostname}`;
    }
    
    return `${protocol}//${hostname}:${apiPort}`;
  } else {
    // Server-side (SSR) or test environment
    return 'http://localhost:3001';
  }
}

/**
 * Create a full API URL from a relative path
 */
export function createApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Enhanced fetch function that automatically handles API URLs
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = createApiUrl(path);
  
  // Don't set Content-Type for FormData, let the browser handle it
  const isFormData = options?.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options?.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
}