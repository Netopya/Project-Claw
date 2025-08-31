/**
 * API configuration utility to handle different environments
 */

// Get the API base URL based on the current environment
export function getApiBaseUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    // Client-side - always use direct API URL for now
    // TODO: Re-enable proxy when Astro dev server is running
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
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