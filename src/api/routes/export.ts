import { Hono } from 'hono';
import { StatisticsService } from '../services/statistics-service.js';
import { ExportService } from '../services/export-service.js';

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

// POST /api/export/generate - Generate and download export file
exportRoutes.post('/generate', async (c) => {
  try {
    const exportService = new ExportService();
    
    // Generate export file
    const exportBuffer = await exportService.generateExportFile();
    
    // Get metadata for response
    const metadata = await exportService.getExportMetadata();
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `project-claw-export-${timestamp}.json`;
    
    // Set appropriate headers for file download
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Length', exportBuffer.length.toString());
    
    return c.body(exportBuffer);
  } catch (error) {
    console.error('Error generating export file:', error);
    
    return c.json({
      success: false,
      error: 'Failed to generate export file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/export/metadata - Get export metadata without generating file
exportRoutes.get('/metadata', async (c) => {
  try {
    const exportService = new ExportService();
    const metadata = await exportService.getExportMetadata();
    
    return c.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('Error getting export metadata:', error);
    
    return c.json({
      success: false,
      error: 'Failed to get export metadata',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export { exportRoutes };