import { Hono } from 'hono';
import { getAllAnime, getAnimeByMalId, addAnime, updateAnimePriorities, deleteAnime } from '../../db/queries.js';
import { AnimeService } from '../services/anime-service.js';
import { createErrorResponse, logError } from '../utils/error-handler.js';
import { sanitizeCreateAnimeData, sanitizeUpdateAnimeData } from '../utils/data-sanitizer.js';
import { validateCreateAnimeData, validateUpdateAnimeData } from '../../types/validation.js';

const anime = new Hono();

// GET /api/anime - Get all anime ordered by priority
anime.get('/', async (c) => {
  try {
    console.log('📚 Fetching all anime from database...');
    
    const animeList = await getAllAnime();
    
    console.log(`✅ Retrieved ${animeList.length} anime from database`);
    
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

// GET /api/anime/:id - Get specific anime by ID
anime.get('/:id', async (c) => {
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
    
    console.log(`🔍 Fetching anime with ID: ${id}`);
    
    // For now, we'll search by database ID
    // In the future, we might want to add a separate endpoint for MAL ID
    const animeList = await getAllAnime();
    const foundAnime = animeList.find(anime => anime.id === id);
    
    if (!foundAnime) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`✅ Found anime: ${foundAnime.title}`);
    
    return c.json({
      success: true,
      data: foundAnime,
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

// GET /api/anime/mal/:malId - Get anime by MyAnimeList ID
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
    
    console.log(`🔍 Fetching anime with MAL ID: ${malId}`);
    
    const foundAnime = await getAnimeByMalId(malId);
    
    if (!foundAnime) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`✅ Found anime: ${foundAnime.title}`);
    
    return c.json({
      success: true,
      data: foundAnime,
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
    
    // Verify all anime exist in database
    const existingAnime = await getAllAnime();
    const existingIds = new Set(existingAnime.map(anime => anime.id));
    
    for (const id of animeIds) {
      if (!existingIds.has(id)) {
        return c.json({
          success: false,
          error: 'ValidationError',
          message: `Anime with ID ${id} not found in watchlist`,
          timestamp: new Date().toISOString(),
        }, 400);
      }
    }
    
    // Check that we have all anime (no missing IDs)
    if (animeIds.length !== existingAnime.length) {
      return c.json({
        success: false,
        error: 'ValidationError',
        message: `Expected ${existingAnime.length} anime IDs, but received ${animeIds.length}`,
        timestamp: new Date().toISOString(),
      }, 400);
    }
    
    // Update priorities
    await updateAnimePriorities(animeIds);
    
    // Fetch updated anime list to return
    const updatedAnime = await getAllAnime();
    
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
    
    // Check if anime exists before deletion
    const existingAnime = await getAllAnime();
    const animeToDelete = existingAnime.find(anime => anime.id === id);
    
    if (!animeToDelete) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`🔍 Found anime to delete: ${animeToDelete.title}`);
    
    // Delete anime (this will also adjust priorities of remaining items)
    await deleteAnime(id);
    
    // Fetch updated anime list
    const updatedAnime = await getAllAnime();
    
    console.log(`✅ Successfully deleted anime: ${animeToDelete.title} (ID: ${id})`);
    console.log(`📊 Remaining anime count: ${updatedAnime.length}`);
    
    return c.json({
      success: true,
      data: {
        deletedAnime: animeToDelete,
        remainingAnime: updatedAnime,
        remainingCount: updatedAnime.length,
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
    
    // Find anime by MAL ID
    const animeToDelete = await getAnimeByMalId(malId);
    
    if (!animeToDelete) {
      return c.json({
        success: false,
        error: 'NotFound',
        message: 'Anime not found in watchlist',
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    console.log(`🔍 Found anime to delete: ${animeToDelete.title} (DB ID: ${animeToDelete.id})`);
    
    // Delete anime using database ID
    await deleteAnime(animeToDelete.id);
    
    // Fetch updated anime list
    const updatedAnime = await getAllAnime();
    
    console.log(`✅ Successfully deleted anime: ${animeToDelete.title} (MAL ID: ${malId})`);
    console.log(`📊 Remaining anime count: ${updatedAnime.length}`);
    
    return c.json({
      success: true,
      data: {
        deletedAnime: animeToDelete,
        remainingAnime: updatedAnime,
        remainingCount: updatedAnime.length,
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

export { anime as animeRoutes };