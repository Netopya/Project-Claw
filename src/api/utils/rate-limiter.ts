/**
 * Rate Limiter Utility
 * 
 * Provides rate limiting functionality for API endpoints to prevent abuse
 * and ensure fair usage of timeline generation resources.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request should be rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry) {
      // First request from this identifier
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    if (now > entry.resetTime) {
      // Window has expired, reset
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return true;
    }

    // Increment count
    entry.count++;
    return false;
  }

  /**
   * Get rate limit info for an identifier
   */
  getRateLimitInfo(identifier: string): {
    remaining: number;
    resetTime: number;
    total: number;
  } {
    const entry = this.requests.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
        total: this.config.maxRequests,
      };
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      total: this.config.maxRequests,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Create rate limiters for different operations
export const timelineRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // 10 timeline requests per minute per IP
});

export const timelineRefreshRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minute window
  maxRequests: 3, // 3 refresh requests per 5 minutes per IP
});

/**
 * Middleware to apply rate limiting
 */
export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return async (c: any, next: any) => {
    // Use IP address as identifier (fallback to 'unknown' if not available)
    const identifier = c.req.header('x-forwarded-for') || 
                      c.req.header('x-real-ip') || 
                      c.env?.ip || 
                      'unknown';

    if (rateLimiter.isRateLimited(identifier)) {
      const info = rateLimiter.getRateLimitInfo(identifier);
      
      return c.json({
        success: false,
        error: 'RateLimitExceeded',
        message: 'Too many requests. Please try again later.',
        rateLimitInfo: {
          remaining: info.remaining,
          resetTime: new Date(info.resetTime).toISOString(),
          total: info.total,
        },
        timestamp: new Date().toISOString(),
      }, 429);
    }

    // Add rate limit headers
    const info = rateLimiter.getRateLimitInfo(identifier);
    c.header('X-RateLimit-Limit', info.total.toString());
    c.header('X-RateLimit-Remaining', info.remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000).toString());

    await next();
  };
}

/**
 * Enhanced error handler for timeline operations
 */
export function handleTimelineError(error: Error, operation: string): {
  error: string;
  message: string;
  code: string;
  statusCode: number;
} {
  console.error(`Timeline ${operation} error:`, error);

  // Handle specific error types
  if (error.message.includes('not found')) {
    return {
      error: 'NotFound',
      message: 'The requested anime or timeline could not be found',
      code: 'NOT_FOUND',
      statusCode: 404,
    };
  }

  if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
    return {
      error: 'TimeoutError',
      message: 'Timeline generation timed out. Please try again later.',
      code: 'TIMEOUT_ERROR',
      statusCode: 504,
    };
  }

  if (error.message.includes('database') || error.message.includes('connection')) {
    return {
      error: 'DatabaseError',
      message: 'Database connection error. Please try again later.',
      code: 'DATABASE_ERROR',
      statusCode: 503,
    };
  }

  if (error.message.includes('rate limit') || error.message.includes('too many')) {
    return {
      error: 'RateLimitExceeded',
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    };
  }

  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return {
      error: 'ValidationError',
      message: error.message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    };
  }

  // Default server error
  return {
    error: 'InternalServerError',
    message: 'An unexpected error occurred while processing the timeline',
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
  };
}