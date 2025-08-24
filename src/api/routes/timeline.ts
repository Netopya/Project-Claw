import { Hono } from 'hono';
import { getWatchlistEntryByMalId } from '../../db/queries.js';
import { TimelineService } from '../services/timeline-service.js';
import { createErrorResponse, logError } from '../utils/error-handler.js';
import { 
  timelineRateLimiter, 
  timelineRefreshRateLimiter, 
  createRateLimitMiddleware, 
  handleTimelineError 
} from '../utils/rate-limiter.js';

const timeline = new Hono();

// Apply rate limiting middleware
const timelineRateLimit = createRateLimitMiddleware(timelineRateLimiter);
const refreshRateLimit = createRateLimitMiddleware(timelineRefreshRateLimiter);

// POST /api/timeline/refresh - Manually refresh timeline cache for an anime
timeline.post('/refresh', refreshRateLimit, async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch (jsonError) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log('🔄 Received request to refresh timeline:', body);
    
    // Validate request body
    if (!body || typeof body !== 'object') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Request body must be a JSON object',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    if (!body.malId || !Number.isInteger(body.malId) || body.malId <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'malId is required and must be a positive integer',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    const malId = body.malId;
    console.log(`🔄 Refreshing timeline for MAL ID: ${malId}`);
    
    // Check if anime exists in watchlist (optional validation)
    const watchlistEntry = await getWatchlistEntryByMalId(malId);
    if (!watchlistEntry) {
      console.warn(`⚠️ MAL ID ${malId} not found in user's watchlist, but proceeding with timeline refresh`);
    }
    
    // Use TimelineService to refresh timeline
    const timelineService = new TimelineService();
    const timeline = await timelineService.refreshTimeline(malId);
    
    console.log(`✅ Successfully refreshed timeline with ${timeline.totalEntries} entries`);
    
    return c.json({
      success: true,
      data: {
        timeline,
        refreshedAt: new Date().toISOString(),
        inUserWatchlist: !!watchlistEntry,
      },
      message: `Timeline refreshed for MAL ID ${malId}`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'POST /api/timeline/refresh');
    const errorResponse = handleTimelineError(error as Error, 'refresh');
    
    return c.json({
      success: false,
      error: errorResponse.error,
      message: errorResponse.message,
      code: errorResponse.code,
      timestamp: new Date().toISOString(),
    }, errorResponse.statusCode);
  }
});

// GET /api/timeline/status - Check timeline processing status for an anime
timeline.get('/status', timelineRateLimit, async (c) => {
  try {
    const malId = parseInt(c.req.query('malId') || '', 10);
    
    if (isNaN(malId) || malId <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'malId query parameter is required and must be a positive integer',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`📊 Checking timeline status for MAL ID: ${malId}`);
    
    // Check if anime exists in watchlist
    const watchlistEntry = await getWatchlistEntryByMalId(malId);
    
    // Use TimelineService to get status
    const timelineService = new TimelineService();
    const status = await timelineService.getTimelineStatus(malId);
    
    console.log(`✅ Timeline status retrieved for MAL ID ${malId}:`, status);
    
    return c.json({
      success: true,
      data: {
        malId,
        status,
        inUserWatchlist: !!watchlistEntry,
        watchlistInfo: watchlistEntry ? {
          id: watchlistEntry.id,
          title: watchlistEntry.animeInfo.title,
          watchStatus: watchlistEntry.watchStatus,
          priority: watchlistEntry.priority,
        } : null,
        checkedAt: new Date().toISOString(),
      },
      message: `Timeline status retrieved for MAL ID ${malId}`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/timeline/status');
    const errorResponse = handleTimelineError(error as Error, 'status check');
    
    return c.json({
      success: false,
      error: errorResponse.error,
      message: errorResponse.message,
      code: errorResponse.code,
      timestamp: new Date().toISOString(),
    }, errorResponse.statusCode);
  }
});

// GET /api/timeline/:malId - Get complete series timeline by MAL ID
timeline.get('/:malId', timelineRateLimit, async (c) => {
  try {
    const malId = parseInt(c.req.param('malId'), 10);
    
    if (isNaN(malId) || malId <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid MAL ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🔍 Fetching timeline for MAL ID: ${malId}`);
    
    // Check if anime exists in watchlist (for additional context)
    const watchlistEntry = await getWatchlistEntryByMalId(malId);
    
    // Generate timeline using TimelineService
    const timelineService = new TimelineService();
    const timeline = await timelineService.getAnimeTimeline(malId);
    
    console.log(`✅ Generated timeline with ${timeline.totalEntries} entries`);
    
    return c.json({
      success: true,
      data: {
        timeline,
        inUserWatchlist: !!watchlistEntry,
        watchlistInfo: watchlistEntry ? {
          id: watchlistEntry.id,
          title: watchlistEntry.animeInfo.title,
          watchStatus: watchlistEntry.watchStatus,
          priority: watchlistEntry.priority,
        } : null,
      },
      message: `Timeline generated for MAL ID ${malId}`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/timeline/:malId');
    const errorResponse = handleTimelineError(error as Error, 'timeline generation');
    
    return c.json({
      success: false,
      error: errorResponse.error,
      message: errorResponse.message,
      code: errorResponse.code,
      timestamp: new Date().toISOString(),
    }, errorResponse.statusCode);
  }
});

export { timeline as timelineRoutes };