import type { ErrorResponse } from '../../types/anime.js';

/**
 * Custom error classes for different types of API errors
 */
export class MyAnimeListError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'MyAnimeListError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
  }
}

export class NotFoundError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'NOT_FOUND') {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
    this.statusCode = 404;
  }
}

export class RateLimitError extends Error {
  public code: string;
  public statusCode: number;
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
  }
}

/**
 * Handle MyAnimeList API errors and convert to appropriate error types
 */
export function handleMyAnimeListError(error: any): MyAnimeListError {
  if (error instanceof MyAnimeListError) {
    return error;
  }

  // Handle fetch errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new MyAnimeListError(
      'Failed to connect to MyAnimeList API. Please check your internet connection.',
      'NETWORK_ERROR',
      503
    );
  }

  // Handle HTTP errors
  if (error.message.includes('404')) {
    return new NotFoundError('Anime not found on MyAnimeList');
  }

  if (error.message.includes('429')) {
    return new RateLimitError('MyAnimeList API rate limit exceeded. Please try again later.');
  }

  if (error.message.includes('401') || error.message.includes('403')) {
    return new MyAnimeListError(
      'Authentication failed. Please check your MyAnimeList API credentials.',
      'AUTH_ERROR',
      401
    );
  }

  // Generic API error
  return new MyAnimeListError(
    error.message || 'An unexpected error occurred while fetching anime data',
    'API_ERROR',
    500
  );
}

/**
 * Convert error to standardized error response format
 */
export function createErrorResponse(error: Error): ErrorResponse {
  if (error instanceof MyAnimeListError || 
      error instanceof ValidationError || 
      error instanceof NotFoundError || 
      error instanceof RateLimitError) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
    };
  }

  // Generic error
  return {
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Log error with appropriate level based on error type
 */
export function logError(error: Error, context?: string): void {
  const prefix = context ? `[${context}]` : '';
  
  if (error instanceof ValidationError) {
    console.warn(`${prefix} Validation error:`, error.message);
  } else if (error instanceof NotFoundError) {
    console.info(`${prefix} Not found:`, error.message);
  } else if (error instanceof RateLimitError) {
    console.warn(`${prefix} Rate limit exceeded:`, error.message);
  } else if (error instanceof MyAnimeListError) {
    console.error(`${prefix} MyAnimeList API error:`, error.message, error.code);
  } else {
    console.error(`${prefix} Unexpected error:`, error);
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof MyAnimeListError) {
    return error.code === 'NETWORK_ERROR' || error.statusCode >= 500;
  }

  return false;
}

/**
 * Get retry delay for retryable errors
 */
export function getRetryDelay(error: Error, attempt: number): number {
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000; // Convert to milliseconds
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context?: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !isRetryableError(lastError)) {
        break;
      }

      const delay = getRetryDelay(lastError, attempt);
      console.warn(`${context ? `[${context}]` : ''} Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}