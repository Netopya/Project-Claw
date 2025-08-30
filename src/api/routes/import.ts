import { Hono } from 'hono';
import { ImportValidationService } from '../services/import-validation-service.js';
import { ImportExecutionService } from '../services/import-execution-service.js';
import type { 
  ImportOptions, 
  ImportValidateResponse, 
  ImportPreviewResponse, 
  ImportExecuteResponse 
} from '../../types/export-import.js';

const importRoutes = new Hono();

// POST /api/import/validate - Validate uploaded file
importRoutes.post('/validate', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    
    if (!file) {
      return c.json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'No file provided for validation',
          timestamp: new Date().toISOString()
        }
      } as ImportValidateResponse, 400);
    }

    // Validate file format first
    const validationService = new ImportValidationService();
    const formatValidation = validationService.validateFileFormat(file.name, file.type);
    
    if (!formatValidation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_FILE_FORMAT',
          message: 'Invalid file format',
          details: formatValidation.errors,
          timestamp: new Date().toISOString()
        }
      } as ImportValidateResponse, 400);
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file content
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    return c.json({
      success: true,
      data: validationResult
    } as ImportValidateResponse);

  } catch (error) {
    console.error('Error validating import file:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate import file',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    } as ImportValidateResponse, 500);
  }
});

// POST /api/import/preview - Preview import data
importRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    
    if (!file) {
      return c.json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'No file provided for preview',
          timestamp: new Date().toISOString()
        }
      } as ImportPreviewResponse, 400);
    }

    // Convert file to buffer and parse
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validationService = new ImportValidationService();
    
    // First validate the file
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    if (!validationResult.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: 'File validation failed',
          details: validationResult.errors,
          timestamp: new Date().toISOString()
        }
      } as ImportPreviewResponse, 400);
    }

    // Parse the validated file
    const exportData = JSON.parse(fileBuffer.toString('utf-8'));
    
    // Create import preview
    const importPreview = await validationService.createImportPreview(exportData);
    
    return c.json({
      success: true,
      data: importPreview
    } as ImportPreviewResponse);

  } catch (error) {
    console.error('Error creating import preview:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'PREVIEW_ERROR',
        message: 'Failed to create import preview',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    } as ImportPreviewResponse, 500);
  }
});

// POST /api/import/execute - Execute import operation
importRoutes.post('/execute', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const optionsJson = body.options as string;
    
    if (!file) {
      return c.json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'No file provided for import',
          timestamp: new Date().toISOString()
        }
      } as ImportExecuteResponse, 400);
    }

    // Parse import options
    let importOptions: ImportOptions;
    try {
      importOptions = optionsJson ? JSON.parse(optionsJson) : {
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };
    } catch (error) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_OPTIONS',
          message: 'Invalid import options format',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      } as ImportExecuteResponse, 400);
    }

    // Convert file to buffer and validate
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validationService = new ImportValidationService();
    
    // Validate file before execution
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    if (!validationResult.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: 'File validation failed',
          details: validationResult.errors,
          timestamp: new Date().toISOString()
        }
      } as ImportExecuteResponse, 400);
    }

    // Parse the validated file
    const exportData = JSON.parse(fileBuffer.toString('utf-8'));
    
    // Execute import
    const executionService = new ImportExecutionService();
    const importResult = await executionService.executeImport(exportData, importOptions);
    
    return c.json({
      success: true,
      data: importResult
    } as ImportExecuteResponse);

  } catch (error) {
    console.error('Error executing import:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'IMPORT_EXECUTION_ERROR',
        message: 'Failed to execute import',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    } as ImportExecuteResponse, 500);
  }
});

export { importRoutes };