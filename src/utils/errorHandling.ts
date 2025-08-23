export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Cannot connect to server. Please check your internet connection.';
    }
    if (error.message.includes('NetworkError')) {
      return 'Network error. Please check your connection and try again.';
    }
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

export function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Authentication required. Please refresh the page.';
    case 403:
      return 'Access denied. You do not have permission to perform this action.';
    case 404:
      return 'Resource not found. The requested item may have been removed.';
    case 409:
      return 'Conflict. This item may already exist.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
      return 'Bad gateway. The server is temporarily unavailable.';
    case 503:
      return 'Service unavailable. Please try again later.';
    case 504:
      return 'Gateway timeout. The request took too long to process.';
    default:
      return `HTTP error ${status}. Please try again.`;
  }
}

export async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorMessage = getHttpErrorMessage(response.status);
    throw new Error(errorMessage);
  }
  
  try {
    return await response.json();
  } catch (error) {
    throw new Error('Invalid response from server. Please try again.');
  }
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') ||
           error.message.includes('ERR_NETWORK') ||
           error.message.includes('ERR_INTERNET_DISCONNECTED');
  }
  return false;
}

export function shouldRetry(error: unknown, attempt: number, maxRetries: number = 3): boolean {
  if (attempt >= maxRetries) return false;
  
  if (isNetworkError(error)) return true;
  
  if (error instanceof Error && error.message.includes('500')) {
    return true;
  }
  
  return false;
}

export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error, attempt, maxRetries)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}