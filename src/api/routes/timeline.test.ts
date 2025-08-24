import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { timelineRoutes } from './timeline.js';

// Mock the dependencies
vi.mock('../../db/queries.js', () => ({
  getWatchlistEntryByMalId: vi.fn(),
}));

vi.mock('../services/timeline-service.js', () => ({
  TimelineService: vi.fn().mockImplementation(() => ({
    getAnimeTimeline: vi.fn(),
    refreshTimeline: vi.fn(),
    getTimelineStatus: vi.fn(),
  })),
}));

vi.mock('../utils/error-handler.js', () => ({
  createErrorResponse: vi.fn((error) => ({
    error: error.name,
    message: error.message,
    code: 'UNKNOWN_ERROR',
  })),
  logError: vi.fn(),
}));

vi.mock('../utils/rate-limiter.js', () => ({
  timelineRateLimiter: {},
  timelineRefreshRateLimiter: {},
  createRateLimitMiddleware: vi.fn(() => async (c: any, next: any) => await next()),
  handleTimelineError: vi.fn((error) => ({
    error: error.name || 'InternalServerError',
    message: error.message,
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
  })),
}));

describe('Timeline Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/timeline', timelineRoutes);
    vi.clearAllMocks();
  });

  describe('POST /api/timeline/refresh', () => {
    it('should validate malId is required', async () => {
      const res = await app.request('/api/timeline/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('malId is required');
    });

    it('should validate malId is a positive integer', async () => {
      const res = await app.request('/api/timeline/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ malId: -1 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
    });

    it('should handle invalid JSON gracefully', async () => {
      const res = await app.request('/api/timeline/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      // Invalid JSON causes a 400 error during parsing, which is expected
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/timeline/status', () => {
    it('should validate malId query parameter is required', async () => {
      const res = await app.request('/api/timeline/status');

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('malId query parameter is required');
    });

    it('should validate malId is a positive integer', async () => {
      const res = await app.request('/api/timeline/status?malId=-1');

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
    });
  });

  describe('GET /api/timeline/:malId', () => {
    it('should validate malId parameter is a positive integer', async () => {
      const res = await app.request('/api/timeline/-1');

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toBe('Invalid MAL ID');
    });

    it('should validate malId parameter is numeric', async () => {
      const res = await app.request('/api/timeline/invalid');

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ValidationError');
    });
  });
});