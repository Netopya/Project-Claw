import { Hono } from 'hono';
import { StatisticsService } from '../services/statistics-service.js';
import { ExportService } from '../services/export-service.js';
import { ExportError, ERROR_CODES, toApiError } from '../../utils/export-import-error-handler.js';

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
    
    const exportError = new ExportError(
      'Failed to retrieve database statistics',
      ERROR_CODES.EXPORT_DATABASE_ERROR,
      500,
      true
    );
    
    return c.json({
      success: false,
      error: toApiError(exportError)
    }, exportError.statusCode);
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
    
    const exportError = new ExportError(
      'Failed to retrieve detailed database statistics',
      ERROR_CODES.EXPORT_DATABASE_ERROR,
      500,
      true
    );
    
    return c.json({
      success: false,
      error: toApiError(exportError)
    }, exportError.statusCode);
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
    
    const exportError = new ExportError(
      'Failed to validate statistics accuracy',
      ERROR_CODES.EXPORT_VALIDATION_FAILED,
      500,
      true
    );
    
    return c.json({
      success: false,
      error: toApiError(exportError)
    }, exportError.statusCode);
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
    
    // Determine specific error type based on error message
    let exportError: ExportError;
    const errorMessage = (error instanceof Error ? error.message : 'Unknown error').toLowerCase();
    
    if (errorMessage.includes('storage') || errorMessage.includes('space') || errorMessage.includes('enospc')) {
      exportError = new ExportError(
        'Insufficient storage space to create export file',
        ERROR_CODES.EXPORT_INSUFFICIENT_STORAGE,
        507,
        true
      );
    } else if (errorMessage.includes('permission') || errorMessage.includes('eacces')) {
      exportError = new ExportError(
        'Permission denied while creating export file',
        ERROR_CODES.PERMISSION_DENIED,
        403,
        false
      );
    } else if (errorMessage.includes('validation') || errorMessage.includes('integrity')) {
      exportError = new ExportError(
        'Data validation failed during export',
        ERROR_CODES.EXPORT_VALIDATION_FAILED,
        422,
        false
      );
    } else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      exportError = new ExportError(
        'Database error occurred during export',
        ERROR_CODES.EXPORT_DATABASE_ERROR,
        500,
        true
      );
    } else {
      exportError = new ExportError(
        'Failed to generate export file',
        ERROR_CODES.EXPORT_FILE_GENERATION_FAILED,
        500,
        true
      );
    }
    
    return c.json({
      success: false,
      error: toApiError(exportError)
    }, exportError.statusCode);
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
    
    const exportError = new ExportError(
      'Failed to get export metadata',
      ERROR_CODES.EXPORT_DATABASE_ERROR,
      500,
      true
    );
    
    return c.json({
      success: false,
      error: toApiError(exportError)
    }, exportError.statusCode);
  }
});

export { exportRoutes };