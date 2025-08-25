import { Hono } from 'hono';
import { 
  getAllWatchlistEntries, 
  getWatchlistEntryByMalId, 
  getWatchlistEntryById,
  addAnimeToWatchlist, 
  updateWatchlistPriorities, 
  removeFromWatchlist,
  removeFromWatchlistByMalId
} from '../../db/queries.js';
import { AnimeService } from '../services/anime-service.js';
import { TimelineService } from '../services/timeline-service.js';
import { createErrorResponse, logError } from '../utils/error-handler.js';

const anime = new Hono();

// GET /api/anime/all - Get all anime stored in database (not just watchlist)
anime.get('/all', async (c) => {
  try {
    console.log('📊 Fetching all anime from anime_info table...');
    
    const { getAllAnimeInfo } = await import('../../db/queries.js');
    const allAnime = await getAllAnimeInfo();
    
    console.log(`✅ Retrieved ${allAnime.length} total anime from database`);
    
    return c.json({
      success: true,
      data: allAnime,
      count: allAnime.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error fetching all anime:', error);
    return createErrorResponse('Failed to fetch anime data', 500);
  }
});

// GET /api/anime - Get all anime in watchlist ordered by priority
anime.get('/', async (c) => {
  try {
    console.log('📚 Fetching all watchlist entries from database...');
    
    const watchlistEntries = await getAllWatchlistEntries();
    
    // Transform to legacy format for backward compatibility
    const animeList = watchlistEntries.map(entry => ({
      id: entry.id,
      malId: entry.animeInfo.malId,
      title: entry.animeInfo.title,
      titleEnglish: entry.animeInfo.titleEnglish,
      titleJapanese: entry.animeInfo.titleJapanese,
      imageUrl: entry.animeInfo.imageUrl,
      rating: entry.animeInfo.rating,
      premiereDate: entry.animeInfo.premiereDate ? new Date(entry.animeInfo.premiereDate) : null,
      numEpisodes: entry.animeInfo.numEpisodes,
      episodeDuration: entry.animeInfo.episodeDuration,
      animeType: entry.animeInfo.animeType,
      status: entry.animeInfo.status,
      source: entry.animeInfo.source,
      studios: entry.animeInfo.studios ? JSON.parse(entry.animeInfo.studios) : null,
      genres: entry.animeInfo.genres ? JSON.parse(entry.animeInfo.genres) : null,
      priority: entry.priority,
      watchStatus: entry.watchStatus,
      userRating: entry.userRating,
      notes: entry.notes,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));
    
    console.log(`✅ Retrieved ${animeList.length} watchlist entries from database`);
    
    return c.json({
      success: true,
      data: animeList,
      count: animeList.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/anime');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// GET /api/anime/:id - Get specific watchlist entry by ID
anime.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id) || id <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid watchlist entry ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🔍 Fetching watchlist entry with ID: ${id}`);
    
    const watchlistEntry = await getWatchlistEntryById(id);
    
    if (!watchlistEntry) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    // Transform to legacy format for backward compatibility
    const animeData = {
      id: watchlistEntry.id,
      malId: watchlistEntry.animeInfo.malId,
      title: watchlistEntry.animeInfo.title,
      titleEnglish: watchlistEntry.animeInfo.titleEnglish,
      titleJapanese: watchlistEntry.animeInfo.titleJapanese,
      imageUrl: watchlistEntry.animeInfo.imageUrl,
      rating: watchlistEntry.animeInfo.rating,
      premiereDate: watchlistEntry.animeInfo.premiereDate ? new Date(watchlistEntry.animeInfo.premiereDate) : null,
      numEpisodes: watchlistEntry.animeInfo.numEpisodes,
      episodeDuration: watchlistEntry.animeInfo.episodeDuration,
      animeType: watchlistEntry.animeInfo.animeType,
      status: watchlistEntry.animeInfo.status,
      source: watchlistEntry.animeInfo.source,
      studios: watchlistEntry.animeInfo.studios ? JSON.parse(watchlistEntry.animeInfo.studios) : null,
      genres: watchlistEntry.animeInfo.genres ? JSON.parse(watchlistEntry.animeInfo.genres) : null,
      priority: watchlistEntry.priority,
      watchStatus: watchlistEntry.watchStatus,
      userRating: watchlistEntry.userRating,
      notes: watchlistEntry.notes,
      createdAt: new Date(watchlistEntry.createdAt),
      updatedAt: new Date(watchlistEntry.updatedAt),
    };
    
    console.log(`✅ Found anime: ${animeData.title}`);
    
    return c.json({
      success: true,
      data: animeData,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/anime/:id');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// GET /api/anime/mal/:malId - Get watchlist entry by MyAnimeList ID
anime.get('/mal/:malId', async (c) => {
  try {
    const malId = parseInt(c.req.param('malId'), 10);
    
    if (isNaN(malId) || malId <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid MyAnimeList ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🔍 Fetching watchlist entry with MAL ID: ${malId}`);
    
    const watchlistEntry = await getWatchlistEntryByMalId(malId);
    
    if (!watchlistEntry) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    // Transform to legacy format for backward compatibility
    const animeData = {
      id: watchlistEntry.id,
      malId: watchlistEntry.animeInfo.malId,
      title: watchlistEntry.animeInfo.title,
      titleEnglish: watchlistEntry.animeInfo.titleEnglish,
      titleJapanese: watchlistEntry.animeInfo.titleJapanese,
      imageUrl: watchlistEntry.animeInfo.imageUrl,
      rating: watchlistEntry.animeInfo.rating,
      premiereDate: watchlistEntry.animeInfo.premiereDate ? new Date(watchlistEntry.animeInfo.premiereDate) : null,
      numEpisodes: watchlistEntry.animeInfo.numEpisodes,
      episodeDuration: watchlistEntry.animeInfo.episodeDuration,
      animeType: watchlistEntry.animeInfo.animeType,
      status: watchlistEntry.animeInfo.status,
      source: watchlistEntry.animeInfo.source,
      studios: watchlistEntry.animeInfo.studios ? JSON.parse(watchlistEntry.animeInfo.studios) : null,
      genres: watchlistEntry.animeInfo.genres ? JSON.parse(watchlistEntry.animeInfo.genres) : null,
      priority: watchlistEntry.priority,
      watchStatus: watchlistEntry.watchStatus,
      userRating: watchlistEntry.userRating,
      notes: watchlistEntry.notes,
      createdAt: new Date(watchlistEntry.createdAt),
      updatedAt: new Date(watchlistEntry.updatedAt),
    };
    
    console.log(`✅ Found anime: ${animeData.title}`);
    
    return c.json({
      success: true,
      data: animeData,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/anime/mal/:malId');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// POST /api/anime - Add anime from MyAnimeList URL
anime.post('/', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Received request to add anime:', body);
    
    // Validate request body
    if (!body || typeof body !== 'object') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Request body must be a JSON object',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    if (!body.url || typeof body.url !== 'string') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'URL is required and must be a string',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Use AnimeService to add anime from URL
    const animeService = new AnimeService();
    const newAnime = await animeService.addAnimeFromUrl(body.url);
    
    console.log(`✅ Successfully added anime: ${newAnime.title} (ID: ${newAnime.id})`);
    
    return c.json({
      success: true,
      data: newAnime,
      message: 'Anime added successfully',
      timestamp: new Date().toISOString(),
    }, 201);
    
  } catch (error) {
    logError(error as Error, 'POST /api/anime');
    const errorResponse = createErrorResponse(error as Error);
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (errorResponse.code === 'VALIDATION_ERROR') {
      statusCode = 400;
    } else if (errorResponse.code === 'NOT_FOUND') {
      statusCode = 404;
    } else if (errorResponse.code === 'RATE_LIMIT_EXCEEDED') {
      statusCode = 429;
    } else if (errorResponse.code === 'AUTH_ERROR') {
      statusCode = 401;
    } else if (errorResponse.code === 'NETWORK_ERROR') {
      statusCode = 503;
    }
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, statusCode);
  }
});

// POST /api/anime/validate - Validate MyAnimeList URL without adding
anime.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    console.log('🔍 Received request to validate anime URL:', body);
    
    // Validate request body
    if (!body || typeof body !== 'object') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Request body must be a JSON object',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    if (!body.url || typeof body.url !== 'string') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'URL is required and must be a string',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Use AnimeService to validate URL
    const animeService = new AnimeService();
    const validation = await animeService.validateAnimeUrl(body.url);
    
    if (validation.isValid) {
      console.log(`✅ URL is valid: ${validation.title} (MAL ID: ${validation.malId})`);
      
      return c.json({
        success: true,
        data: {
          isValid: true,
          malId: validation.malId,
          title: validation.title,
        },
        message: 'URL is valid and anime can be added',
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`❌ URL validation failed: ${validation.error}`);
      
      return c.json({
        success: false,
        data: {
          isValid: false,
          malId: validation.malId,
          title: validation.title,
          error: validation.error,
        },
        message: 'URL validation failed',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
  } catch (error) {
    logError(error as Error, 'POST /api/anime/validate');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// PUT /api/anime/reorder - Update anime priority ordering
anime.put('/reorder', async (c) => {
  try {
    const body = await c.req.json();
    console.log('🔄 Received request to reorder anime:', body);
    
    // Validate request body
    if (!body || typeof body !== 'object') {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Request body must be a JSON object',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    if (!Array.isArray(body.animeIds)) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'animeIds must be an array',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Validate anime IDs
    const animeIds = body.animeIds;
    if (animeIds.length === 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'animeIds array cannot be empty',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Check that all IDs are valid integers
    for (let i = 0; i < animeIds.length; i++) {
      const id = animeIds[i];
      if (!Number.isInteger(id) || id <= 0) {
        return c.json({
          success: false,
          error: 'ValidationError',
          message: `Invalid anime ID at index ${i}: ${id}`,
          timestamp: new Date().toISOString(),
        }, 400);
      }
    }
    
    // Check for duplicates
    const uniqueIds = new Set(animeIds);
    if (uniqueIds.size !== animeIds.length) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Duplicate anime IDs are not allowed',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Verify all watchlist entries exist in database
    const existingEntries = await getAllWatchlistEntries();
    const existingIds = new Set(existingEntries.map(entry => entry.id));
    
    for (const id of animeIds) {
      if (!existingIds.has(id)) {
        return c.json({
          success: false,
          error: 'ValidationError',
          message: `Watchlist entry with ID ${id} not found`,
          timestamp: new Date().toISOString(),
        }, 400);
      }
    }
    
    // Check that we have all entries (no missing IDs)
    if (animeIds.length !== existingEntries.length) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: `Expected ${existingEntries.length} watchlist entry IDs, but received ${animeIds.length}`,
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Update priorities
    await updateWatchlistPriorities(animeIds);
    
    // Fetch updated watchlist to return
    const updatedEntries = await getAllWatchlistEntries();
    
    // Transform to legacy format for backward compatibility
    const updatedAnime = updatedEntries.map(entry => ({
      id: entry.id,
      malId: entry.animeInfo.malId,
      title: entry.animeInfo.title,
      titleEnglish: entry.animeInfo.titleEnglish,
      titleJapanese: entry.animeInfo.titleJapanese,
      imageUrl: entry.animeInfo.imageUrl,
      rating: entry.animeInfo.rating,
      premiereDate: entry.animeInfo.premiereDate ? new Date(entry.animeInfo.premiereDate) : null,
      numEpisodes: entry.animeInfo.numEpisodes,
      episodeDuration: entry.animeInfo.episodeDuration,
      animeType: entry.animeInfo.animeType,
      status: entry.animeInfo.status,
      source: entry.animeInfo.source,
      studios: entry.animeInfo.studios ? JSON.parse(entry.animeInfo.studios) : null,
      genres: entry.animeInfo.genres ? JSON.parse(entry.animeInfo.genres) : null,
      priority: entry.priority,
      watchStatus: entry.watchStatus,
      userRating: entry.userRating,
      notes: entry.notes,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));
    
    console.log(`✅ Successfully reordered ${animeIds.length} anime`);
    
    return c.json({
      success: true,
      data: updatedAnime,
      message: 'Anime order updated successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'PUT /api/anime/reorder');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// DELETE /api/anime/:id - Remove anime from watchlist
anime.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id) || id <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid anime ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🗑️ Received request to delete anime with ID: ${id}`);
    
    // Check if watchlist entry exists before deletion
    const entryToDelete = await getWatchlistEntryById(id);
    
    if (!entryToDelete) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`🔍 Found anime to delete: ${entryToDelete.animeInfo.title}`);
    
    // Transform to legacy format for response
    const animeToDelete = {
      id: entryToDelete.id,
      malId: entryToDelete.animeInfo.malId,
      title: entryToDelete.animeInfo.title,
      titleEnglish: entryToDelete.animeInfo.titleEnglish,
      titleJapanese: entryToDelete.animeInfo.titleJapanese,
      imageUrl: entryToDelete.animeInfo.imageUrl,
      rating: entryToDelete.animeInfo.rating,
      premiereDate: entryToDelete.animeInfo.premiereDate ? new Date(entryToDelete.animeInfo.premiereDate) : null,
      numEpisodes: entryToDelete.animeInfo.numEpisodes,
      episodeDuration: entryToDelete.animeInfo.episodeDuration,
      animeType: entryToDelete.animeInfo.animeType,
      status: entryToDelete.animeInfo.status,
      source: entryToDelete.animeInfo.source,
      studios: entryToDelete.animeInfo.studios ? JSON.parse(entryToDelete.animeInfo.studios) : null,
      genres: entryToDelete.animeInfo.genres ? JSON.parse(entryToDelete.animeInfo.genres) : null,
      priority: entryToDelete.priority,
      watchStatus: entryToDelete.watchStatus,
      userRating: entryToDelete.userRating,
      notes: entryToDelete.notes,
      createdAt: new Date(entryToDelete.createdAt),
      updatedAt: new Date(entryToDelete.updatedAt),
    };
    
    // Remove from watchlist (this will also adjust priorities of remaining items)
    await removeFromWatchlist(id);
    
    // Fetch updated watchlist
    const updatedEntries = await getAllWatchlistEntries();
    
    // Transform to legacy format
    const remainingAnime = updatedEntries.map(entry => ({
      id: entry.id,
      malId: entry.animeInfo.malId,
      title: entry.animeInfo.title,
      titleEnglish: entry.animeInfo.titleEnglish,
      titleJapanese: entry.animeInfo.titleJapanese,
      imageUrl: entry.animeInfo.imageUrl,
      rating: entry.animeInfo.rating,
      premiereDate: entry.animeInfo.premiereDate ? new Date(entry.animeInfo.premiereDate) : null,
      numEpisodes: entry.animeInfo.numEpisodes,
      episodeDuration: entry.animeInfo.episodeDuration,
      animeType: entry.animeInfo.animeType,
      status: entry.animeInfo.status,
      source: entry.animeInfo.source,
      studios: entry.animeInfo.studios ? JSON.parse(entry.animeInfo.studios) : null,
      genres: entry.animeInfo.genres ? JSON.parse(entry.animeInfo.genres) : null,
      priority: entry.priority,
      watchStatus: entry.watchStatus,
      userRating: entry.userRating,
      notes: entry.notes,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));
    
    console.log(`✅ Successfully deleted anime: ${animeToDelete.title} (ID: ${id})`);
    console.log(`📊 Remaining anime count: ${remainingAnime.length}`);
    
    return c.json({
      success: true,
      data: {
        deletedAnime: animeToDelete,
        remainingAnime: remainingAnime,
        remainingCount: remainingAnime.length,
      },
      message: `Successfully removed "${animeToDelete.title}" from watchlist`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'DELETE /api/anime/:id');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// DELETE /api/anime/mal/:malId - Remove anime by MyAnimeList ID
anime.delete('/mal/:malId', async (c) => {
  try {
    const malId = parseInt(c.req.param('malId'), 10);
    
    if (isNaN(malId) || malId <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid MyAnimeList ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🗑️ Received request to delete anime with MAL ID: ${malId}`);
    
    // Find watchlist entry by MAL ID
    const entryToDelete = await getWatchlistEntryByMalId(malId);
    
    if (!entryToDelete) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`🔍 Found anime to delete: ${entryToDelete.animeInfo.title} (DB ID: ${entryToDelete.id})`);
    
    // Transform to legacy format for response
    const animeToDelete = {
      id: entryToDelete.id,
      malId: entryToDelete.animeInfo.malId,
      title: entryToDelete.animeInfo.title,
      titleEnglish: entryToDelete.animeInfo.titleEnglish,
      titleJapanese: entryToDelete.animeInfo.titleJapanese,
      imageUrl: entryToDelete.animeInfo.imageUrl,
      rating: entryToDelete.animeInfo.rating,
      premiereDate: entryToDelete.animeInfo.premiereDate ? new Date(entryToDelete.animeInfo.premiereDate) : null,
      numEpisodes: entryToDelete.animeInfo.numEpisodes,
      episodeDuration: entryToDelete.animeInfo.episodeDuration,
      animeType: entryToDelete.animeInfo.animeType,
      status: entryToDelete.animeInfo.status,
      source: entryToDelete.animeInfo.source,
      studios: entryToDelete.animeInfo.studios ? JSON.parse(entryToDelete.animeInfo.studios) : null,
      genres: entryToDelete.animeInfo.genres ? JSON.parse(entryToDelete.animeInfo.genres) : null,
      priority: entryToDelete.priority,
      watchStatus: entryToDelete.watchStatus,
      userRating: entryToDelete.userRating,
      notes: entryToDelete.notes,
      createdAt: new Date(entryToDelete.createdAt),
      updatedAt: new Date(entryToDelete.updatedAt),
    };
    
    // Remove from watchlist by MAL ID
    await removeFromWatchlistByMalId(malId);
    
    // Fetch updated watchlist
    const updatedEntries = await getAllWatchlistEntries();
    
    // Transform to legacy format
    const remainingAnime = updatedEntries.map(entry => ({
      id: entry.id,
      malId: entry.animeInfo.malId,
      title: entry.animeInfo.title,
      titleEnglish: entry.animeInfo.titleEnglish,
      titleJapanese: entry.animeInfo.titleJapanese,
      imageUrl: entry.animeInfo.imageUrl,
      rating: entry.animeInfo.rating,
      premiereDate: entry.animeInfo.premiereDate ? new Date(entry.animeInfo.premiereDate) : null,
      numEpisodes: entry.animeInfo.numEpisodes,
      episodeDuration: entry.animeInfo.episodeDuration,
      animeType: entry.animeInfo.animeType,
      status: entry.animeInfo.status,
      source: entry.animeInfo.source,
      studios: entry.animeInfo.studios ? JSON.parse(entry.animeInfo.studios) : null,
      genres: entry.animeInfo.genres ? JSON.parse(entry.animeInfo.genres) : null,
      priority: entry.priority,
      watchStatus: entry.watchStatus,
      userRating: entry.userRating,
      notes: entry.notes,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));
    
    console.log(`✅ Successfully deleted anime: ${animeToDelete.title} (MAL ID: ${malId})`);
    console.log(`📊 Remaining anime count: ${remainingAnime.length}`);
    
    return c.json({
      success: true,
      data: {
        deletedAnime: animeToDelete,
        remainingAnime: remainingAnime,
        remainingCount: remainingAnime.length,
      },
      message: `Successfully removed "${animeToDelete.title}" from watchlist`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'DELETE /api/anime/mal/:malId');
    const errorResponse = createErrorResponse(error as Error);
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// GET /api/anime/:id/timeline - Get complete series timeline for an anime
anime.get('/:id/timeline', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id) || id <= 0) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid anime ID',
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    console.log(`🔍 Fetching timeline for anime ID: ${id}`);
    
    // Get the watchlist entry to find the MAL ID
    const watchlistEntry = await getWatchlistEntryById(id);
    
    if (!watchlistEntry) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    const malId = watchlistEntry.animeInfo.malId;
    console.log(`🎯 Generating timeline for: ${watchlistEntry.animeInfo.title} (MAL ID: ${malId})`);
    
    // Generate timeline using TimelineService
    // Use the shared database connection for timeline service
    const { getSQLiteConnection } = await import('../../db/connection.js');
    const sqliteConnection = getSQLiteConnection();
    const { TimelineDatabase } = await import('../services/timeline-database.js');
    const timelineService = new TimelineService(new TimelineDatabase(sqliteConnection));
    const timeline = await timelineService.getAnimeTimeline(malId);
    
    console.log(`✅ Generated timeline with ${timeline.totalEntries} entries`);
    
    return c.json({
      success: true,
      data: {
        timeline,
        animeInfo: {
          id: watchlistEntry.id,
          malId: watchlistEntry.animeInfo.malId,
          title: watchlistEntry.animeInfo.title,
          titleEnglish: watchlistEntry.animeInfo.titleEnglish,
          titleJapanese: watchlistEntry.animeInfo.titleJapanese,
        }
      },
      message: `Timeline generated for "${watchlistEntry.animeInfo.title}"`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error as Error, 'GET /api/anime/:id/timeline');
    const errorResponse = createErrorResponse(error as Error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (errorResponse.code === 'VALIDATION_ERROR') {
      statusCode = 400;
    } else if (errorResponse.code === 'NOT_FOUND') {
      statusCode = 404;
    } else if (errorResponse.code === 'RATE_LIMIT_EXCEEDED') {
      statusCode = 429;
    }
    
    return c.json({
      success: false,
      ...errorResponse,
      timestamp: new Date().toISOString(),
    }, statusCode);
  }
});

export { anime as animeRoutes };