import { Hono } from 'hono';
import { checkDatabaseConnection } from '../../db/connection.js';
import { AnimeService } from '../services/anime-service.js';
import { config } from '../../config/env.js';

const health = new Hono();

// Basic health check
health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Detailed health check
health.get('/detailed', async (c) => {
  const checks = {
    database: false,
    myAnimeListApi: false,
  };

  let overallStatus = 'healthy';

  try {
    // Check database connection
    checks.database = checkDatabaseConnection();
    
    // Check MyAnimeList API
    const animeService = new AnimeService();
    const apiStatus = await animeService.checkApiStatus();
    checks.myAnimeListApi = apiStatus.isConfigured && apiStatus.isWorking;
    
    // Determine overall status
    if (!checks.database) {
      overallStatus = 'unhealthy';
    } else if (!checks.myAnimeListApi) {
      overallStatus = 'degraded';
    }

  } catch (error) {
    console.error('Health check error:', error);
    overallStatus = 'unhealthy';
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    checks,
    environment: config.nodeEnv,
  }, statusCode);
});

// Database-specific health check
health.get('/database', (c) => {
  try {
    const isHealthy = checkDatabaseConnection();
    
    return c.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: {
        connected: isHealthy,
        type: 'SQLite',
      },
      timestamp: new Date().toISOString(),
    }, isHealthy ? 200 : 503);
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

// MyAnimeList API health check
health.get('/mal-api', async (c) => {
  try {
    const animeService = new AnimeService();
    const apiStatus = await animeService.checkApiStatus();
    
    const isHealthy = apiStatus.isConfigured && apiStatus.isWorking;
    
    return c.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      myAnimeListApi: {
        configured: apiStatus.isConfigured,
        working: apiStatus.isWorking,
        error: apiStatus.error,
      },
      timestamp: new Date().toISOString(),
    }, isHealthy ? 200 : 503);
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      myAnimeListApi: {
        configured: false,
        working: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

export { health as healthRoutes };