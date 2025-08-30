import { Hono } from 'hono';
import { StatisticsService } from '../services/statistics-service.js';

const exportRoutes = new Hono();

// GET /api/export/stats - Get database statistics
exportRoutes.get('/stats', async (c) => {
  try {
    const statisticsService = new StatisticsService();
    const stats = await statisticsService.getDatabaseStatistics();
    
    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting database statistics:', error);
    
    return c.json({
      success: false,
      error: 'Failed to retrieve database statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/export/stats/detailed - Get detailed database statistics
exportRoutes.get('/stats/detailed', async (c) => {
  try {
    const statisticsService = new StatisticsService();
    const detailedStats = await statisticsService.getDetailedStatistics();
    
    return c.json({
      success: true,
      data: detailedStats
    });
  } catch (error) {
    console.error('Error getting detailed database statistics:', error);
    
    return c.json({
      success: false,
      error: 'Failed to retrieve detailed database statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/export/stats/validate - Validate statistics accuracy
exportRoutes.get('/stats/validate', async (c) => {
  try {
    const statisticsService = new StatisticsService();
    const validation = await statisticsService.validateStatisticsAccuracy();
    
    return c.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating statistics accuracy:', error);
    
    return c.json({
      success: false,
      error: 'Failed to validate statistics accuracy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export { exportRoutes };